import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Html, useGLTF } from '@react-three/drei';

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

      {/* Model placeholder — replaced by <ExhibitModel /> when a GLB exists */}
      <ExhibitModel url={exhibit.modelUrl} fallbackPosition={[0, 0.9, 0]} />

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

      {/* Clickable label */}
      <Html position={[0, 0, 0.7]} center transform distanceFactor={4}>
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
          }}
        >
          {exhibit.title}
        </a>
      </Html>
    </group>
  );
}

function ExhibitModel({ url, fallbackPosition }: { url: string; fallbackPosition: [number, number, number] }) {
  // Graceful fallback: if the GLB is missing, show a cube.
  // useGLTF suspends; wrap call-site in <Suspense>.
  try {
    const gltf = useGLTF(url);
    return <primitive object={gltf.scene.clone()} position={fallbackPosition} scale={0.3} />;
  } catch {
    return (
      <mesh position={fallbackPosition} castShadow>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#8888ff" />
      </mesh>
    );
  }
}

export default function Gallery({ exhibits }: GalleryProps) {
  const cols = Math.ceil(Math.sqrt(Math.max(exhibits.length, 1)));
  const spacing = 2.5;

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Canvas shadows camera={{ position: [0, 3, 6], fov: 50 }}>
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
