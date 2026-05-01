import { Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Html, useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';

// Glass case interior: 1m × 1.2m × 1m sitting on top of a 0.5m pedestal.
// Per-axis fit uses Y's taller allowance (1.2m) so narrow-tall models can
// actually use that headroom. 0.02m padding per side keeps the model from
// visibly intersecting the glass.
const PEDESTAL_TOP_Y = 0.5;
const CASE_FIT_X = 0.96;
const CASE_FIT_Y = 1.16;
const CASE_FIT_Z = 0.96;

export interface ExhibitSummary {
  slug: string;
  title: string;
  modelUrl: string;
  detailUrl: string;
}

interface GalleryProps {
  exhibits: ExhibitSummary[];
}

function Showcase({ exhibit, position }: { exhibit: ExhibitSummary; position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Pedestal */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.5, 1.2]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.8} />
      </mesh>

      <ExhibitModel url={exhibit.modelUrl} />

      {/* Glass case */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[1, 1.2, 1]} />
        <meshPhysicalMaterial
          transparent
          opacity={0.15}
          roughness={0}
          metalness={0}
          transmission={0.9}
          thickness={0.05}
        />
      </mesh>

      {/* Clickable label — above the case so it clears both the floor and the model */}
      <Html position={[0, 1.9, 0]} center transform distanceFactor={4} occlude>
        <a
          href={exhibit.detailUrl}
          style={{
            display: 'inline-block',
            padding: '0.25rem 0.75rem',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '4px',
            textDecoration: 'none',
            fontSize: '14px',
            whiteSpace: 'nowrap',
            backfaceVisibility: 'hidden',
          }}
        >
          {exhibit.title}
        </a>
      </Html>
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

export default function Gallery({ exhibits }: GalleryProps) {
  const cols = Math.ceil(Math.sqrt(Math.max(exhibits.length, 1)));
  const spacing = 2.5;

  // Prefetch all GLBs before rendering the Canvas so navigating back lands
  // on cached models instead of hitting suspension again.
  useEffect(() => {
    exhibits.forEach((e) => useGLTF.preload(e.modelUrl));
  }, [exhibits]);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Canvas shadows frameloop="always" camera={{ position: [0, 3, 6], fov: 50 }}>
        <color attach="background" args={['#0b0c10']} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
        <Suspense fallback={null}>
          <Environment preset="city" />
          {exhibits.map((exhibit, i) => {
            const x = (i % cols) - (cols - 1) / 2;
            const z = Math.floor(i / cols) - (cols - 1) / 2;
            return (
              <Showcase
                key={exhibit.slug}
                exhibit={exhibit}
                position={[x * spacing, 0, z * spacing]}
              />
            );
          })}
        </Suspense>
        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <OrbitControls enablePan={false} minDistance={3} maxDistance={15} maxPolarAngle={Math.PI / 2.2} />
      </Canvas>
    </div>
  );
}
