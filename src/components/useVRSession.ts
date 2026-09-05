import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createXRStore } from '@react-three/xr';
import { detectVRSupport, vrErrorMessage, type VRSupport } from './vrSupport';

export function useVRSession() {
  const [store] = useState(() => createXRStore({
    // Starting immersive VR must always be an explicit user action.
    emulate: false,
    offerSession: false,
    enterGrantedSession: false,
    controller: { grabPointer: false },
    hand: { grabPointer: false, touchPointer: false },
    customSessionInit: { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] },
    foveation: 1,
  }));
  const session = useSyncExternalStore(store.subscribe, () => store.getState().session, () => undefined);
  const [support, setSupport] = useState<VRSupport>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let revision = 0;
    const check = async () => {
      const version = ++revision;
      const result = await detectVRSupport(window.isSecureContext, navigator.xr);
      if (alive.current && version === revision) setSupport(result);
    };
    void check();
    navigator.xr?.addEventListener('devicechange', check);
    return () => {
      alive.current = false;
      revision++;
      navigator.xr?.removeEventListener('devicechange', check);
      // React may immediately re-run effects in development StrictMode. Only
      // destroy on a real unmount, after that re-setup opportunity has passed.
      queueMicrotask(() => {
        if (alive.current) return;
        const current = store.getState().session;
        if (current) void current.end().catch(() => {});
        store.destroy();
      });
    };
  }, [store]);

  const enter = useCallback(async () => {
    if (pending.current || store.getState().session || support !== 'supported') return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      // Call directly in the click's user-activation context (no awaits first).
      const next = await store.enterVR();
      if (!next) throw new Error('VR session was not created');
      if (!alive.current) await next.end();
    } catch (cause) {
      if (alive.current) setError(vrErrorMessage(cause));
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }, [store, support]);

  const exit = useCallback(async () => {
    if (pending.current) return;
    const current = store.getState().session;
    if (!current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try { await current.end(); }
    catch (cause) { if (alive.current) setError(vrErrorMessage(cause)); }
    finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }, [store]);

  return { store, session, immersive: session != null, support, busy, error, enter, exit };
}