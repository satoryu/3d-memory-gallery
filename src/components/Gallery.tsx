import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { XR } from '@react-three/xr';
import { Environment, Html, Lightformer, useGLTF, useProgress } from '@react-three/drei';
import { Box3, Object3D, Vector3 } from 'three';
import MuseumRoom, { WALL_HEIGHT } from './MuseumRoom';
import WalkthroughControls, { type WalkInput } from './WalkthroughControls';
import { createGalleryLayout, EYE_HEIGHT } from './galleryNavigation';
import SceneLabel from './SceneLabel';
import VRGallery from './VRGallery';
import { useVRSession } from './useVRSession';
import './Gallery.css';

// Glass case interior: 1m × 1.2m × 1m sitting on top of a 0.7m pedestal.
// Per-axis fit uses Y's taller allowance (1.2m) so narrow-tall models can
// actually use that headroom. 0.02m padding per side keeps the model from
// visibly intersecting the glass.
const PEDESTAL_TOP_Y = 0.7;
const CASE_FIT_X = 0.96;
const CASE_FIT_Y = 1.16;
const CASE_FIT_Z = 0.96;

const CASE_H = 1.2;
const CASE_CENTER_Y = PEDESTAL_TOP_Y + CASE_H / 2;
const WALL_H = WALL_HEIGHT;

// Shared palette for the museum hall
const BRASS = '#747a72';
const DARK_TRIM = '#383e39';

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
  eventName: string;
  capturedAt: string;
}

interface GalleryProps {
  exhibits: ExhibitSummary[];
}

// Slim, neutral anodised-metal joints around low-iron museum glazing.
function CaseFrame() {
  const t = 0.014;
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
        <boxGeometry args={[1.04, 0.025, 1.04]} />
        <meshStandardMaterial color={BRASS} metalness={0.65} roughness={0.35} />
      </mesh>
    </group>
  );
}

// Ceiling-mounted spotlight aimed at the display case, with a visible fixture.
function CaseSpotlight({ castShadow }: { castShadow: boolean }) {
  const target = useMemo(() => new Object3D(), []);
  return (
    <group>
      <primitive object={target} position={[0, PEDESTAL_TOP_Y + 0.4, 0]} />
      <spotLight
        position={[0, WALL_H - 0.2, 0.35]}
        target={target}
        angle={0.55}
        penumbra={0.7}
        intensity={32}
        distance={7}
        decay={2}
        color="#fff0d7"
        castShadow={castShadow}
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.025}
      />
      {/* Fixture housing */}
      <mesh position={[0, WALL_H - 0.04, 0]}>
        <boxGeometry args={[0.045, 0.04, 1.35]} />
        <meshStandardMaterial color={DARK_TRIM} />
      </mesh>
      <mesh position={[0, WALL_H - 0.13, 0.35]}>
        <cylinderGeometry args={[0.11, 0.15, 0.16, 20]} />
        <meshStandardMaterial color="#1c1915" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, WALL_H - 0.215, 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.09, 20]} />
        <meshBasicMaterial color="#ffe9c4" toneMapped={false} />
      </mesh>
    </group>
  );
}

// Angled caption stand in front of the pedestal, styled like a museum placard.
function Placard({ exhibit, number, immersive }: { exhibit: ExhibitSummary; number: number; immersive: boolean }) {
  return (
    <group position={[0, 0, 1]}>
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <boxGeometry args={[0.45, 0.03, 0.32]} />
        <meshStandardMaterial color={DARK_TRIM} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.43, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.86, 12]} />
        <meshStandardMaterial color="#33302b" metalness={0.7} roughness={0.35} />
      </mesh>
      <group position={[0, 0.89, 0]} rotation={[-0.65, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.62, 0.38, 0.025]} />
          <meshStandardMaterial color={DARK_TRIM} metalness={0.5} roughness={0.4} />
        </mesh>
        {immersive ? (
          <group position={[0, 0, 0.014]}>
            <SceneLabel width={0.59} height={0.35} lines={[
              `${String(number).padStart(2, '0')}　収蔵作品`, exhibit.title, exhibit.eventName,
              `${exhibit.capturedAt} 撮影 ｜ 3D記録`,
            ]} fontSize={62} />
          </group>
        ) : <Html position={[0, 0, 0.014]} center transform distanceFactor={1} occlude>
          <a href={exhibit.detailUrl} className="museum-placard" tabIndex={-1}>
            <span className="museum-placard-number">{String(number).padStart(2, '0')}　収蔵作品</span>
            <strong>{exhibit.title}</strong>
            <span>{exhibit.eventName}</span>
            <span>{exhibit.capturedAt} 撮影 ｜ 3D記録</span>
            <span className="museum-placard-link">作品を鑑賞する ↗</span>
          </a>
        </Html>}
      </group>
    </group>
  );
}

function Showcase({ exhibit, position, number, immersive }: { exhibit: ExhibitSummary; position: [number, number, number]; number: number; immersive: boolean }) {
  return (
    <group position={position}>
      {/* Pedestal: base plinth, stone body, top cap */}
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.08, 0.06, 1.08]} />
        <meshStandardMaterial color="#4a4e48" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.6, 1.2]} />
        <meshStandardMaterial color="#e0dfd7" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.68, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.23, 0.04, 1.23]} />
        <meshStandardMaterial color="#edece4" roughness={0.85} />
      </mesh>

      <Suspense fallback={null}><ExhibitModel url={exhibit.modelUrl} /></Suspense>

      {/* Glass case */}
      <mesh position={[0, CASE_CENTER_Y, 0]}>
        <boxGeometry args={[1, CASE_H, 1]} />
        <meshPhysicalMaterial
          transparent
          opacity={0.1}
          roughness={0.12}
          metalness={0}
          depthWrite={false}
          color="#e1f1eb"
          envMapIntensity={0.65}
        />
      </mesh>
      <CaseFrame />
      <CaseSpotlight castShadow={!immersive && number <= 6} />
      <Placard exhibit={exhibit} number={number} immersive={immersive} />
    </group>
  );
}

function ExhibitModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  const { object, scale, position } = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
    const box = new Box3().setFromObject(cloned);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const s = Math.min(CASE_FIT_X / Math.max(size.x, 0.001), CASE_FIT_Y / Math.max(size.y, 0.001), CASE_FIT_Z / Math.max(size.z, 0.001));
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

// Full-screen overlay shown while GLB assets are downloading. useProgress
// reads drei's shared loading store, so this works outside the Canvas.
// Stays mounted through a short fade-out, and also covers the initial
// mount so there's no flash of an empty room before loading kicks in.
function LoadingOverlay() {
  const { active, progress } = useProgress();
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (active) {
      setMounted(true);
      return;
    }
    // Small grace period: lets the fade-out play, and auto-dismisses when
    // every model is already cached (loading never activates).
    const timer = setTimeout(() => setMounted(false), 700);
    return () => clearTimeout(timer);
  }, [active]);

  if (!mounted) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '18px',
        background: '#eeeee7',
        color: '#424b40',
        fontFamily: 'inherit',
        opacity: active ? 1 : 0,
        transition: 'opacity 0.6s ease',
        pointerEvents: active ? 'auto' : 'none',
      }}
    >
      <style>{'@keyframes gallery-spin { to { transform: rotate(360deg); } }'}</style>
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          border: `3px solid rgba(156, 124, 70, 0.25)`,
          borderTopColor: BRASS,
          animation: 'gallery-spin 1s linear infinite',
        }}
      />
      <div style={{ fontSize: '15px', letterSpacing: '0.2em' }}>展示を読み込んでいます…</div>
      <div
        style={{
          width: '220px',
          height: '3px',
          background: 'rgba(156, 124, 70, 0.2)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: BRASS,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div style={{ fontSize: '12px', letterSpacing: '0.15em', color: '#8a7d63' }}>
        {Math.round(progress)}%
      </div>
    </div>
  );
}

export default function Gallery({ exhibits }: GalleryProps) {
  const vr = useVRSession();
  const { active: loadingModels } = useProgress();
  const [sceneReady, setSceneReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [nearby, setNearby] = useState(-1);
  const layout = useMemo(() => createGalleryLayout(exhibits.length), [exhibits.length]);
  const input = useMemo<WalkInput>(() => ({ keys: new Set(), reset: true }), []);
  const nearbyExhibit = exhibits[nearby];
  useEffect(() => {
    input.keys.clear();
    setActive(false);
    setNearby(-1);
  }, [vr.immersive, input]);
  const start = () => { root.current?.focus({ preventScroll: true }); setActive(true); };
  const returnToEntrance = () => { input.keys.clear(); input.reset = true; start(); };
  const openExhibit = useCallback((index: number) => {
    const exhibit = exhibits[index];
    if (exhibit) window.location.assign(exhibit.detailUrl);
  }, [exhibits]);

  // Prefetch all GLBs before rendering the Canvas so navigating back lands
  // on cached models instead of hitting suspension again.
  useEffect(() => {
    exhibits.forEach((e) => useGLTF.preload(e.modelUrl));
  }, [exhibits]);

  return (
    <div
      ref={root}
      className="museum-gallery"
      tabIndex={0}
      role="region"
      aria-label="記憶のかたち・3D展示室"
      aria-describedby="museum-help"
      onKeyDown={(event) => {
        if (!vr.immersive && !active && event.target === event.currentTarget && event.code === 'Enter') {
          event.preventDefault(); start();
        }
      }}
    >
      <LoadingOverlay />
      <Canvas
        style={{ position: 'absolute', inset: 0, zIndex: 0 }}
        shadows
        dpr={[1, 1.5]}
        frameloop="always"
        onCreated={() => setSceneReady(true)}
        camera={{ position: [layout.entrance.x, EYE_HEIGHT, layout.entrance.z], fov: 60, near: 0.05, far: Math.max(100, layout.depth * 2) }}
        fallback={<p>3D表示にはWebGLが必要です。「作品目録」から各作品をご覧ください。</p>}
      >
        <XR store={vr.store}>
        <color attach="background" args={['#ecebe5']} />
        <ambientLight intensity={0.65} color="#fff7ea" />
        <hemisphereLight args={['#fffaf0', '#a2957c', 1.1]} />
        <directionalLight
          position={[2, 3.4, 2]}
          intensity={0.7}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-normalBias={0.04}
        />
        {/* Locally generated environment map (no CDN fetch): a warm ceiling
            glow plus side fills, so glass and brass pick up gallery-like
            reflections even offline. */}
        <Environment resolution={128}>
          <Lightformer intensity={1.5} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} color="#fff7ec" />
          <Lightformer intensity={0.8} position={[-5, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#edf0e7" />
          <Lightformer intensity={0.8} position={[5, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} color="#edf0e7" />
        </Environment>
        <Suspense fallback={null}>
          {exhibits.map((exhibit, i) => (
            <Showcase key={exhibit.slug} exhibit={exhibit} position={layout.positions[i]} number={i + 1} immersive={vr.immersive} />
          ))}
        </Suspense>
        <MuseumRoom width={layout.width} depth={layout.depth} immersive={vr.immersive} />
        {vr.immersive ? <VRGallery layout={layout} onExit={() => void vr.exit()} /> : <WalkthroughControls
          root={root}
          input={input}
          layout={layout}
          active={active}
          onActiveChange={setActive}
          onNearbyChange={setNearby}
          onOpenExhibit={openExhibit}
        />}
        </XR>
      </Canvas>
      <div className="museum-hud">
        <header className="museum-header">
          <div className="museum-room-number" aria-hidden="true">01</div>
          <div>
            <p className="museum-eyebrow">3D MEMORY GALLERY / 収蔵展示</p>
            <h1>記憶のかたち</h1>
          </div>
        </header>
        <nav className="museum-toolbar" aria-label="展示室メニュー">
          <button
            type="button"
            disabled={vr.busy || (!vr.immersive && (vr.support !== 'supported' || !sceneReady || loadingModels))}
            onClick={() => void (vr.immersive ? vr.exit() : vr.enter())}
            aria-describedby="museum-vr-info"
          >{vr.busy ? 'VR切り替え中…' : vr.immersive ? 'VRを終了' : vr.support === 'checking' ? 'VR対応を確認中…' : 'VRで鑑賞'}</button>
          <button type="button" onClick={returnToEntrance} disabled={vr.immersive}>入口に戻る</button>
          <details>
            <summary>作品目録 <span aria-hidden="true">＋</span></summary>
            <div className="museum-catalog">
              {exhibits.length === 0 && <p>ただいま展示を準備しています。</p>}
              {exhibits.map((exhibit, i) => (
                <a key={exhibit.slug} href={exhibit.detailUrl}>
                  <span>{String(i + 1).padStart(2, '0')}</span>{exhibit.title}
                </a>
              ))}
            </div>
          </details>
        </nav>
        <div className="museum-vr-info" id="museum-vr-info" role="status">
          {vr.error || (vr.immersive ? 'VR表示中。終了はヘッドセット内のパネル、またはシステムメニューから。' :
            vr.support === 'supported' ? 'VR対応：床の丸いマークを指して移動。周囲の安全を確保して開始してください。' :
            vr.support === 'insecure' ? 'VRにはHTTPS接続が必要です。公開サイトをヘッドセットで開いてください。' :
            vr.support === 'error' ? 'VR対応を確認できませんでした。デバイス接続とブラウザーの権限設定をご確認ください。' :
            vr.support === 'unsupported' ? 'VRはWebXR対応ヘッドセット・ブラウザーで利用できます。' : 'VRデバイスの対応状況を確認しています。')}
        </div>
        {!active && !vr.immersive && (
          <section className="museum-entry" aria-label="ウォークスルーの開始">
            <div className="museum-eyebrow">WELCOME TO THE GALLERY</div>
            <h2>歩いて、記憶をたどる。</h2>
            <p>静かな展示室に、あの日のかたちを。<br />作品のまわりを歩きながら、ご鑑賞ください。</p>
            <button type="button" onClick={start}>館内を歩く <span aria-hidden="true">→</span></button>
            <small className="museum-keyboard-hint">キーボードで移動できます。Escで一時停止。</small>
          </section>
        )}
        {active && !vr.immersive && <div className="museum-crosshair" aria-hidden="true" />}
        <div className="museum-nearby" aria-live="polite">
          {active && !vr.immersive && nearbyExhibit && (
            <a href={nearbyExhibit.detailUrl}><kbd className="museum-keyboard-hint">Enter</kbd> {nearbyExhibit.title} を鑑賞する ↗</a>
          )}
        </div>
        {active && !vr.immersive && (
          <div className="museum-touch" role="group" aria-label="タッチで館内を移動">
            {[
              ['ArrowLeft', '↶', '左を向く'], ['KeyW', '↑', '前へ歩く'], ['ArrowRight', '↷', '右を向く'],
              ['KeyA', '←', '左へ歩く'], ['KeyS', '↓', '後ろへ歩く'], ['KeyD', '→', '右へ歩く'],
            ].map(([code, label, description]) => (
              <button
                type="button" key={code} aria-label={description}
                onPointerDown={(event) => {
                  event.preventDefault();
                  root.current?.focus({ preventScroll: true });
                  event.currentTarget.setPointerCapture(event.pointerId);
                  input.keys.add(code);
                }}
                onPointerUp={() => input.keys.delete(code)}
                onPointerCancel={() => input.keys.delete(code)}
                onLostPointerCapture={() => input.keys.delete(code)}
                onKeyDown={(event) => {
                  if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); input.keys.add(code); }
                }}
                onKeyUp={() => input.keys.delete(code)}
                onBlur={() => input.keys.delete(code)}
              >{label}</button>
            ))}
          </div>
        )}
        <footer className="museum-footer">
          <div className="museum-help" id="museum-help">
            <div className="museum-help-title">館内の歩き方　／　ドラッグでも視点を動かせます</div>
            <div className="museum-keys museum-keyboard-hint">
              <span><kbd>W A S D</kbd> 移動</span>
              <span><kbd>↑ ↓</kbd> 前後 <kbd>← →</kbd> 旋回</span>
              <span><kbd>PgUp / PgDn</kbd> 見上げる・見下ろす</span>
              <span><kbd>R</kbd> 入口 <kbd>Esc</kbd> 停止</span>
            </div>
          </div>
          <div className="museum-status" role="status">{active ? '鑑賞中' : '操作停止中'}　／　{exhibits.length} 作品</div>
        </footer>
      </div>
    </div>
  );
}
