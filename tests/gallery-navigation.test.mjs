import assert from 'node:assert/strict';
import test from 'node:test';
import { canOccupy, createGalleryLayout, findNearbyExhibit, moveVisitor, PLAYER_RADIUS, walkingDelta, WALK_SPEED } from '../src/components/galleryNavigation.ts';

test('empty, single and large collections have a safe entrance and consistent case obstacles', () => {
  for (const count of [0, 1, 2, 3, 9, 25, 100]) {
    const layout = createGalleryLayout(count);
    assert.equal(layout.positions.length, count);
    assert.equal(layout.obstacles.length, count * 2 + 2);
    assert.ok(canOccupy(layout.entrance.x, layout.entrance.z, layout));
    for (const [x, , z] of layout.positions) assert.equal(canOccupy(x, z, layout), false);
  }
});

test('the visitor cannot cross any wall, even with a very large movement', () => {
  const layout = createGalleryLayout(0);
  for (const [dx, dz] of [[100, 0], [-100, 0], [0, 100], [0, -100]]) {
    const position = moveVisitor(0, 0, dx, dz, layout);
    assert.ok(canOccupy(position.x, position.z, layout));
    assert.ok(Math.abs(position.x) <= layout.width / 2 - PLAYER_RADIUS);
    assert.ok(Math.abs(position.z) <= layout.depth / 2 - PLAYER_RADIUS);
    assert.ok(Math.hypot(position.x, position.z) < 10);
  }
});

test('swept movement stops at a display case and its caption stand', () => {
  const layout = createGalleryLayout(1);
  const front = moveVisitor(0, 3, 0, -6, layout);
  assert.ok(front.z >= 1 + 0.22 + PLAYER_RADIUS);
  const side = moveVisitor(3, 0, -6, 0, layout);
  assert.ok(side.x >= 0.62 + PLAYER_RADIUS);
  assert.ok(canOccupy(front.x, front.z, layout));
  assert.ok(canOccupy(side.x, side.z, layout));
});

test('benches block walking, but unobstructed aisles remain accessible', () => {
  const layout = createGalleryLayout(2);
  const x = layout.width / 2 - 1;
  const stopped = moveVisitor(x, 3, 0, -6, layout);
  assert.ok(stopped.z >= 1.1 + PLAYER_RADIUS);
  const aisle = moveVisitor(0, 3, 0, -6, layout);
  assert.ok(Math.abs(aisle.z + 3) < 0.001);
});

test('diagonal motion slides along a wall without sticking', () => {
  const layout = createGalleryLayout(0);
  const x = layout.width / 2 - PLAYER_RADIUS;
  const position = moveVisitor(x, 2, 1, 1, layout);
  assert.equal(position.x, x);
  assert.ok(position.z > 2.9);
});

test('walking is frame-rate independent, normalized diagonally, and relative to heading', () => {
  const straight = walkingDelta(1, 0, 0, 1 / 60);
  const diagonal = walkingDelta(1, 1, 0, 1 / 60);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - Math.abs(straight.z)) < 1e-9);
  assert.ok(Math.abs(straight.z * 60 + WALK_SPEED) < 1e-9);
  const left = walkingDelta(1, 0, Math.PI / 2, 1 / 60);
  assert.ok(left.x < 0);
  assert.ok(Math.abs(left.z) < 1e-9);
  assert.ok(Math.hypot(...Object.values(walkingDelta(1, 0, 0, 5))) <= WALK_SPEED * 0.05);
  assert.deepEqual(walkingDelta(0, 0, 0, 1 / 60), { x: 0, z: -0 });
});

test('Enter targets only a nearby exhibit in front of the visitor', () => {
  const { positions } = createGalleryLayout(1);
  assert.equal(findNearbyExhibit(0, 2, 0, positions), 0);
  assert.equal(findNearbyExhibit(0, 2, Math.PI, positions), -1);
  assert.equal(findNearbyExhibit(0, 4, 0, positions), -1);
  assert.equal(findNearbyExhibit(0, 2, 0, []), -1);
});