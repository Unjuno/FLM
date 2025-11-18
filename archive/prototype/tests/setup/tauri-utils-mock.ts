// tauri-utils-mock - tauri.tsのモック（Jest環境でimport.metaを回避するため）

export const safeInvoke = async <T = unknown>(
  cmd: string,
  args?: unknown
): Promise<T | null> => {
  // Tauriアプリが起動している場合は、実際のinvokeを使用
  if (
    typeof window !== 'undefined' &&
    (window as any).__TAURI_INTERNALS__?.invoke
  ) {
    try {
      return await (window as any).__TAURI_INTERNALS__.invoke(cmd, args);
    } catch (error) {
      return null;
    }
  }

  // テスト環境では、デフォルトでnullを返す
  return null;
};

export const isTauriAvailable = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).__TAURI__ !== 'undefined'
  );
};

