import { canOccupy, type GalleryLayout } from './galleryNavigation.ts';

export interface FloorPoint { x: number; z: number }

// Check the landing position of the HEAD, not just the reference-space origin.
// Room-scale tracking can put the visitor some distance from that origin.
export function teleportOrigin(target: FloorPoint, head: FloorPoint, origin: FloorPoint): FloorPoint {
  return { x: target.x - head.x + origin.x, z: target.z - head.z + origin.z };
}

// Rotate around the visitor's current head position to avoid swinging them
// through a showcase when they have moved away from the tracking origin.
export function snapTurnOrigin(head: FloorPoint, origin: FloorPoint, angle: number): FloorPoint {
  const x = origin.x - head.x;
  const z = origin.z - head.z;
  return {
    x: head.x + Math.cos(angle) * x + Math.sin(angle) * z,
    z: head.z - Math.sin(angle) * x + Math.cos(angle) * z,
  };
}

export function createTeleportPoints(layout: GalleryLayout): FloorPoint[] {
  const points: FloorPoint[] = [layout.entrance];
  const add = (point: FloorPoint) => {
    if (canOccupy(point.x, point.z, layout) && points.every((p) => Math.hypot(p.x - point.x, p.z - point.z) > 0.8)) points.push(point);
  };
  // A reachable aisle network, plus explicit viewing points on both sides.
  for (let z = layout.depth / 2 - 1.4; z > -layout.depth / 2 + 0.6; z -= 2) {
    for (let x = -layout.width / 2 + 1.5; x < layout.width / 2 - 0.6; x += 2) add({ x, z });
  }
  for (const [x, , z] of layout.positions) {
    add({ x, z: z + 1.9 });
    add({ x, z: z - 1.6 });
  }
  return points;
}