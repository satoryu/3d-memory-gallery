import { Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Html, Lightformer, useGLTF, MeshReflectorMaterial } from '@react-three/drei';
import { Box3, Object3D, Vector3 } from 'three';

// Glass case interior: 1m × 1.2m × 1m sitting on top of a 0.5m pedestal.
// Per-axis fit uses Y's taller allowance (1.2m) so narrow-tall models can
// actually use that headroom. 0.02m padding per side keeps the model from
// visibly intersecting the glass.
const PEDESTAL_TOP_Y = 0.5;
const CASE_FIT_X = 0.96;
const CASE_FIT_Y = 1.16;
const CASE_FIT_Z = 0.96;

const CASE_H = 1.2;
const CASE_CENTER_Y = PEDESTAL_TOP_Y + CASE_H / 2;
const SPACING = 3.2;
const WALL_H = 3.8;

// Shared palette for the museum hall
const BRASS = '#9c7c46';
const DARK_TRIM = '#241f19';
const WALL = '#c9bfae';

interface BrassProps {
  position: [number, number, number];
  args: [number, number, number];
}

function BrassBar({ position, args }: BrassProps) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.35} />
    </mesh>
  );
}

export interface ExhibitSummary {
  slug: string;
  title: string;
  modelUrl: string;
  detailUrl: string;
}

interface GalleryProps {
  exhibits: ExhibitSummary[];
}

// Brass edge frame around the 1 × 1.2 × 1 glass volume, plus a solid lid.
function CaseFrame() {
  const t = 0.035;
  const yTop = PEDESTAL_TOP_Y + CASE_H - t / 2;
  const yBottom = PEDESTAL_TOP_Y + t / 2;
  return (
    <group>
      {[-0.5, 0.5].map((x) =>
        [-0.5, 0.5].map((z) => (
          <BrassBar key={`post${x}${z}`} position={[x, CASE_CENTER_Y, z]} args={[t, CASE_H, t]} />
        )),
      )}
      {[yBottom, yTop].map((y) => (
        <group key={`rails${y}`}>
          <BrassBar position={[0, y, -0.5]} args={[1 + t, t, t]} />
          <BrassBar position={[0, y, 0.5]} args={[1 + t, t, t]} />
          <BrassBar position={[-0.5, y, 0]} args={[t, t, 1 + t]} />
          <BrassBar position={[0.5, y, 0]} args={[t, t, 1 + t]} />
        </group>
      ))}
      {/* Lid */}
      <mesh position={[0, PEDESTAL_TOP_Y + CASE_H + 0.02, 0]} castShadow>
        <boxGeometry args={[1.08, 0.04, 1.08]} />
        <meshStandardMaterial color={DARK_TRIM} metalness={0.5} roughness={0.45} />
      </mesh>
    </group>
  );
}

// Ceiling-mounted spotlight aimed at the display case, with a visible fixture.
function CaseSpotlight() {
  const target = useMemo(() => new Object3D(), []);
  return (
    <group>
      <primitive object={target} position={[0, PEDESTAL_TOP_Y + 0.4, 0]} />
      <spotLight
        position={[0, WALL_H - 0.2, 0]}
        target={target}
        angle={0.5}
        penumbra={0.7}
        intensity={150}
        distance={12}
        decay={1.6}
        color="#ffe9c8"
      />
      {/* Fixture housing */}
      <mesh position={[0, WALL_H - 0.08, 0]}>
        <cylinderGeometry args={[0.11, 0.15, 0.16, 20]} />
        <meshStandardMaterial color="#1c1915" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, WALL_H - 0.165, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.09, 20]} />
        <meshBasicMaterial color="#ffe9c4" toneMapped={false} />
      </mesh>
    </group>
  );
}

// Angled caption stand in front of the pedestal, styled like a museum placard.
function Placard({ exhibit }: { exhibit: ExhibitSummary }) {
  return (
    <group position={[0, 0, 0.95]}>
      <mesh position={[0, 0.31, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.04, 0.62, 12]} />
        <meshStandardMaterial color="#33302b" metalness={0.7} roughness={0.35} />
      </mesh>
      <group position={[0, 0.64, 0]} rotation={[-0.5, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.56, 0.36, 0.025]} />
          <meshStandardMaterial color={DARK_TRIM} metalness={0.5} roughness={0.4} />
        </mesh>
        <Html position={[0, 0, 0.014]} center transform distanceFactor={1} occlude>
          <a
            href={exhibit.detailUrl}
            style={{
              display: 'block',
              width: '150px',
              padding: '10px 12px',
              background: 'linear-gradient(#faf6ec, #eee5d2)',
              color: '#2a251d',
              border: '1px solid #b9a97f',
              borderRadius: '2px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
              textDecoration: 'none',
              textAlign: 'center',
              fontFamily: 'Georgia, "Times New Roman", serif',
              backfaceVisibility: 'hidden',
            }}
          >
            <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, letterSpacing: '0.02em' }}>
              {exhibit.title}
            </span>
            <span style={{ display: 'block', fontSize: '9px', marginTop: '5px', color: '#8a7d63', letterSpacing: '0.1em' }}>
              詳しく見る →
            </span>
          </a>
        </Html>
      </group>
    </group>
  );
}

function Showcase({ exhibit, position }: { exhibit: ExhibitSummary; position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Pedestal: base plinth, stone body, top cap */}
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.38, 0.06, 1.38]} />
        <meshStandardMaterial color="#1b1815" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.26, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.16, 0.42, 1.16]} />
        <meshStandardMaterial color="#302b25" roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.28, 0.04, 1.28]} />
        <meshStandardMaterial color="#463e33" roughness={0.4} metalness={0.2} />
      </mesh>

      <ExhibitModel url={exhibit.modelUrl} />

      {/* Glass case */}
      <mesh position={[0, CASE_CENTER_Y, 0]}>
        <boxGeometry args={[1, CASE_H, 1]} />
        <meshPhysicalMaterial
          transparent
          opacity={0.12}
          roughness={0.05}
          metalness={0}
          transmission={0.92}
          thickness={0.02}
          color="#dfeef0"
        />
      </mesh>
      <CaseFrame />
      <CaseSpotlight />
      <Placard exhibit={exhibit} />
    </group>
  );
}

function ExhibitModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  const { object, scale, position } = useMemo(() => {
    const cloned = scene.clone(true);
    const box = new Box3().setFromObject(cloned);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const s = Math.min(CASE_FIT_X / size.x, CASE_FIT_Y / size.y, CASE_FIT_Z / size.z);
    return {
      object: cloned,
      scale: s,
      position: [
        -center.x * s,
        PEDESTAL_TOP_Y - box.min.y * s,
        -center.z * s,
      ] as [number, number, number],
    };
  }, [scene]);

  return <primitive object={object} scale={scale} position={position} />;
}

// The museum hall: polished stone floor, panelled walls with trim, corner
// columns, and a ceiling with a soft central light cove. Walls and ceiling
// are single-sided facing inward, so orbiting outside gives a cutaway view
// instead of a black box.
function MuseumRoom({ width, depth }: { width: number; depth: number }) {
  const halfW = width / 2;
  const halfD = depth / 2;

  const walls: { pos: [number, number, number]; rotY: number; len: number }[] = [
    { pos: [0, WALL_H / 2, -halfD], rotY: 0, len: width },
    { pos: [0, WALL_H / 2, halfD], rotY: Math.PI, len: width },
    { pos: [-halfW, WALL_H / 2, 0], rotY: Math.PI / 2, len: depth },
    { pos: [halfW, WALL_H / 2, 0], rotY: -Math.PI / 2, len: depth },
  ];

  const corners: [number, number][] = [
    [-halfW + 0.25, -halfD + 0.25],
    [halfW - 0.25, -halfD + 0.25],
    [-halfW + 0.25, halfD - 0.25],
    [halfW - 0.25, halfD - 0.25],
  ];

  return (
    <group>
      {/* Polished stone floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <MeshReflectorMaterial
          blur={[220, 60]}
          resolution={1024}
          mixBlur={0.9}
          mixStrength={7}
          mirror={0.55}
          roughness={0.6}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          color="#2b2620"
          metalness={0.25}
        />
      </mesh>

      {walls.map(({ pos, rotY, len }, i) => (
        <group key={i} position={pos} rotation={[0, rotY, 0]}>
          {/* Wall */}
          <mesh receiveShadow>
            <planeGeometry args={[len, WALL_H]} />
            <meshStandardMaterial color={WALL} roughness={0.95} />
          </mesh>
          {/* Baseboard */}
          <mesh position={[0, -WALL_H / 2 + 0.09, 0.03]}>
            <boxGeometry args={[len, 0.18, 0.05]} />
            <meshStandardMaterial color={DARK_TRIM} roughness={0.7} />
          </mesh>
          {/* Picture rail */}
          <mesh position={[0, 0.85, 0.02]}>
            <boxGeometry args={[len, 0.06, 0.035]} />
            <meshStandardMaterial color="#a3947c" roughness={0.8} />
          </mesh>
          {/* Crown moulding */}
          <mesh position={[0, WALL_H / 2 - 0.07, 0.035]}>
            <boxGeometry args={[len, 0.14, 0.06]} />
            <meshStandardMaterial color="#b5a88f" roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* Corner columns */}
      {corners.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.15, 0]} castShadow>
            <boxGeometry args={[0.56, 0.3, 0.56]} />
            <meshStandardMaterial color="#8f8271" roughness={0.85} />
          </mesh>
          <mesh position={[0, WALL_H / 2, 0]} castShadow>
            <boxGeometry args={[0.42, WALL_H, 0.42]} />
            <meshStandardMaterial color="#b0a48f" roughness={0.9} />
          </mesh>
          <mesh position={[0, WALL_H - 0.12, 0]} castShadow>
            <boxGeometry args={[0.56, 0.24, 0.56]} />
            <meshStandardMaterial color="#9d9080" roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* Ceiling with a soft central light cove */}
      <mesh position={[0, WALL_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#d8d1c2" roughness={1} />
      </mesh>
      <mesh position={[0, WALL_H - 0.015, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width * 0.45, depth * 0.45]} />
        <meshBasicMaterial color="#f3e9d4" toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function Gallery({ exhibits }: GalleryProps) {
  const count = Math.max(exhibits.length, 1);
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const roomW = Math.max(cols * SPACING + 6, 12);
  const roomD = Math.max(rows * SPACING + 6, 10);

  // Prefetch all GLBs before rendering the Canvas so navigating back lands
  // on cached models instead of hitting suspension again.
  useEffect(() => {
    exhibits.forEach((e) => useGLTF.preload(e.modelUrl));
  }, [exhibits]);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Canvas
        shadows
        frameloop="always"
        camera={{ position: [0, 2.2, Math.min(roomD / 2 - 0.6, 6)], fov: 55 }}
      >
        <color attach="background" args={['#0e0c0a']} />
        <ambientLight intensity={0.22} color="#fff1e0" />
        <directionalLight
          position={[5, 9, 4]}
          intensity={0.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
        />
        {/* Locally generated environment map (no CDN fetch): a warm ceiling
            glow plus side fills, so glass and brass pick up gallery-like
            reflections even offline. */}
        <Environment resolution={128}>
          <Lightformer intensity={2.4} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} color="#fff2dc" />
          <Lightformer intensity={0.8} position={[-5, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#d8c9ae" />
          <Lightformer intensity={0.8} position={[5, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} color="#d8c9ae" />
        </Environment>
        <Suspense fallback={null}>
          {exhibits.map((exhibit, i) => {
            const x = ((i % cols) - (cols - 1) / 2) * SPACING;
            const z = (Math.floor(i / cols) - (rows - 1) / 2) * SPACING;
            return <Showcase key={exhibit.slug} exhibit={exhibit} position={[x, 0, z]} />;
          })}
        </Suspense>
        <MuseumRoom width={roomW} depth={roomD} />
        <OrbitControls
          enablePan={false}
          target={[0, 1.1, 0]}
          minDistance={2.5}
          maxDistance={16}
          maxPolarAngle={Math.PI / 2.05}
        />
      </Canvas>
    </div>
  );
}
