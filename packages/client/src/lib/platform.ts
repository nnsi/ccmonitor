/**
 * クライアント側のプラットフォーム抽象化層
 * サーバーのプラットフォームに応じた入力シーケンスを提供
 */

export type PlatformType = 'windows' | 'unix';

export interface PlatformInfo {
  platform: PlatformType;
  isWindows: boolean;
  shell: string;
}

// キャッシュされたプラットフォーム情報
let cachedPlatformInfo: PlatformInfo | null = null;

/**
 * サーバーからプラットフォーム情報を取得
 */
export async function fetchPlatformInfo(): Promise<PlatformInfo> {
  if (cachedPlatformInfo) {
    return cachedPlatformInfo;
  }

  try {
    const response = await fetch('http://localhost:3000/api/platform');
    if (!response.ok) {
      throw new Error('Failed to fetch platform info');
    }
    cachedPlatformInfo = await response.json();
    return cachedPlatformInfo!;
  } catch (error) {
    // デフォルトはUnix（Macを含む）
    console.warn('Failed to fetch platform info, defaulting to unix:', error);
    cachedPlatformInfo = {
      platform: 'unix',
      isWindows: false,
      shell: 'bash',
    };
    return cachedPlatformInfo;
  }
}

/**
 * キャッシュされたプラットフォーム情報を取得（同期的に）
 * fetchPlatformInfoを先に呼び出しておく必要がある
 */
export function getPlatformInfo(): PlatformInfo {
  return cachedPlatformInfo || {
    platform: 'unix',
    isWindows: false,
    shell: 'bash',
  };
}

/**
 * プラットフォームに応じた入力シーケンスを提供
 */
export class InputSequences {
  private isWindows: boolean;

  constructor(platformInfo: PlatformInfo) {
    this.isWindows = platformInfo.isWindows;
  }

  /**
   * Enterキーのシーケンスを取得
   * Windows: Win32 ConPTY形式のエスケープシーケンス
   * Unix: 単純な改行文字
   */
  getEnterSequence(): string[] {
    if (this.isWindows) {
      // Windows ConPTY win32-input-mode のEnterシーケンス
      // ESC [ Vk ; Sc ; Uc ; Kd ; Cs ; Rc _
      // Vk=13(VK_RETURN), Sc=28, Uc=13(\r), Kd=1(keydown), Cs=0, Rc=1
      const WIN32_ENTER_DOWN = '\x1b[13;28;13;1;0;1_';
      const WIN32_ENTER_UP = '\x1b[13;28;13;0;0;1_';
      return [WIN32_ENTER_DOWN, WIN32_ENTER_UP];
    } else {
      // Unix: 単純な改行
      return ['\r'];
    }
  }

  /**
   * テキストを送信してEnterを押すシーケンスを取得
   */
  getTextWithEnter(text: string): string[] {
    return [text, ...this.getEnterSequence()];
  }

  /**
   * 特殊キーのシーケンス（プラットフォーム共通）
   */
  static readonly ESCAPE = '\x1b';
  static readonly CTRL_C = '\x03';
  static readonly CTRL_D = '\x04';
  static readonly TAB = '\t';
}
