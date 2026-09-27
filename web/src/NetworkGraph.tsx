import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import ForceGraph2DRaw from "react-force-graph-2d";
import type { ForceGraphMethods } from "react-force-graph-2d";
import { Maximize2, Minus, Plus, Search, X } from "lucide-react";
import "./NetworkGraph.css";

// The upstream types double-wrap generics (NodeObject<NodeObject<T>>), so we
// pass the component through a loose signature at the boundary and keep our
// own strict GraphNode/GraphLink types inside the callbacks.
const ForceGraph2D = ForceGraph2DRaw as unknown as (props: Record<string, unknown>) => ReactElement;

// Shape mirrors web/shared/graph-contract.mjs.
type NodeType = "person" | "interest" | "skill" | "event";
type LinkType = "tag" | "match" | "connection";

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  group: string | null;
  degree: number;
  avatar?: string | null;
  role?: string | null;
  synthetic?: boolean;
}

interface GraphLink {
  source: string;
  target: string;
  type: LinkType;
  weight: number;
}

interface GraphResponse {
  nodes: GraphNode[];
  links: GraphLink[];
  meta: {
    source: "memory" | "mongo";
    generatedAt: string;
    eventId: string | null;
    hubs: ("interest" | "skill" | "event")[];
    viewerId: string | null;
    counts: {
      people: number;
      hubs: number;
      matches: number;
      connections: number;
      orphans: number;
    };
  };
}

// Runtime shape after the force simulation populates x/y and dereferences
// source/target to full node objects.
type SimNode = GraphNode & {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  ring?: number;
  fx?: number | null;
  fy?: number | null;
};
type SimLink = Omit<GraphLink, "source" | "target"> & {
  source: SimNode | string;
  target: SimNode | string;
};

// One color per community. Names mirror seed.mjs.
const COMMUNITY_COLORS: Record<string, string> = {
  assistive: "#f97316", // orange
  spatial: "#a78bfa", // violet
  ai: "#60a5fa", // blue
  design: "#f472b6", // rose
  civic: "#facc15", // yellow
  climate: "#34d399", // green
};
const COMMUNITY_LABELS: Record<string, string> = {
  assistive: "Assistive",
  spatial: "Spatial",
  ai: "AI",
  design: "Design",
  civic: "Civic",
  climate: "Climate",
};
const HUB_COLORS: Record<Exclude<NodeType, "person">, string> = {
  interest: "#94a3b8",
  skill: "#64748b",
  event: "#c084fc",
};

const RING_RADII = [0, 180, 340, 500, 660]; // ring 0 is the viewer
const OUTER_RING_RADIUS = 820;
const VIEWER_COLOR = "#69E6A6";
const DIM_ALPHA = 0.1;

interface NetworkGraphProps {
  viewerId?: string | null;
  eventId?: string | null;
  onSelectPerson: (personId: string) => void;
  style?: CSSProperties;
}

export function NetworkGraph({ viewerId = null, eventId = null, onSelectPerson, style }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<ForceGraphMethods<any, any> | undefined>(undefined);
  const [data, setData] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showTopics, setShowTopics] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  // Fetch graph data. Topics are off by default so people don't collapse into
  // a single blob around a handful of shared interests.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setError(null);
    const params = new URLSearchParams();
    if (eventId) params.set("eventId", eventId);
    params.set("hubs", showTopics ? "interest,skill,event" : "");
    fetch(`/api/graph?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Graph request failed with ${response.status}`);
        return response.json();
      })
      .then((value: GraphResponse) => {
        if (!cancelled) setData(value);
      })
      .catch((err) => {
        if (cancelled || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [eventId, showTopics]);

  // Track container size so the canvas fills the panel.
  useEffect(() => {
    if (!containerRef.current) return;
    const element = containerRef.current;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Build adjacency + BFS rings from the viewer. Only person-person edges
  // (connection + match) count as steps; topic hubs are decoration.
  const layout = useMemo(() => {
    const rings = new Map<string, number>();
    const neighborsById = new Map<string, Set<string>>();
    if (!data) return { rings, neighborsById };
    for (const node of data.nodes) neighborsById.set(node.id, new Set());
    for (const link of data.links as unknown as SimLink[]) {
      const s = typeof link.source === "string" ? link.source : link.source.id;
      const t = typeof link.target === "string" ? link.target : link.target.id;
      neighborsById.get(s)?.add(t);
      neighborsById.get(t)?.add(s);
    }
    if (!viewerId || !neighborsById.has(viewerId)) return { rings, neighborsById };

    // BFS across connection/match edges only. Everyone else lands on the
    // outer ring later.
    const stepNeighbors = new Map<string, Set<string>>();
    for (const node of data.nodes) stepNeighbors.set(node.id, new Set());
    for (const link of data.links as unknown as SimLink[]) {
      if (link.type !== "connection" && link.type !== "match") continue;
      const s = typeof link.source === "string" ? link.source : link.source.id;
      const t = typeof link.target === "string" ? link.target : link.target.id;
      stepNeighbors.get(s)?.add(t);
      stepNeighbors.get(t)?.add(s);
    }
    const queue: string[] = [viewerId];
    rings.set(viewerId, 0);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const depth = rings.get(current)!;
      if (depth >= 3) continue;
      for (const next of stepNeighbors.get(current) ?? []) {
        if (rings.has(next)) continue;
        rings.set(next, depth + 1);
        queue.push(next);
      }
    }
    return { rings, neighborsById };
  }, [data, viewerId]);

  // Person's ring for coloring/sizing; hubs and unreachable people go outer.
  const ringOf = useCallback(
    (id: string, type: NodeType) => {
      if (type !== "person") return 3;
      return layout.rings.get(id) ?? 4;
    },
    [layout.rings],
  );

  // Search matches for search-then-zoom.
  const searchMatches = useMemo(() => {
    if (!data || !query.trim()) return [] as GraphNode[];
    const needle = query.trim().toLowerCase();
    return data.nodes
      .filter((node) => node.label.toLowerCase().includes(needle) || node.id.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [data, query]);

  const activeId = hoverId ?? searchMatches[0]?.id ?? null;
  const activeNeighbors = activeId ? layout.neighborsById.get(activeId) ?? new Set<string>() : null;

  // Pin the viewer at the origin and install a custom radial force per ring.
  useEffect(() => {
    if (!graphRef.current || !data || !viewerId) return;
    const graph = graphRef.current;

    // Pin the viewer to (0,0) so the whole graph revolves around them, and
    // seed every other node with a starting position on its target ring so
    // the simulation doesn't have to untangle a giant knot at the origin.
    const rawNodes = (data.nodes as unknown as SimNode[]);
    for (const node of rawNodes) {
      if (node.id === viewerId) {
        node.fx = 0;
        node.fy = 0;
        node.x = 0;
        node.y = 0;
        continue;
      }
      node.fx = null;
      node.fy = null;
      const ring = ringOf(node.id, node.type);
      const target = ring <= 3 ? RING_RADII[ring] ?? OUTER_RING_RADIUS : OUTER_RING_RADIUS;
      // Deterministic-ish spread using a hash of the id so nodes fan out.
      let h = 0;
      for (let i = 0; i < node.id.length; i += 1) h = (h * 31 + node.id.charCodeAt(i)) | 0;
      const angle = (h % 360) * (Math.PI / 180);
      const jitter = target * 0.08;
      node.x = Math.cos(angle) * (target + (h % 2 === 0 ? jitter : -jitter));
      node.y = Math.sin(angle) * (target + (h % 3 === 0 ? jitter : -jitter));
      node.vx = 0;
      node.vy = 0;
    }

    // Custom radial force: accumulate velocity toward the target ring radius.
    // Using vx/vy (the standard d3 pattern) plays nicely with charge + link.
    const ringForce = (alpha: number) => {
      for (const node of rawNodes) {
        if (node.id === viewerId) continue;
        const ring = ringOf(node.id, node.type);
        const target = ring <= 3 ? RING_RADII[ring] ?? OUTER_RING_RADIUS : OUTER_RING_RADIUS;
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const r = Math.hypot(x, y);
        const strength = ring >= 4 ? 0.9 : 0.6;
        if (r < 1) {
          const angle = Math.random() * Math.PI * 2;
          node.vx = (node.vx ?? 0) + Math.cos(angle) * target * strength * alpha;
          node.vy = (node.vy ?? 0) + Math.sin(angle) * target * strength * alpha;
          continue;
        }
        const delta = target - r;
        node.vx = (node.vx ?? 0) + (x / r) * delta * strength * alpha;
        node.vy = (node.vy ?? 0) + (y / r) * delta * strength * alpha;
      }
    };
    graph.d3Force("rings", ringForce);
    // Weaker repulsion + much weaker links so the ring force wins. Links are
    // still meaningful because the ring assignment came from the same graph.
    graph.d3Force("charge")?.strength(-40).distanceMax(220);
    graph.d3Force("link")?.distance(80).strength(0.04);
    graph.d3ReheatSimulation();

    if (reducedMotion) {
      const stopId = setTimeout(() => graph.pauseAnimation(), 900);
      return () => clearTimeout(stopId);
    }
    return undefined;
  }, [data, viewerId, ringOf, reducedMotion]);

  const nodeCanvasObject = useCallback(
    (rawNode: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const node = rawNode as SimNode;
      if (node.x === undefined || node.y === undefined) return;
      const isPerson = node.type === "person";
      const isViewer = viewerId !== null && node.id === viewerId;
      const dim = activeId !== null && activeId !== node.id && !(activeNeighbors && activeNeighbors.has(node.id));

      const radius = isViewer
        ? 7
        : isPerson
          ? Math.max(2.2, Math.min(5.5, 2.2 + Math.sqrt(node.degree)))
          : 2.4;

      let fill = "#f0f2f5";
      if (isViewer) fill = VIEWER_COLOR;
      else if (isPerson) fill = node.group ? COMMUNITY_COLORS[node.group] ?? "#cbd5e1" : "#94a3b8";
      else fill = HUB_COLORS[node.type as Exclude<NodeType, "person">];

      ctx.globalAlpha = dim ? DIM_ALPHA : 1;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();

      // Draw a subtle jade ring around the viewer so they're easy to find.
      if (isViewer) {
        ctx.strokeStyle = "rgba(105, 230, 166, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Labels only when zoomed in, or the viewer, or the actively hovered node.
      const showLabel =
        isViewer ||
        activeId === node.id ||
        (isPerson && globalScale > 2.6) ||
        (!isPerson && globalScale > 3.4);
      if (showLabel) {
        const label = isViewer ? "You" : node.label;
        ctx.font = `${Math.min(12, 6 / globalScale + 4)}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isViewer ? "#d1f5e0" : "rgba(240, 242, 245, 0.88)";
        ctx.fillText(label, node.x, node.y + radius + 2);
      }

      ctx.globalAlpha = 1;
    },
    [activeId, activeNeighbors, viewerId],
  );

  const nodePointerAreaPaint = useCallback((rawNode: unknown, color: string, ctx: CanvasRenderingContext2D) => {
    const node = rawNode as SimNode;
    if (node.x === undefined || node.y === undefined) return;
    const radius = node.type === "person" ? 7 : 4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const linkColor = useCallback(
    (rawLink: unknown) => {
      const link = rawLink as SimLink;
      const s = typeof link.source === "string" ? link.source : link.source.id;
      const t = typeof link.target === "string" ? link.target : link.target.id;
      const active = activeId ? s === activeId || t === activeId : true;
      const base =
        link.type === "connection"
          ? "rgba(105, 230, 166, 0.32)"
          : link.type === "match"
            ? "rgba(148, 163, 184, 0.28)"
            : "rgba(120, 130, 150, 0.14)";
      if (!activeId) return base;
      if (!active) return "rgba(148, 163, 184, 0.05)";
      return base.replace(/[\d.]+\)/, "0.9)");
    },
    [activeId],
  );

  const handleNodeClick = useCallback(
    (rawNode: unknown) => {
      const node = rawNode as GraphNode;
      if (node.type === "person" && node.id !== viewerId) {
        onSelectPerson(node.id);
        return;
      }
      setHoverId(node.id);
    },
    [onSelectPerson, viewerId],
  );

  const handleSearchSubmit = useCallback(() => {
    const match = searchMatches[0];
    if (!match || !graphRef.current) return;
    const node = (data?.nodes.find((n) => n.id === match.id) as SimNode | undefined) ?? null;
    if (!node) return;
    graphRef.current.centerAt(node.x ?? 0, node.y ?? 0, 600);
    graphRef.current.zoom(3.5, 600);
    setHoverId(match.id);
  }, [data, searchMatches]);

  const zoomBy = useCallback((delta: number) => {
    if (!graphRef.current) return;
    graphRef.current.zoom(graphRef.current.zoom() * delta, 300);
  }, []);

  const zoomToFit = useCallback(() => {
    graphRef.current?.centerAt(0, 0, 500);
    graphRef.current?.zoomToFit(600, 60);
  }, []);

  const hovered = activeId ? data?.nodes.find((node) => node.id === activeId) ?? null : null;
  const hoveredIsPerson = hovered?.type === "person";
  const hoveredCommunity = hovered?.group && COMMUNITY_LABELS[hovered.group];
  const hoveredRelation = hovered && viewerId && hovered.id !== viewerId
    ? relationLabel(hovered.id, viewerId, layout.rings.get(hovered.id) ?? null)
    : null;

  // Which communities actually show up? Only include them in the legend.
  const communitiesInUse = useMemo(() => {
    const seen = new Set<string>();
    for (const node of data?.nodes ?? []) {
      if (node.type === "person" && node.group) seen.add(node.group);
    }
    return [...seen].sort();
  }, [data]);

  return (
    <div className="nx-graph-panel">
      <p className="nx-graph-legend-line">
        You're in the center. Everyone else spreads out by how directly you're connected — closer means fewer steps between you.
      </p>
      <div ref={containerRef} className="nx-graph" style={style}
        onMouseMove={(event) => setCursor({ x: event.clientX, y: event.clientY })}
        onMouseLeave={() => { setCursor(null); setHoverId(null); }}>
        <div className="nx-graph-controls">
          <label className="nx-graph-search">
            <Search size={15} aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearchSubmit();
              }}
              placeholder="Find a person"
              aria-label="Search the graph"
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={13} />
              </button>
            )}
          </label>
          <button
            className={`nx-graph-topics ${showTopics ? "is-active" : ""}`}
            aria-pressed={showTopics}
            onClick={() => setShowTopics((current) => !current)}
          >
            Show topics
          </button>
          <div className="nx-graph-zoom" role="group" aria-label="Zoom">
            <button aria-label="Zoom out" onClick={() => zoomBy(0.8)}>
              <Minus size={14} />
            </button>
            <button aria-label="Center on you" onClick={zoomToFit}>
              <Maximize2 size={14} />
            </button>
            <button aria-label="Zoom in" onClick={() => zoomBy(1.25)}>
              <Plus size={14} />
            </button>
          </div>
        </div>
        {error && <div className="nx-graph-error" role="alert">Couldn’t load the graph: {error}</div>}
        {data && size.width > 0 && (
          <ForceGraph2D
            ref={graphRef}
            graphData={data}
            width={size.width}
            height={size.height}
            backgroundColor="#0a0b0d"
            nodeRelSize={4}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            linkColor={linkColor}
            linkWidth={(link: unknown) => {
              const type = (link as SimLink).type;
              return type === "connection" ? 1.2 : type === "match" ? 0.9 : 0.5;
            }}
            cooldownTicks={reducedMotion ? 60 : 180}
            warmupTicks={20}
            d3AlphaDecay={0.03}
            d3VelocityDecay={0.4}
            onNodeHover={(node: unknown) => setHoverId(node ? (node as GraphNode).id : null)}
            onNodeClick={handleNodeClick}
            onBackgroundClick={() => setHoverId(null)}
            enableNodeDrag={false}
          />
        )}
        {hovered && cursor && hoveredIsPerson && (
          <div className="nx-graph-hover" style={{ left: Math.min(cursor.x + 14, size.width + 300), top: cursor.y + 14 }} role="status">
            <strong>{hovered.id === viewerId ? "You" : hovered.label}</strong>
            {hovered.role && <span>{hovered.role}</span>}
            {hoveredCommunity && <em>{hoveredCommunity}</em>}
            {hoveredRelation && <small>{hoveredRelation}</small>}
          </div>
        )}
        <footer className="nx-graph-footer">
          <div className="nx-graph-legend" aria-label="Legend">
            <span><i className="nx-legend-dot" style={{ background: VIEWER_COLOR }} /> You</span>
            <span><i className="nx-legend-line nx-legend-line-connection" /> Connected</span>
            <span><i className="nx-legend-line nx-legend-line-match" /> Match</span>
            {communitiesInUse.map((community) => (
              <span key={community}>
                <i className="nx-legend-dot" style={{ background: COMMUNITY_COLORS[community] ?? "#cbd5e1" }} />
                {COMMUNITY_LABELS[community] ?? community}
              </span>
            ))}
          </div>
          {data && (
            <small className="nx-graph-counts">
              {data.meta.counts.people} people · {data.meta.counts.connections} connections · {data.meta.counts.matches} matches · {data.meta.counts.orphans} on the outer ring
            </small>
          )}
        </footer>
      </div>
    </div>
  );
}

function relationLabel(personId: string, viewerId: string, ring: number | null) {
  if (personId === viewerId) return null;
  if (ring === 1) return "Connected to you";
  if (ring === 2) return "A friend of a friend";
  if (ring === 3) return "Three steps away";
  return "Not connected yet";
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);
  return reduced;
}
