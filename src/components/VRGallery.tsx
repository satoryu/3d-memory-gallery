import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { XROrigin, useXR } from '@react-three/xr';
import { Group, Vector3 } from 'three';
import { canOccupy, type GalleryLayout } from './galleryNavigation';
import { createTeleportPoints, snapTurnOrigin, teleportOrigin, type FloorPoint } from './vrNavigation';
import SceneLabel from './SceneLabel';

export default function VRGallery({ layout, onExit }: { layout: GalleryLayout; onExit: () => void }) {
  const origin = useRef<Group>(null);
  const panel = useRef<Group>(null);
  const { camera } = useThree();
  const session = useXR((state) => state.session);
  const points = useMemo(() => createTeleportPoints(layout), [layout]);
  const head = useMemo(() => new Vector3(), []);
  const localHead = useMemo(() => new Vector3(), []);
  const initialized = useRef(false);
  const [outside, setOutside] = useState(false);
  const outsideRef = useRef(false);

  useEffect(() => {
    initialized.current = false;
    if (origin.current) {
      origin.current.position.set(layout.entrance.x, 0, layout.entrance.z);
      origin.current.rotation.set(0, 0, 0);
    }
  }, [session, layout]);

  const teleport = (target: FloorPoint) => {
    if (!origin.current || session?.visibilityState !== 'visible' || !canOccupy(target.x, target.z, layout)) return;
    camera.getWorldPosition(head);
    const next = teleportOrigin(target, head, origin.current.position);
    origin.current.position.set(next.x, 0, next.z);
    origin.current.updateMatrixWorld(true);
  };
  const turn = (angle: number) => {
    if (!origin.current || session?.visibilityState !== 'visible') return;
    camera.getWorldPosition(head);
    const next = snapTurnOrigin(head, origin.current.position, angle);
    origin.current.position.set(next.x, 0, next.z);
    origin.current.rotation.y += angle;
    origin.current.updateMatrixWorld(true);
  };

  useFrame((state, _delta, frame) => {
    if (!origin.current || !frame || session?.visibilityState !== 'visible') return;
    // Wait for the first tracked pose before centring the headset at the entry.
    // Never add the desktop 1.6m eye height to the headset's measured height.
    const referenceSpace = state.gl.xr.getReferenceSpace();
    if (!referenceSpace || !frame.getViewerPose(referenceSpace)) return;
    if (!initialized.current) { teleport(layout.entrance); initialized.current = true; }
    camera.getWorldPosition(head);
    const invalid = !canOccupy(head.x, head.z, layout);
    if (invalid !== outsideRef.current) { outsideRef.current = invalid; setOutside(invalid); }
    // Controls stay below the visitor's line of sight, even when seated or
    // physically moving. Do not rotate the view or enforce physical collisions.
    localHead.copy(head);
    origin.current.worldToLocal(localHead);
    if (panel.current) panel.current.position.set(localHead.x, Math.max(0.35, localHead.y - 0.55), localHead.z - 0.9);
  });

  return (
    <>
      <XROrigin ref={origin} position={[layout.entrance.x, 0, layout.entrance.z]}>
        <group ref={panel} position={[0, 1.05, -0.9]} rotation={[-0.35, 0, 0]}>
          <SceneLabel width={0.95} height={0.2} fontSize={45} lines={[
            outside ? '展示物・壁に近づいています。移動マークで戻れます。' : '床の丸いマークを指してトリガー／ピンチで移動',
            '周囲の安全とヘッドセットの境界表示を優先してください。',
          ]} />
          <group position={[-0.36, -0.19, 0]}>
            <SceneLabel width={0.22} height={0.12} fontSize={125} lines={['↶ 30°']} onClick={(e) => { e.stopPropagation(); turn(Math.PI / 6); }} />
          </group>
          <group position={[-0.12, -0.19, 0]}>
            <SceneLabel width={0.22} height={0.12} fontSize={125} lines={['30° ↷']} onClick={(e) => { e.stopPropagation(); turn(-Math.PI / 6); }} />
          </group>
          <group position={[0.12, -0.19, 0]}>
            <SceneLabel width={0.22} height={0.12} fontSize={125} lines={['入口へ']} onClick={(e) => { e.stopPropagation(); teleport(layout.entrance); }} />
          </group>
          <group position={[0.36, -0.19, 0]}>
            <SceneLabel width={0.22} height={0.12} fontSize={125} background="#46583d" color="#ffffff" lines={['VR終了']} onClick={(e) => { e.stopPropagation(); onExit(); }} />
          </group>
        </group>
      </XROrigin>
      {points.map((point, index) => (
        <group key={index} position={[point.x, 0.018, point.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh onClick={(event) => { event.stopPropagation(); teleport(point); }}>
            <circleGeometry args={[0.28, 32]} />
            <meshBasicMaterial color="#637f58" transparent opacity={0.7} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0, 0.002]} pointerEvents="none">
            <ringGeometry args={[0.23, 0.25, 32]} />
            <meshBasicMaterial color="#f2f6e9" />
          </mesh>
        </group>
      ))}
    </>
  );
}