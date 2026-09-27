export type Point = { x: number; y: number };
export type Camera = Point & { scale: number };
export function zoomAt(camera: Camera, point: Point, scale: number): Camera {
  const next = Math.max(.35, Math.min(2.5, scale));
  const ratio = next / camera.scale;
  return { x: point.x - (point.x - camera.x) * ratio, y: point.y - (point.y - camera.y) * ratio, scale: next };
}
export function fitCamera(points: Point[], width: number, height: number): Camera {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(450, ...xs) - 80, maxX = Math.max(450, ...xs) + 80;
  const minY = Math.min(320, ...ys) - 65, maxY = Math.max(320, ...ys) + 65;
  const scale = Math.max(.35, Math.min(1.25, width / (maxX - minX), height / (maxY - minY)));
  return { x: width / 2 - (minX + maxX) / 2 * scale, y: height / 2 - (minY + maxY) / 2 * scale, scale };
}
