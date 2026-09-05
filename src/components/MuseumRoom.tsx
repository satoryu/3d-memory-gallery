import { useEffect, useMemo } from 'react';
import { Html } from '@react-three/drei';
import { DataTexture, RepeatWrapping, RGBAFormat, SRGBColorSpace } from 'three';
import SceneLabel from './SceneLabel';

export const WALL_HEIGHT = 3.6;

// A locally generated oak texture: staggered joints, restrained grain and
// slight board-to-board variation. No image/font/environment CDN is required.
function useOakFloor(width: number, depth: number) {
  const texture = useMemo(() => {
    const size = 256;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const board = Math.floor(x / 32);
        const joint = x % 32 === 0 || (y + (board % 2) * 64) % 128 === 0;
        const grain = Math.sin(x * 2.4 + Math.sin(y * 0.06) * 0.6) * 2;
        const noise = ((x * 73 + y * 137) % 17) / 8 - 1;
        const shade = joint ? -22 : grain + noise + (board % 3) * 3;
        const index = (y * size + x) * 4;
        pixels[index] = 185 + shade;
        pixels[index + 1] = 161 + shade;
        pixels[index + 2] = 125 + shade;
        pixels[index + 3] = 255;
      }
    }
    const map = new DataTexture(pixels, size, size, RGBAFormat);
    map.wrapS = map.wrapT = RepeatWrapping;
    map.repeat.set(width / 3.2, depth / 3.2);
    map.colorSpace = SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  }, [width, depth]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

export function MuseumBench({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.43, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.65, 0.12, 2.2]} />
        <meshStandardMaterial color="#92744f" roughness={0.72} />
      </mesh>
      {[-0.78, 0.78].map((z) => (
        <mesh key={z} position={[0, 0.2, z]} castShadow>
          <boxGeometry args={[0.48, 0.4, 0.09]} />
          <meshStandardMaterial color="#383b38" roughness={0.6} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

export default function MuseumRoom({ width, depth, immersive = false }: { width: number; depth: number; immersive?: boolean }) {
  const oak = useOakFloor(width, depth);
  const halfW = width / 2;
  const halfD = depth / 2;
  const walls: { position: [number, number, number]; rotation: number; length: number }[] = [
    { position: [0, WALL_HEIGHT / 2, -halfD], rotation: 0, length: width },
    { position: [0, WALL_HEIGHT / 2, halfD], rotation: Math.PI, length: width },
    { position: [-halfW, WALL_HEIGHT / 2, 0], rotation: Math.PI / 2, length: depth },
    { position: [halfW, WALL_HEIGHT / 2, 0], rotation: -Math.PI / 2, length: depth },
  ];

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={oak} roughness={0.68} metalness={0.02} />
      </mesh>
      {walls.map(({ position, rotation, length }, i) => (
        <group key={i} position={position} rotation={[0, rotation, 0]}>
          <mesh receiveShadow>
            <planeGeometry args={[length, WALL_HEIGHT]} />
            <meshStandardMaterial color="#ecebe5" roughness={0.98} />
          </mesh>
          {/* Recessed shadow gap and a low aluminium skirting, not ornate trim. */}
          <mesh position={[0, -WALL_HEIGHT / 2 + 0.045, 0.018]}>
            <boxGeometry args={[length, 0.09, 0.025]} />
            <meshStandardMaterial color="#777970" roughness={0.6} metalness={0.3} />
          </mesh>
          <mesh position={[0, WALL_HEIGHT / 2 - 0.1, 0.035]}>
            <boxGeometry args={[length, 0.025, 0.07]} />
            <meshStandardMaterial color="#a5a69e" roughness={0.85} />
          </mesh>
          <mesh position={[0, WALL_HEIGHT / 2 - 0.055, 0.045]}>
            <boxGeometry args={[length - 0.2, 0.025, 0.04]} />
            <meshBasicMaterial color="#fff4db" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, WALL_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#e5e5df" roughness={1} />
      </mesh>

      {/* Diffused ceiling panels and parallel lighting tracks. */}
      {[-width * 0.3, width * 0.3].map((x) => (
        <group key={x} position={[x, WALL_HEIGHT - 0.04, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.65, depth - 1.5]} />
            <meshBasicMaterial color="#fff8e9" toneMapped={false} />
          </mesh>
          <rectAreaLight position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} width={0.65} height={depth - 1.5} intensity={3} color="#fff3df" />
          <mesh position={[x > 0 ? -0.8 : 0.8, -0.06, 0]}>
            <boxGeometry args={[0.045, 0.045, depth - 1]} />
            <meshStandardMaterial color="#474b47" roughness={0.65} />
          </mesh>
        </group>
      ))}
      {/* Ceiling air return slots are small but give the room a human scale. */}
      {[-1, 0, 1].map((i) => (
        <mesh key={i} position={[i * 0.09, WALL_HEIGHT - 0.012, halfD - 1]}>
          <boxGeometry args={[0.025, 0.015, 1.3]} />
          <meshStandardMaterial color="#7d807b" />
        </mesh>
      ))}

      <MuseumBench x={-halfW + 1} />
      <MuseumBench x={halfW - 1} />

      {immersive ? (
        <group position={[0, 2.05, -halfD + 0.025]}>
          <SceneLabel width={3.1} height={1.65} background="#ecebe5" fontSize={68} lines={[
            '3D MEMORY GALLERY · COLLECTION', '記憶のかたち', 'The shape of memories',
            '出会った風景、心に残ったもの。', '日々の記憶を、立体でたどる小さな展示室。',
          ]} />
        </group>
      ) : <Html position={[0, 2.05, -halfD + 0.025]} transform distanceFactor={2} center occlude className="museum-sign-anchor">
        <div className="museum-wall-title" aria-hidden="true">
          <div className="museum-wall-eyebrow">3D MEMORY GALLERY · COLLECTION</div>
          <div className="museum-wall-heading">記憶のかたち</div>
          <div className="museum-wall-english">The shape of memories</div>
          <div className="museum-wall-rule" />
          <p>出会った風景、心に残ったもの。<br />日々の記憶を、立体でたどる小さな展示室。</p>
          <div className="museum-wall-footnote">収蔵展示　／　フォトグラメトリによる記録</div>
        </div>
      </Html>}

      {/* Flush entrance doors and the familiar green emergency-exit sign. */}
      <group position={[0, 0, halfD - 0.035]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 1.15, 0]}>
          <boxGeometry args={[1.85, 2.3, 0.06]} />
          <meshStandardMaterial color="#a7a398" roughness={0.75} />
        </mesh>
        {[-0.45, 0.45].map((x) => (
          <group key={x}>
            <mesh position={[x, 1.13, 0.045]}>
              <boxGeometry args={[0.88, 2.23, 0.03]} />
              <meshStandardMaterial color="#d1c8b8" roughness={0.8} />
            </mesh>
            <mesh position={[x > 0 ? 0.1 : -0.1, 1.05, 0.09]}>
              <boxGeometry args={[0.025, 0.32, 0.04]} />
              <meshStandardMaterial color="#6c716c" metalness={0.8} roughness={0.25} />
            </mesh>
          </group>
        ))}
        {immersive ? (
          <group position={[0, 2.6, 0.06]}>
            <SceneLabel width={0.65} height={0.18} background="#28794d" color="#ffffff" fontSize={100} lines={['← 非常口 EXIT']} />
          </group>
        ) : <Html position={[0, 2.6, 0.06]} transform center distanceFactor={1} occlude className="museum-sign-anchor">
          <div className="museum-exit-sign" aria-hidden="true">←　非常口 <small>EXIT</small></div>
        </Html>}
      </group>
    </group>
  );
}