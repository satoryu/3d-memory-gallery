import { useEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { EYE_HEIGHT, findNearbyExhibit, moveVisitor, walkingDelta, type GalleryLayout } from './galleryNavigation';

export interface WalkInput {
  keys: Set<string>;
  reset: boolean;
}

interface Props {
  root: RefObject<HTMLDivElement | null>;
  input: WalkInput;
  layout: GalleryLayout;
  active: boolean;
  onActiveChange: (active: boolean) => void;
  onNearbyChange: (index: number) => void;
  onOpenExhibit: (index: number) => void;
}

const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown']);

export default function WalkthroughControls({ root, input, layout, active, onActiveChange, onNearbyChange, onOpenExhibit }: Props) {
  const { camera, gl } = useThree();
  const orientation = useRef({ yaw: 0, pitch: -0.08 });
  const nearby = useRef(-1);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => { input.reset = true; }, [input, layout]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const canvas = gl.domElement;
    let dragging: number | null = null;
    let lastX = 0;
    let lastY = 0;

    const clear = () => {
      input.keys.clear();
      if (dragging !== null && canvas.hasPointerCapture(dragging)) canvas.releasePointerCapture(dragging);
      dragging = null;
    };
    const pause = () => { clear(); onActiveChange(false); };
    const keydown = (event: KeyboardEvent) => {
      // Never steal browser shortcuts, IME input or keys from links/buttons.
      if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.code === 'Escape') { pause(); return; }
      if (event.target !== element || !activeRef.current) return;
      if (MOVEMENT_KEYS.has(event.code)) {
        event.preventDefault();
        input.keys.add(event.code);
      } else if (event.code === 'KeyR') {
        event.preventDefault();
        if (!event.repeat) { clear(); input.reset = true; }
      } else if (event.code === 'Enter' && nearby.current >= 0 && !event.repeat) {
        event.preventDefault();
        onOpenExhibit(nearby.current);
      }
    };
    const keyup = (event: KeyboardEvent) => { input.keys.delete(event.code); };
    const focusout = (event: FocusEvent) => {
      clear();
      if (!(event.relatedTarget instanceof Node) || !element.contains(event.relatedTarget)) pause();
    };
    const visibility = () => { if (document.hidden) pause(); };
    const pointerdown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      element.focus({ preventScroll: true });
      onActiveChange(true);
      dragging = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const pointermove = (event: PointerEvent) => {
      if (dragging !== event.pointerId) return;
      orientation.current.yaw -= (event.clientX - lastX) * 0.003;
      orientation.current.pitch = Math.max(-0.65, Math.min(0.65, orientation.current.pitch - (event.clientY - lastY) * 0.003));
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const pointerup = () => {
      if (dragging !== null && canvas.hasPointerCapture(dragging)) canvas.releasePointerCapture(dragging);
      dragging = null;
    };

    element.addEventListener('keydown', keydown);
    element.addEventListener('keyup', keyup);
    element.addEventListener('focusout', focusout);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    canvas.addEventListener('pointerdown', pointerdown);
    canvas.addEventListener('pointermove', pointermove);
    canvas.addEventListener('pointerup', pointerup);
    canvas.addEventListener('pointercancel', pointerup);
    canvas.addEventListener('lostpointercapture', pointerup);
    return () => {
      clear();
      element.removeEventListener('keydown', keydown);
      element.removeEventListener('keyup', keyup);
      element.removeEventListener('focusout', focusout);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', pointerdown);
      canvas.removeEventListener('pointermove', pointermove);
      canvas.removeEventListener('pointerup', pointerup);
      canvas.removeEventListener('pointercancel', pointerup);
      canvas.removeEventListener('lostpointercapture', pointerup);
    };
  }, [gl, input, root, onActiveChange, onOpenExhibit]);

  useFrame((_, delta) => {
    if (input.reset) {
      camera.position.set(layout.entrance.x, EYE_HEIGHT, layout.entrance.z);
      orientation.current = { yaw: 0, pitch: -0.08 };
      input.reset = false;
    }
    if (active) {
      const down = (...codes: string[]) => Number(codes.some((code) => input.keys.has(code)));
      const seconds = Math.min(delta, 0.05);
      orientation.current.yaw += (down('ArrowLeft', 'KeyQ') - down('ArrowRight', 'KeyE')) * seconds * 1.25;
      orientation.current.pitch = Math.max(-0.65, Math.min(0.65, orientation.current.pitch + (down('PageUp') - down('PageDown')) * seconds));
      const movement = walkingDelta(down('KeyW', 'ArrowUp') - down('KeyS', 'ArrowDown'), down('KeyD') - down('KeyA'), orientation.current.yaw, seconds);
      const next = moveVisitor(camera.position.x, camera.position.z, movement.x, movement.z, layout);
      camera.position.set(next.x, EYE_HEIGHT, next.z);
    }
    camera.rotation.set(orientation.current.pitch, orientation.current.yaw, 0, 'YXZ');
    const index = findNearbyExhibit(camera.position.x, camera.position.z, orientation.current.yaw, layout.positions);
    if (index !== nearby.current) {
      nearby.current = index;
      onNearbyChange(index);
    }
  });
  return null;
}