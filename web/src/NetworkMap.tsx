import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { Profile } from "./types";
import { Avatar } from "./ui";
import "./NetworkMap.css";

type GroupBy = "connections" | "event" | "interest";

interface NetworkMapProps {
  user: Profile;
  people: Profile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  groupBy: GroupBy;
  eventNames: Record<string, string>;
  sharedTopics: Record<string, string[]>;
}

interface Point {
  x: number;
  y: number;
}

interface PositionedPerson extends Point {
  profile: Profile;
  groupKey: string;
}

interface MapGroup extends Point {
  key: string;
  label: string;
  members: PositionedPerson[];
  bounds: Bounds;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Layout {
  self: Point;
  people: PositionedPerson[];
  groups: MapGroup[];
  bounds: Bounds;
}

interface Camera {
  x: number;
  y: number;
  scale: number;
}

const CAMERA_MIN = 0.34;
const CAMERA_MAX = 1.65;
const DENSITY_THRESHOLD = 16;
const COLLAPSE_SCALE = 0.7;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function stablePeople(people: Profile[]) {
  return [...people].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}

function includePoint(bounds: Bounds, point: Point, padding: number): Bounds {
  return {
    minX: Math.min(bounds.minX, point.x - padding),
    minY: Math.min(bounds.minY, point.y - padding),
    maxX: Math.max(bounds.maxX, point.x + padding),
    maxY: Math.max(bounds.maxY, point.y + padding),
  };
}

function makeRadialLayout(people: Profile[]): Layout {
  const self = { x: 0, y: 0 };
  const positioned: PositionedPerson[] = [];
  let offset = 0;
  let ring = 0;

  while (offset < people.length) {
    const radius = 225 + ring * 178;
    const capacity = Math.max(8, Math.floor((Math.PI * 2 * radius) / 170));
    const count = Math.min(capacity, people.length - offset);
    const angleOffset = -Math.PI / 2 + ring * 0.29;

    for (let index = 0; index < count; index += 1) {
      const angle = angleOffset + (Math.PI * 2 * index) / count;
      const profile = people[offset + index];
      positioned.push({
        profile,
        groupKey: "connections",
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * 0.78,
      });
    }

    offset += count;
    ring += 1;
  }

  let bounds: Bounds = { minX: -125, minY: -125, maxX: 125, maxY: 125 };
  for (const person of positioned) bounds = includePoint(bounds, person, 90);

  return {
    self,
    people: positioned,
    groups: [],
    bounds,
  };
}

function firstTopic(profile: Profile, sharedTopics: Record<string, string[]>) {
  const topics = sharedTopics[profile.id] ?? [];
  const sorted = [...topics].filter(Boolean).sort((a, b) => a.localeCompare(b));
  return sorted[0] ?? "Other interests";
}

function makeGroupedLayout(
  people: Profile[],
  groupBy: Exclude<GroupBy, "connections">,
  eventNames: Record<string, string>,
  sharedTopics: Record<string, string[]>,
): Layout {
  const buckets = new Map<string, Profile[]>();

  for (const profile of people) {
    const label = groupBy === "event"
      ? eventNames[profile.id]?.trim() || "Other events"
      : firstTopic(profile, sharedTopics);
    const members = buckets.get(label) ?? [];
    members.push(profile);
    buckets.set(label, members);
  }

  const entries = [...buckets.entries()]
    .map(([label, members]) => ({ label, members: stablePeople(members) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const prepared = entries.map(({ label, members }) => {
    const columns = Math.max(1, Math.ceil(Math.sqrt(members.length)));
    const rows = Math.ceil(members.length / columns);
    return {
      label,
      members,
      columns,
      width: Math.max(300, columns * 172),
      height: 102 + rows * 150,
    };
  });

  const groupColumns = Math.max(1, Math.ceil(Math.sqrt(prepared.length)));
  const columnWidths = Array.from({ length: groupColumns }, () => 0);
  const groupRows = Math.ceil(prepared.length / groupColumns);
  const rowHeights = Array.from({ length: groupRows }, () => 0);

  prepared.forEach((group, index) => {
    const column = index % groupColumns;
    const row = Math.floor(index / groupColumns);
    columnWidths[column] = Math.max(columnWidths[column], group.width);
    rowHeights[row] = Math.max(rowHeights[row], group.height);
  });

  const gapX = 88;
  const gapY = 82;
  const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0)
    + Math.max(0, groupColumns - 1) * gapX;
  const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0)
    + Math.max(0, groupRows - 1) * gapY;
  const columnCenters: number[] = [];
  const rowCenters: number[] = [];
  let cursor = -totalWidth / 2;
  for (const width of columnWidths) {
    columnCenters.push(cursor + width / 2);
    cursor += width + gapX;
  }
  cursor = -totalHeight / 2;
  for (const height of rowHeights) {
    rowCenters.push(cursor + height / 2);
    cursor += height + gapY;
  }

  const groups: MapGroup[] = [];
  const positioned: PositionedPerson[] = [];
  prepared.forEach((group, index) => {
    const column = index % groupColumns;
    const row = Math.floor(index / groupColumns);
    const centerX = columnCenters[column] + 185;
    const centerY = rowCenters[row];
    const groupMembers = group.members.map((profile, memberIndex) => {
      const memberColumn = memberIndex % group.columns;
      const memberRow = Math.floor(memberIndex / group.columns);
      const person: PositionedPerson = {
        profile,
        groupKey: group.label,
        x: centerX + (memberColumn - (group.columns - 1) / 2) * 172,
        y: centerY - group.height / 2 + 116 + memberRow * 150,
      };
      positioned.push(person);
      return person;
    });

    groups.push({
      key: group.label,
      label: group.label,
      x: centerX,
      y: centerY,
      members: groupMembers,
      bounds: {
        minX: centerX - group.width / 2,
        minY: centerY - group.height / 2,
        maxX: centerX + group.width / 2,
        maxY: centerY + group.height / 2,
      },
    });
  });

  const contentMinX = groups.length
    ? Math.min(...groups.map((group) => group.bounds.minX))
    : 0;
  const self = { x: contentMinX - 235, y: 0 };
  let bounds: Bounds = includePoint(
    { minX: self.x, minY: self.y, maxX: self.x, maxY: self.y },
    self,
    120,
  );
  for (const group of groups) {
    bounds = {
      minX: Math.min(bounds.minX, group.bounds.minX - 22),
      minY: Math.min(bounds.minY, group.bounds.minY - 22),
      maxX: Math.max(bounds.maxX, group.bounds.maxX + 22),
      maxY: Math.max(bounds.maxY, group.bounds.maxY + 22),
    };
  }

  return { self, people: positioned, groups, bounds };
}

function getLayout(
  people: Profile[],
  groupBy: GroupBy,
  eventNames: Record<string, string>,
  sharedTopics: Record<string, string[]>,
) {
  const sorted = stablePeople(people);
  return groupBy === "connections"
    ? makeRadialLayout(sorted)
    : makeGroupedLayout(sorted, groupBy, eventNames, sharedTopics);
}

function fitCamera(bounds: Bounds, width: number, height: number): Camera {
  const padding = width < 620 ? 30 : 36;
  const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
  const scale = clamp(
    Math.min(
      (width - padding * 2) / contentWidth,
      (height - padding * 2) / contentHeight,
      1.08,
    ),
    CAMERA_MIN,
    CAMERA_MAX,
  );
  return {
    scale,
    x: width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
    y: height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
  };
}

export function NetworkMap({
  user,
  people,
  selectedId,
  onSelect,
  groupBy,
  eventNames,
  sharedTopics,
}: NetworkMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    captureElement: HTMLElement;
    originX: number;
    originY: number;
    cameraX: number;
    cameraY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickUntil = useRef(0);
  const [isPanning, setIsPanning] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const layout = useMemo(
    () => getLayout(people, groupBy, eventNames, sharedTopics),
    [eventNames, groupBy, people, sharedTopics],
  );
  const layoutKey = [
    user.id,
    groupBy,
    layout.bounds.minX,
    layout.bounds.minY,
    layout.bounds.maxX,
    layout.bounds.maxY,
    ...layout.people.map((person) => `${person.profile.id}@${person.x},${person.y}`),
  ].join(":");
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });

  const fitNetwork = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = fitCamera(layout.bounds, map.clientWidth, map.clientHeight);
    setCamera(next);
    setExpandedGroup(null);
  }, [layout.bounds]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setCamera(fitCamera(layout.bounds, map.clientWidth, map.clientHeight));
    setExpandedGroup(null);
  }, [layoutKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof ResizeObserver === "undefined") return;
    let previousWidth = map.clientWidth;
    let previousHeight = map.clientHeight;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!previousWidth || !previousHeight) {
        previousWidth = width;
        previousHeight = height;
        return;
      }
      const dx = (width - previousWidth) / 2;
      const dy = (height - previousHeight) / 2;
      if (dx || dy) setCamera((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
      previousWidth = width;
      previousHeight = height;
    });
    observer.observe(map);
    return () => observer.disconnect();
  }, []);

  const zoomAt = useCallback((localX: number, localY: number, factor: number) => {
    setCamera((current) => {
      const nextScale = clamp(current.scale * factor, CAMERA_MIN, CAMERA_MAX);
      const ratio = nextScale / current.scale;
      return {
        scale: nextScale,
        x: localX - (localX - current.x) * ratio,
        y: localY - (localY - current.y) * ratio,
      };
    });
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = map.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0013);
      zoomAt(event.clientX - bounds.left, event.clientY - bounds.top, factor);
    };
    map.addEventListener("wheel", handleWheel, { passive: false });
    return () => map.removeEventListener("wheel", handleWheel);
  }, [zoomAt]);

  const zoomFromCenter = (factor: number) => {
    const map = mapRef.current;
    if (!map) return;
    zoomAt(map.clientWidth / 2, map.clientHeight / 2, factor);
  };

  const revealGroup = (group: MapGroup | null) => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = group?.bounds ?? layout.bounds;
    const next = fitCamera(bounds, map.clientWidth, map.clientHeight);
    next.scale = Math.max(next.scale, 0.9);
    next.x = map.clientWidth / 2 - ((bounds.minX + bounds.maxX) / 2) * next.scale;
    next.y = map.clientHeight / 2 - ((bounds.minY + bounds.maxY) / 2) * next.scale;
    setExpandedGroup(group?.key ?? "connections");
    setCamera(next);
  };

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest(".nm-controls")) return;
    const interactiveTarget = (event.target as HTMLElement).closest<HTMLElement>(
      ".nm-person, .nm-cluster",
    );
    const captureElement = interactiveTarget ?? event.currentTarget;
    dragRef.current = {
      pointerId: event.pointerId,
      captureElement,
      originX: event.clientX,
      originY: event.clientY,
      cameraX: camera.x,
      cameraY: camera.y,
      moved: false,
    };
    captureElement.setPointerCapture(event.pointerId);
  };

  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.originX;
    const dy = event.clientY - drag.originY;
    if (!drag.moved && Math.hypot(dx, dy) > 5) {
      drag.moved = true;
      setIsPanning(true);
    }
    if (!drag.moved) return;
    event.preventDefault();
    setCamera((current) => ({
      ...current,
      x: drag.cameraX + dx,
      y: drag.cameraY + dy,
    }));
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) suppressClickUntil.current = performance.now() + 180;
    dragRef.current = null;
    setIsPanning(false);
    if (drag.captureElement.hasPointerCapture(event.pointerId)) {
      drag.captureElement.releasePointerCapture(event.pointerId);
    }
  };

  const selectPerson = (id: string) => {
    if (performance.now() < suppressClickUntil.current) return;
    onSelect(id);
  };

  const selectCluster = (group: MapGroup | null) => {
    if (performance.now() < suppressClickUntil.current) return;
    revealGroup(group);
  };

  const dense = people.length > DENSITY_THRESHOLD && camera.scale < COLLAPSE_SCALE;
  const connectionsCollapsed = dense && expandedGroup !== "connections";
  const cameraStyle = {
    "--nm-x": `${camera.x}px`,
    "--nm-y": `${camera.y}px`,
    "--nm-scale": camera.scale,
    "--nm-node-scale": 1 / camera.scale,
  } as CSSProperties;

  return (
    <div
      ref={mapRef}
      className={`nm-map ${isPanning ? "is-panning" : ""}`}
      role="region"
      aria-label="Interactive connection map"
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    >
      <div className="nm-map-instructions">
        <small>Drag to explore · scroll to zoom</small>
      </div>

      <div className="nm-controls" aria-label="Map controls">
        <div className="nm-zoom-controls" role="group" aria-label="Zoom controls">
          <button type="button" onClick={() => zoomFromCenter(0.82)} aria-label="Zoom out">
            <Minus size={15} aria-hidden="true" />
            <small>Zoom out</small>
          </button>
          <output aria-label="Current zoom">{Math.round(camera.scale * 100)}%</output>
          <button type="button" onClick={() => zoomFromCenter(1.22)} aria-label="Zoom in">
            <Plus size={15} aria-hidden="true" />
            <small>Zoom in</small>
          </button>
        </div>
        <button type="button" className="nm-fit-control" onClick={fitNetwork}>
          <Maximize2 size={14} aria-hidden="true" />
          Fit network
        </button>
      </div>

      <div className="nm-camera" style={cameraStyle}>
        <svg className="nm-edges" width="1" height="1" aria-hidden="true">
          {layout.people.map((person) => (
            <line
              key={person.profile.id}
              className={person.profile.id === selectedId ? "is-selected" : ""}
              x1={layout.self.x}
              y1={layout.self.y}
              x2={person.x}
              y2={person.y}
            />
          ))}
        </svg>

        {layout.groups.map((group) => {
          const collapsed = dense && expandedGroup !== group.key;
          return (
            <div
              className={`nm-group ${collapsed ? "is-collapsed" : ""}`}
              style={{
                left: group.bounds.minX,
                top: group.bounds.minY,
                width: group.bounds.maxX - group.bounds.minX,
                height: group.bounds.maxY - group.bounds.minY,
              }}
              key={group.key}
            >
              <span className="nm-group-label">
                {group.label}
                <small>{group.members.length}</small>
              </span>
            </div>
          );
        })}

        <div
          className="nm-person nm-self"
          style={{ left: layout.self.x, top: layout.self.y }}
          aria-label={`${user.name}, you, ${user.role}`}
        >
          <span className="nm-portrait">
            <Avatar profile={user} size="large" />
            <span className="nm-self-badge" aria-hidden="true">You</span>
          </span>
          <strong>{user.name}</strong>
          <small>{user.role}</small>
        </div>

        {layout.people.map((person) => {
          const groupCollapsed = groupBy === "connections"
            ? connectionsCollapsed
            : dense && expandedGroup !== person.groupKey;
          return (
            <button
              type="button"
              className={`nm-person ${person.profile.id === selectedId ? "is-selected" : ""} ${groupCollapsed ? "is-density-hidden" : ""}`}
              style={{ left: person.x, top: person.y }}
              key={person.profile.id}
              aria-label={`View ${person.profile.name}, ${person.profile.role}`}
              aria-pressed={person.profile.id === selectedId}
              aria-hidden={groupCollapsed || undefined}
              tabIndex={groupCollapsed ? -1 : 0}
              onClick={() => selectPerson(person.profile.id)}
            >
              <span className="nm-portrait">
                <Avatar profile={person.profile} size="large" />
              </span>
              <strong>{person.profile.name}</strong>
              <small>{person.profile.role}</small>
            </button>
          );
        })}

        {dense && groupBy === "connections" && connectionsCollapsed && (
          <button
            type="button"
            className="nm-cluster"
            style={{ left: layout.self.x + 225, top: layout.self.y }}
            onClick={() => selectCluster(null)}
          >
            <strong>{people.length} people</strong>
            <small>Zoom into connections</small>
          </button>
        )}

        {dense && groupBy !== "connections" && layout.groups.map((group) => (
          expandedGroup !== group.key && (
            <button
              type="button"
              className="nm-cluster"
              style={{ left: group.x, top: group.y }}
              key={group.key}
              onClick={() => selectCluster(group)}
              aria-label={`Reveal ${group.members.length} people in ${group.label}`}
            >
              <strong>{group.label}</strong>
              <small>{group.members.length} people · reveal group</small>
            </button>
          )
        ))}
      </div>

    </div>
  );
}
