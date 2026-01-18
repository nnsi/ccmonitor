/**
 * プラットフォーム抽象化層
 * Windows/Mac/Linuxで異なる処理を統一的に扱う
 */

export type PlatformType = 'windows' | 'unix';

/**
 * 現在のプラットフォームを取得
 */
export function getPlatform(): PlatformType {
  return process.platform === 'win32' ? 'windows' : 'unix';
}

/**
 * プラットフォームに応じたデフォルトシェルを取得
 */
export function getDefaultShell(): string {
  return getPlatform() === 'windows' ? 'powershell.exe' : 'bash';
}

/**
 * パスを正規化して比較可能な形式にする
 * - Windows: 小文字化 + バックスラッシュ統一
 * - Unix: そのまま
 */
export function normalizePath(path: string): string {
  if (getPlatform() === 'windows') {
    return path.toLowerCase().replace(/\//g, '\\');
  }
  return path;
}

/**
 * 2つのパスが同じかどうか比較
 */
export function pathsEqual(path1: string, path2: string): boolean {
  return normalizePath(path1) === normalizePath(path2);
}

/**
 * プラットフォーム情報を取得（クライアントに送信用）
 */
export function getPlatformInfo() {
  return {
    platform: getPlatform(),
    isWindows: getPlatform() === 'windows',
    shell: getDefaultShell(),
  };
}
