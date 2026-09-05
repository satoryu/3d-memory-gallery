export type VRSupport = 'checking' | 'supported' | 'unsupported' | 'insecure' | 'error';

export async function detectVRSupport(secure: boolean, xr?: Pick<XRSystem, 'isSessionSupported'>): Promise<VRSupport> {
  if (!secure) return 'insecure';
  if (!xr) return 'unsupported';
  try {
    return await xr.isSessionSupported('immersive-vr') ? 'supported' : 'unsupported';
  } catch {
    return 'error';
  }
}

export function vrErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'VRの開始が許可されませんでした。ブラウザーの権限設定を確認して、もう一度お試しください。';
  if (name === 'NotSupportedError') return 'この環境では床の高さを取得できる没入型VRを利用できません。対応するヘッドセットとブラウザーをご利用ください。';
  if (name === 'InvalidStateError') return '別のVRセッションが開いている可能性があります。終了してから再度お試しください。';
  return 'VR表示の切り替えに失敗しました。接続を確認して再度お試しください。通常表示は引き続き利用できます。';
}