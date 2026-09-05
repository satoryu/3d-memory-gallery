export const EYE_HEIGHT = 1.6;
export const WALK_SPEED = 1.65;
export const PLAYER_RADIUS = 0.25;
const SPACING = 3.4;

export interface Obstacle {
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
}

export function createGalleryLayout(count: number) {
  const columns = Math.ceil(Math.sqrt(Math.max(count, 1)));
  const rows = Math.ceil(Math.max(count, 1) / columns);
  const width = Math.max(columns * SPACING + 6, 12);
  const depth = Math.max(rows * SPACING + 6, 10);
  const positions = Array.from({ length: count }, (_, i): [number, number, number] => [
    ((i % columns) - (columns - 1) / 2) * SPACING,
    0,
    (Math.floor(i / columns) - (rows - 1) / 2) * SPACING,
  ]);
  const obstacles: Obstacle[] = positions.flatMap(([x, , z]) => [
    { x, z, halfWidth: 0.62, halfDepth: 0.62 },
    // Caption stand, including its sloping panel and base.
    { x, z: z + 1, halfWidth: 0.32, halfDepth: 0.22 },
  ]);
  for (const x of [-width / 2 + 1, width / 2 - 1]) {
    obstacles.push({ x, z: 0, halfWidth: 0.325, halfDepth: 1.1 });
  }
  return { width, depth, positions, obstacles, entrance: { x: 0, z: depth / 2 - 1.4 } };
}

export type GalleryLayout = ReturnType<typeof createGalleryLayout>;

export function canOccupy(x: number, z: number, layout: GalleryLayout) {
  if (Math.abs(x) > layout.width / 2 - PLAYER_RADIUS || Math.abs(z) > layout.depth / 2 - PLAYER_RADIUS) return false;
  return !layout.obstacles.some((box) => {
    const dx = Math.max(Math.abs(x - box.x) - box.halfWidth, 0);
    const dz = Math.max(Math.abs(z - box.z) - box.halfDepth, 0);
    return dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS;
  });
}

// Small swept steps avoid tunnelling even after a slow frame; separate axes
// allow sliding alongside a case or wall rather than sticking to it.
export function moveVisitor(x: number, z: number, dx: number, dz: number, layout: GalleryLayout) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (PLAYER_RADIUS / 2)));
  for (let step = 0; step < steps; step++) {
    if (canOccupy(x + dx / steps, z, layout)) x += dx / steps;
    if (canOccupy(x, z + dz / steps, layout)) z += dz / steps;
  }
  return { x, z };
}

export function walkingDelta(forward: number, strafe: number, yaw: number, seconds: number) {
  const magnitude = Math.max(1, Math.hypot(forward, strafe));
  const distance = WALK_SPEED * Math.min(seconds, 0.05) / magnitude;
  return {
    x: (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * distance,
    z: (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * distance,
  };
}

export function findNearbyExhibit(x: number, z: number, yaw: number, positions: GalleryLayout['positions']) {
  let nearest = -1;
  let bestDistance = 2.6;
  positions.forEach(([px, , pz], index) => {
    const dx = px - x;
    const dz = pz - z;
    const distance = Math.hypot(dx, dz);
    const facing = (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / Math.max(distance, 0.001);
    if (distance < bestDistance && facing > 0.5) {
      nearest = index;
      bestDistance = distance;
    }
  });
  return nearest;
}