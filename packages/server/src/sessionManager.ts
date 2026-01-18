import * as pty from 'node-pty';
import { randomUUID } from 'crypto';
import type { SessionHistory } from '@ccmonitor/shared';

export type SessionStatus = 'running' | 'waiting' | 'completed';

export interface Session {
  id: string;
  cwd: string;
  status: SessionStatus;
  createdAt: Date;
  pty: pty.IPty;
}

export interface SessionInfo {
  id: string;
  cwd: string;
  status: SessionStatus;
  createdAt: string;
}

// ターミナル出力バッファの最大サイズ（50KB）
const MAX_BUFFER_SIZE = 50 * 1024;

class SessionManager {
  private sessions = new Map<string, Session>();
  private onDataCallbacks = new Map<string, (data: string) => void>();
  private onExitCallbacks = new Map<string, (code: number) => void>();
  // ターミナル出力をバッファリング（再接続時に復元するため）
  private outputBuffers = new Map<string, string>();

  /**
   * 新しいセッションを作成し、Claude Codeを起動
   */
  createSession(cwd: string): Session {
    const id = randomUUID();
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: cwd,
      env: process.env as { [key: string]: string },
    });

    const session: Session = {
      id,
      cwd,
      status: 'running',
      createdAt: new Date(),
      pty: ptyProcess,
    };

    // claude コマンドを自動実行
    ptyProcess.write('claude\r');

    // 出力バッファを初期化
    this.outputBuffers.set(id, '');

    ptyProcess.onData((data) => {
      // バッファに追加（最大サイズを超えたら古いデータを削除）
      let buffer = this.outputBuffers.get(id) || '';
      buffer += data;
      if (buffer.length > MAX_BUFFER_SIZE) {
        buffer = buffer.slice(-MAX_BUFFER_SIZE);
      }
      this.outputBuffers.set(id, buffer);

      const callback = this.onDataCallbacks.get(id);
      if (callback) callback(data);
    });

    ptyProcess.onExit(({ exitCode }) => {
      session.status = 'completed';
      const callback = this.onExitCallbacks.get(id);
      if (callback) callback(exitCode);
    });

    this.sessions.set(id, session);
    return session;
  }

  /**
   * セッションのデータ受信コールバックを登録
   */
  onData(id: string, callback: (data: string) => void): void {
    this.onDataCallbacks.set(id, callback);
  }

  /**
   * セッションの終了コールバックを登録
   */
  onExit(id: string, callback: (code: number) => void): void {
    this.onExitCallbacks.set(id, callback);
  }

  /**
   * セッションにデータを書き込む
   */
  write(id: string, data: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.pty.write(data);
    return true;
  }

  /**
   * セッションのターミナルサイズを変更
   */
  resize(id: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.pty.resize(cols, rows);
    return true;
  }

  /**
   * セッションを削除（ptyをkillしてから削除）
   */
  deleteSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    // ptyプロセスを終了
    session.pty.kill();

    // コールバックとバッファを削除
    this.onDataCallbacks.delete(id);
    this.onExitCallbacks.delete(id);
    this.outputBuffers.delete(id);

    return this.sessions.delete(id);
  }

  /**
   * セッションのターミナル出力バッファを取得
   */
  getOutputBuffer(id: string): string | undefined {
    return this.outputBuffers.get(id);
  }

  /**
   * IDでセッションを取得
   */
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /**
   * 全セッションを取得
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * cwdでセッションを検索
   * Windowsのパスはcase-insensitiveなので、小文字に正規化して比較
   */
  findSessionByCwd(cwd: string): Session | undefined {
    const normalizedCwd = cwd.toLowerCase().replace(/\//g, '\\');
    for (const session of this.sessions.values()) {
      const normalizedSessionCwd = session.cwd.toLowerCase().replace(/\//g, '\\');
      if (normalizedSessionCwd === normalizedCwd) {
        return session;
      }
    }
    return undefined;
  }

  /**
   * ステータスを更新
   */
  updateStatus(id: string, status: SessionStatus): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.status = status;
    return true;
  }

  /**
   * SessionからSessionInfo（シリアライズ可能）に変換
   */
  toSessionInfo(session: Session): SessionInfo {
    return {
      id: session.id,
      cwd: session.cwd,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
    };
  }

  /**
   * SessionからSessionHistory（履歴保存用）に変換
   */
  toSessionHistory(session: Session, endedAt?: string): SessionHistory {
    const outputBuffer = this.outputBuffers.get(session.id) || '';
    return {
      id: session.id,
      cwd: session.cwd,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      endedAt,
      outputSize: outputBuffer.length,
    };
  }
}

export const sessionManager = new SessionManager();
