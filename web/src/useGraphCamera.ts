import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { fitCamera, zoomAt, type Camera, type Point } from './graphCamera';

export function useGraphCamera(points: Point[], onMoveNode: (id: string, delta: Point) => void, onSelect: (id: string) => void) {
  const stage = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const current = useRef(camera);
  const pointsRef = useRef(points); pointsRef.current = points;
  const animation = useRef(0);
  const hoverOrigin = useRef<Camera | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const drag = useRef<{ id: string | null; moved: boolean; start: Point } | null>(null);
  const [dragging, setDragging] = useState(false);
  const update = useCallback((next: Camera) => { current.current = next; setCamera(next); }, []);
  const stop = useCallback(() => { cancelAnimationFrame(animation.current); hoverOrigin.current = null; }, []);
  const travel = useCallback((target: Camera, duration = 360, hovering = false) => {
    if (hovering) cancelAnimationFrame(animation.current);
    else stop();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { update(target); return; }
    const from = current.current, start = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration), eased = 1 - Math.pow(1 - t, 4);
      update({ x: from.x + (target.x - from.x) * eased, y: from.y + (target.y - from.y) * eased, scale: from.scale + (target.scale - from.scale) * eased });
      if (t < 1) animation.current = requestAnimationFrame(frame);
    };
    animation.current = requestAnimationFrame(frame);
  }, [stop, update]);
  const fit = useCallback(() => {
    if (stage.current) travel(fitCamera(pointsRef.current, stage.current.clientWidth, stage.current.clientHeight));
  }, [travel]);
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    update(fitCamera(pointsRef.current, node.clientWidth, node.clientHeight));
    const observer = new ResizeObserver(() => { stop(); update(fitCamera(pointsRef.current, node.clientWidth, node.clientHeight)); });
    observer.observe(node);
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); stop();
      const rect = node.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1);
      update(zoomAt(current.current, { x: event.clientX - rect.left, y: event.clientY - rect.top }, current.current.scale * Math.exp(-delta * .002)));
    };
    node.addEventListener('wheel', wheel, { passive: false });
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const resetHover = () => {
      if (!hoverOrigin.current) return;
      const origin = hoverOrigin.current;
      stop(); update(origin);
    };
    const visibility = () => { if (document.hidden) resetHover(); };
    motion.addEventListener('change', resetHover);
    window.addEventListener('blur', resetHover);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      observer.disconnect(); node.removeEventListener('wheel', wheel);
      motion.removeEventListener('change', resetHover);
      window.removeEventListener('blur', resetHover);
      document.removeEventListener('visibilitychange', visibility);
      stop();
    };
  }, [stop, update]);
  function point(event: ReactPointerEvent) { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    stop(); const p = point(event); pointers.current.set(event.pointerId, p);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointers.current.size === 1) drag.current = { id: (event.target as Element).closest<HTMLElement>('[data-node-id]')?.dataset.nodeId ?? null, moved: false, start: p };
    else if (drag.current) drag.current.moved = true;
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) {
      if (event.pointerType !== 'mouse' || event.buttons || pointers.current.size || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const node = event.currentTarget, p = point(event);
      const origin = hoverOrigin.current ?? current.current;
      hoverOrigin.current = origin;
      // Screen-space travel stays small at every zoom; camera gestures adopt
      // the displayed position rather than snapping back to a hidden baseline.
      travel({ ...origin, x: origin.x + (p.x / node.clientWidth - .5) * 20, y: origin.y + (p.y / node.clientHeight - .5) * 20 }, 180, true);
      return;
    }
    const before = [...pointers.current.values()]; const next = point(event);
    pointers.current.set(event.pointerId, next);
    if (pointers.current.size === 2) {
      const after = [...pointers.current.values()];
      const mid = (p: Point[]) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
      const distance = (p: Point[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const a = mid(before), b = mid(after);
      const scaled = zoomAt(current.current, a, current.current.scale * distance(after) / Math.max(1, distance(before)));
      update({ ...scaled, x: scaled.x + b.x - a.x, y: scaled.y + b.y - a.y }); setDragging(true); return;
    }
    if (!drag.current) return;
    if (!drag.current.moved && Math.hypot(next.x - drag.current.start.x, next.y - drag.current.start.y) < 4) return;
    const origin = drag.current.moved ? previous : drag.current.start;
    drag.current.moved = true; setDragging(true);
    const delta = { x: next.x - origin.x, y: next.y - origin.y };
    if (drag.current.id) onMoveNode(drag.current.id, { x: delta.x / current.current.scale, y: delta.y / current.current.scale });
    else update({ ...current.current, x: current.current.x + delta.x, y: current.current.y + delta.y });
  }
  function up(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (event.type === 'pointerup' && drag.current?.id && !drag.current.moved) onSelect(drag.current.id);
    if (pointers.current.size) { drag.current = { id: null, moved: true, start: [...pointers.current.values()][0] }; }
    else { drag.current = null; setDragging(false); }
  }
  function zoom(factor: number) {
    if (stage.current) travel(zoomAt(current.current, { x: stage.current.clientWidth / 2, y: stage.current.clientHeight / 2 }, current.current.scale * factor));
  }
  function focus(p: Point) {
    if (stage.current) { const scale = Math.max(current.current.scale, 1); travel({ x: stage.current.clientWidth / 2 - p.x * scale, y: stage.current.clientHeight / 2 - p.y * scale, scale }); }
  }
  function leave() {
    if (!hoverOrigin.current || pointers.current.size) return;
    travel(hoverOrigin.current, 240, true);
  }
  return { stage, camera, dragging, fit, zoom, focus, down, move, up, leave, pan: (x: number, y: number) => { stop(); update({ ...current.current, x: current.current.x + x, y: current.current.y + y }); } };
}
