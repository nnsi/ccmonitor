import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { SessionStatus } from './sessionManager.js';

// 依存性注入用のインターフェース
export interface AppDependencies {
  sessionManager: {
    getAllSessions: () => Array<{ id: string; cwd: string; status: SessionStatus; createdAt: Date; pty: unknown }>;
    createSession: (cwd: string) => { id: string; cwd: string; status: SessionStatus; createdAt: Date; pty: unknown };
    deleteSession: (id: string) => boolean;
    getSession: (id: string) => { id: string; cwd: string; status: SessionStatus; createdAt: Date; pty: unknown } | undefined;
    findSessionByCwd: (cwd: string) => { id: string; cwd: string; status: SessionStatus; createdAt: Date; pty: unknown } | undefined;
    updateStatus: (id: string, status: SessionStatus) => boolean;
    getOutputBuffer: (id: string) => string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toSessionInfo: (session: any) => { id: string; cwd: string; status: SessionStatus; createdAt: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toSessionHistory: (session: any) => { id: string; cwd: string; status: SessionStatus; createdAt: string; outputSize: number };
    onData: (id: string, callback: (data: string) => void) => void;
    onExit: (id: string, callback: (code: number) => void) => void;
  };
  historyManager: {
    loadHistory: () => Promise<void>;
    saveSession: (session: { id: string; cwd: string; status: SessionStatus; createdAt: string; outputSize: number }) => Promise<void>;
    updateSessionStatus: (id: string, status: SessionStatus, outputSize?: number) => Promise<void>;
    endSession: (id: string, outputSize?: number) => Promise<void>;
    getHistory: () => Array<{ id: string; cwd: string; status: SessionStatus; createdAt: string; endedAt?: string; outputSize: number }>;
    clearHistory: () => Promise<void>;
  };
  getPlatformInfo: () => { platform: string; isWindows: boolean; shell: string };
  broadcastToClients?: (message: object) => void;
}

export function createApp(deps: AppDependencies) {
  const app = new Hono();
  const { sessionManager, historyManager, getPlatformInfo, broadcastToClients } = deps;

  // CORS設定
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }));

  // セッション一覧取得
  app.get('/api/sessions', (c) => {
    const sessions = sessionManager.getAllSessions().map((s) =>
      sessionManager.toSessionInfo(s)
    );
    return c.json({ sessions });
  });

  // セッション作成
  app.post('/api/sessions', async (c) => {
    try {
      const body = await c.req.json<{ cwd: string }>();
      if (!body.cwd) {
        return c.json({ error: 'cwd is required' }, 400);
      }

      const session = sessionManager.createSession(body.cwd);

      // 履歴に保存
      const sessionHistory = sessionManager.toSessionHistory(session);
      await historyManager.saveSession(sessionHistory);

      const sessionInfo = sessionManager.toSessionInfo(session);

      // WebSocketクライアントにセッション作成を通知
      broadcastToClients?.({
        type: 'session:created',
        session: sessionInfo,
      });

      return c.json({ session: sessionInfo }, 201);
    } catch (error) {
      return c.json({ error: 'Invalid request body' }, 400);
    }
  });

  // セッション削除
  app.delete('/api/sessions/:id', (c) => {
    const id = c.req.param('id');
    const deleted = sessionManager.deleteSession(id);

    if (!deleted) {
      return c.json({ error: 'Session not found' }, 404);
    }

    // WebSocketクライアントにセッション削除を通知
    broadcastToClients?.({
      type: 'session:deleted',
      sessionId: id,
    });

    return c.json({ success: true });
  });

  // セッション履歴取得
  app.get('/api/history', (c) => {
    const history = historyManager.getHistory();
    return c.json({ history });
  });

  // 履歴クリア
  app.delete('/api/history', async (c) => {
    await historyManager.clearHistory();
    return c.json({ success: true });
  });

  // プラットフォーム情報取得
  app.get('/api/platform', (c) => {
    return c.json(getPlatformInfo());
  });

  // Claude Code hooks からの通知受信
  app.post('/api/notify', async (c) => {
    try {
      const body = await c.req.json<{ type: string; cwd: string }>();
      const { type, cwd } = body;

      const session = sessionManager.findSessionByCwd(cwd);
      if (session) {
        let newStatus: SessionStatus;
        if (type === 'completed') {
          newStatus = 'completed';
        } else if (type === 'running') {
          newStatus = 'running';
        } else {
          newStatus = 'waiting';
        }
        sessionManager.updateStatus(session.id, newStatus);

        // 履歴のステータスを更新
        const outputSize = sessionManager.getOutputBuffer(session.id)?.length || 0;
        await historyManager.updateSessionStatus(session.id, newStatus, outputSize);

        broadcastToClients?.({
          type: 'notification',
          sessionId: session.id,
          notifyType: type,
          status: newStatus,
        });
      }

      return c.json({ success: true });
    } catch (error) {
      return c.json({ error: 'Invalid request body' }, 400);
    }
  });

  return app;
}
