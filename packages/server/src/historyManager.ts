import { promises as fs } from 'fs';
import { existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import type { SessionHistory, SessionStatus } from '@ccmonitor/shared';

// データディレクトリのパス（プロジェクトルートからの相対パス）
const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'sessions.json');

class HistoryManager {
  private history: SessionHistory[] = [];
  private savePromise: Promise<void> | null = null;

  /**
   * 履歴ファイルを読み込む
   * ファイルが存在しない場合は空配列で初期化
   */
  async loadHistory(): Promise<void> {
    try {
      // データディレクトリが存在しない場合は作成
      if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
      }

      // 履歴ファイルが存在しない場合は空配列で初期化
      if (!existsSync(HISTORY_FILE)) {
        this.history = [];
        await this.saveToFile();
        return;
      }

      const data = await fs.readFile(HISTORY_FILE, 'utf-8');
      this.history = JSON.parse(data);
      console.log(`[HistoryManager] Loaded ${this.history.length} sessions from history`);
    } catch (error) {
      console.error('[HistoryManager] Failed to load history:', error);
      this.history = [];
    }
  }

  /**
   * セッションを履歴に保存
   */
  async saveSession(session: SessionHistory): Promise<void> {
    const existingIndex = this.history.findIndex(h => h.id === session.id);

    if (existingIndex >= 0) {
      // 既存のセッションを更新
      this.history[existingIndex] = session;
    } else {
      // 新しいセッションを追加
      this.history.push(session);
    }

    await this.saveToFile();
  }

  /**
   * セッションのステータスを更新
   */
  async updateSessionStatus(
    id: string,
    status: SessionStatus,
    outputSize?: number
  ): Promise<void> {
    const session = this.history.find(h => h.id === id);
    if (session) {
      session.status = status;
      if (outputSize !== undefined) {
        session.outputSize = outputSize;
      }
      await this.saveToFile();
    }
  }

  /**
   * セッションを終了としてマーク
   */
  async endSession(id: string, outputSize?: number): Promise<void> {
    const session = this.history.find(h => h.id === id);
    if (session) {
      session.status = 'completed';
      session.endedAt = new Date().toISOString();
      if (outputSize !== undefined) {
        session.outputSize = outputSize;
      }
      await this.saveToFile();
    }
  }

  /**
   * 履歴を取得
   */
  getHistory(): SessionHistory[] {
    return [...this.history];
  }

  /**
   * 履歴をクリア
   */
  async clearHistory(): Promise<void> {
    this.history = [];
    await this.saveToFile();
    console.log('[HistoryManager] History cleared');
  }

  /**
   * セッションを履歴から削除
   */
  async removeSession(id: string): Promise<void> {
    this.history = this.history.filter(h => h.id !== id);
    await this.saveToFile();
  }

  /**
   * 履歴をファイルに保存（非同期、排他制御付き）
   */
  private async saveToFile(): Promise<void> {
    // 既存の保存処理がある場合は待機
    if (this.savePromise) {
      await this.savePromise;
    }

    this.savePromise = this.doSave();

    try {
      await this.savePromise;
    } finally {
      this.savePromise = null;
    }
  }

  /**
   * 実際のファイル書き込み処理
   */
  private async doSave(): Promise<void> {
    try {
      // データディレクトリが存在しない場合は作成
      if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
      }

      const data = JSON.stringify(this.history, null, 2);
      await fs.writeFile(HISTORY_FILE, data, 'utf-8');
    } catch (error) {
      console.error('[HistoryManager] Failed to save history:', error);
    }
  }
}

export const historyManager = new HistoryManager();
