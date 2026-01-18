import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { sessionManager, type SessionStatus } from './sessionManager.js';
import { historyManager } from './historyManager.js';
import { getPlatformInfo } from './platform.js';

const app = new Hono();

// CORS設定
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// WebSocketクライアント管理
const clients = new Set<WebSocket>();

// 全クライアントにメッセージをブロードキャスト
function broadcastToClients(message: object): void {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// 特定のセッションにサブスクライブしているクライアントにのみ送信
const sessionSubscriptions = new Map<string, Set<WebSocket>>();

function sendToSession(sessionId: string, message: object): void {
  const data = JSON.stringify(message);
  const subscribers = sessionSubscriptions.get(sessionId);
  if (subscribers) {
    subscribers.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}

// セッション作成時にコールバックを設定
function setupSessionCallbacks(sessionId: string): void {
  sessionManager.onData(sessionId, (data) => {
    sendToSession(sessionId, {
      type: 'session:data',
      sessionId,
      data,
    });
  });

  sessionManager.onExit(sessionId, async (exitCode) => {
    // 履歴を更新（セッション終了）
    const session = sessionManager.getSession(sessionId);
    if (session) {
      await historyManager.endSession(
        sessionId,
        sessionManager.getOutputBuffer(sessionId)?.length || 0
      );
    }

    broadcastToClients({
      type: 'session:exit',
      sessionId,
      exitCode,
    });
  });
}

// REST API

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
    setupSessionCallbacks(session.id);

    // 履歴に保存
    const sessionHistory = sessionManager.toSessionHistory(session);
    await historyManager.saveSession(sessionHistory);

    const sessionInfo = sessionManager.toSessionInfo(session);

    // WebSocketクライアントにセッション作成を通知
    broadcastToClients({
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

  // サブスクリプションをクリーンアップ
  sessionSubscriptions.delete(id);

  // WebSocketクライアントにセッション削除を通知
  broadcastToClients({
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

      broadcastToClients({
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

// サーバー起動
const port = 3000;

// 非同期初期化
async function startServer() {
  // 履歴を読み込む
  await historyManager.loadHistory();
  console.log('[Server] History loaded');

  const server = serve({
    fetch: app.fetch,
    port,
  });

  // WebSocketサーバー設定
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    console.log('WebSocket client connected');
    clients.add(ws);

    ws.on('message', (rawData) => {
      try {
        const message = JSON.parse(rawData.toString());

        switch (message.type) {
          case 'subscribe': {
            // セッションにサブスクライブ
            const { sessionId } = message;
            if (sessionId) {
              if (!sessionSubscriptions.has(sessionId)) {
                sessionSubscriptions.set(sessionId, new Set());
              }
              sessionSubscriptions.get(sessionId)!.add(ws);
              console.log(`Client subscribed to session: ${sessionId}`);

              // 既存のターミナル出力バッファを送信（再接続時の復元用）
              const buffer = sessionManager.getOutputBuffer(sessionId);
              if (buffer && buffer.length > 0) {
                ws.send(JSON.stringify({
                  type: 'session:data',
                  sessionId,
                  data: buffer,
                }));
                console.log(`Sent buffer (${buffer.length} bytes) to client for session: ${sessionId}`);
              }
            }
            break;
          }

          case 'unsubscribe': {
            // セッションからアンサブスクライブ
            const { sessionId } = message;
            if (sessionId && sessionSubscriptions.has(sessionId)) {
              sessionSubscriptions.get(sessionId)!.delete(ws);
              console.log(`Client unsubscribed from session: ${sessionId}`);
            }
            break;
          }

          case 'input': {
            // セッションにデータを書き込む
            const { sessionId, data } = message;
            if (sessionId && data) {
              console.log('[DEBUG] input received:', JSON.stringify(data));
              console.log('[DEBUG] input bytes:', Buffer.from(data).toString('hex'));
              console.log('[DEBUG] input chars:', data.split('').map((c: string) => c.charCodeAt(0)));
              const success = sessionManager.write(sessionId, data);
              if (!success) {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Session not found',
                  sessionId,
                }));
              }
            }
            break;
          }

          case 'resize': {
            // セッションのターミナルサイズを変更
            const { sessionId, cols, rows } = message;
            if (sessionId && cols && rows) {
              const success = sessionManager.resize(sessionId, cols, rows);
              if (!success) {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Session not found',
                  sessionId,
                }));
              }
            }
            break;
          }

          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clients.delete(ws);

      // 全セッションからこのクライアントを削除
      sessionSubscriptions.forEach((subscribers) => {
        subscribers.delete(ws);
      });
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // HTTPサーバーのアップグレードリクエスト処理
  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    if (url.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  console.log(`Server is running on http://localhost:${port}`);
  console.log(`WebSocket endpoint: ws://localhost:${port}/ws`);
}

// サーバー起動
startServer().catch((error) => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});
