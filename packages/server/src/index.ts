import { serve } from '@hono/node-server';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { sessionManager } from './sessionManager.js';
import { historyManager } from './historyManager.js';
import { getPlatformInfo } from './platform.js';
import { createApp } from './app.js';

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

// Honoアプリを作成
const app = createApp({
  sessionManager,
  historyManager,
  getPlatformInfo,
  broadcastToClients,
});

// セッション作成後にコールバックを設定するためのフック
// Note: createAppの後でセッション作成をフックする
const originalCreateSession = sessionManager.createSession.bind(sessionManager);
sessionManager.createSession = (cwd: string) => {
  const session = originalCreateSession(cwd);
  setupSessionCallbacks(session.id);
  return session;
};

// サブスクリプションのクリーンアップをフック
const originalDeleteSession = sessionManager.deleteSession.bind(sessionManager);
sessionManager.deleteSession = (id: string) => {
  sessionSubscriptions.delete(id);
  return originalDeleteSession(id);
};

// サーバー起動
const port = 1470;

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
