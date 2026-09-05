import assert from 'node:assert/strict';
import test from 'node:test';
import { canOccupy, createGalleryLayout } from '../src/components/galleryNavigation.ts';
import { createTeleportPoints, snapTurnOrigin, teleportOrigin } from '../src/components/vrNavigation.ts';
import { detectVRSupport, vrErrorMessage } from '../src/components/vrSupport.ts';

test('VR requires a secure context and never probes XR over insecure HTTP', async () => {
  assert.equal(await detectVRSupport(false, { isSessionSupported() { throw new Error('should not be called'); } }), 'insecure');
  assert.equal(await detectVRSupport(true), 'unsupported');
});

test('VR probes immersive-vr without requesting a session', async () => {
  let mode;
  assert.equal(await detectVRSupport(true, { async isSessionSupported(value) { mode = value; return true; } }), 'supported');
  assert.equal(mode, 'immersive-vr');
  assert.equal(await detectVRSupport(true, { async isSessionSupported() { return false; } }), 'unsupported');
});

test('support probe rejection becomes an informative unavailable state', async () => {
  assert.equal(await detectVRSupport(true, { async isSessionSupported() { throw new Error('permission'); } }), 'error');
});

test('session errors provide actionable messages without leaking raw errors', () => {
  const error = (name) => Object.assign(new Error('private device information'), { name });
  assert.match(vrErrorMessage(error('NotAllowedError')), /許可/);
  assert.match(vrErrorMessage(error('SecurityError')), /権限/);
  assert.match(vrErrorMessage(error('NotSupportedError')), /床の高さ/);
  assert.match(vrErrorMessage(error('InvalidStateError')), /別のVRセッション/);
  assert.match(vrErrorMessage(null), /通常表示/);
  assert.doesNotMatch(vrErrorMessage(error('UnknownError')), /private/);
});

test('all teleport targets avoid walls, cases, captions and benches', () => {
  for (const count of [0, 1, 2, 9, 25, 100]) {
    const layout = createGalleryLayout(count);
    const points = createTeleportPoints(layout);
    assert.ok(points.length > 1);
    assert.deepEqual(points[0], layout.entrance);
    for (const p of points) assert.ok(canOccupy(p.x, p.z, layout));
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) assert.ok(Math.hypot(points[i].x - points[j].x, points[i].z - points[j].z) > 0.8);
    }
  }
});

test('teleport places an offset room-scale headset exactly at the target', () => {
  const origin = { x: 1, z: 3 };
  const head = { x: 1.7, z: 2.6 };
  const target = { x: -2, z: -1 };
  const next = teleportOrigin(target, head, origin);
  assert.ok(Math.abs(next.x + head.x - origin.x - target.x) < 1e-9);
  assert.ok(Math.abs(next.z + head.z - origin.z - target.z) < 1e-9);
});

test('snap turn rotates around the headset without translating its world position', () => {
  const origin = { x: 1, z: 3 };
  const head = { x: 1.7, z: 2.6 };
  for (const angle of [Math.PI / 6, -Math.PI / 6, Math.PI]) {
    const next = snapTurnOrigin(head, origin, angle);
    const dx = head.x - origin.x;
    const dz = head.z - origin.z;
    assert.ok(Math.abs(next.x + Math.cos(angle) * dx + Math.sin(angle) * dz - head.x) < 1e-9);
    assert.ok(Math.abs(next.z - Math.sin(angle) * dx + Math.cos(angle) * dz - head.z) < 1e-9);
  }
});