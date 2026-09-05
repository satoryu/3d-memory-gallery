import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace } from 'three';

interface Props {
  lines: string[];
  width: number;
  height: number;
  fontSize?: number;
  background?: string;
  color?: string;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}

// HTML overlays are not part of WebXR's stereo framebuffer. Rasterise Japanese
// labels using local system fonts so they remain legible in both eyes, offline.
export default function SceneLabel({ lines, width, height, fontSize = 42, background = '#f5f4ec', color = '#363d36', onClick }: Props) {
  const text = lines.join('\n');
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.round(1024 * height / width);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    context.textBaseline = 'top';
    const wrap = (size: number) => {
      context.font = `${size}px "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif`;
      const result: string[] = [];
      for (const paragraph of text.split('\n')) {
        let line = '';
        for (const character of paragraph) {
          if (line && context.measureText(line + character).width > 928) { result.push(line); line = ''; }
          line += character;
        }
        result.push(line);
      }
      return result;
    };
    let size = fontSize;
    let wrapped = wrap(size);
    while (wrapped.length * size * 1.55 > canvas.height - 72 && size > 14) {
      size -= 2;
      wrapped = wrap(size);
    }
    wrapped.forEach((line, index) => context.fillText(line, 48, 36 + index * size * 1.55, 928));
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return map;
  }, [text, width, height, fontSize, background, color]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return (
    <mesh onClick={onClick}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}