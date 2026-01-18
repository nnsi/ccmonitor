# Phase 1.1-1.3 実装まとめ

## 完了したフェーズ

### Phase 1.1: プロジェクトセットアップ
- pnpm workspace構成
- packages/shared（共通型定義）
- packages/server（Hono + node-pty + WebSocket）
- packages/client（React + Vite + Tailwind + xterm.js + Tanstack Query）
- Vitest設定

### Phase 1.2: バックエンド実装
- Honoサーバー（port 3000）
- WebSocketサーバー（/ws）
- SessionManager（node-pty管理）
- REST API: GET/POST/DELETE /api/sessions, POST /api/notify

### Phase 1.3: フロントエンド実装
- タイルグリッド（最大6セッション）
- xterm.js統合
- WebSocket通信
- 新規セッション作成モーダル

## 動作確認中に発見・修正したバグ

### 1. subscribeメッセージ未送信
**症状**: ターミナル出力が表示されない

**原因**: クライアントがセッション作成後にsubscribeを送っていなかった

**修正箇所**:
- `packages/client/src/components/SessionGrid.tsx`
  - `onSubscribe`, `onUnsubscribe` プロパティ追加
  - useEffectでセッション追加時にsubscribe送信
- `packages/client/src/main.tsx`
  - `handleSubscribe`, `handleUnsubscribe` 追加
  - SessionGridにコールバック渡し

### 2. メッセージタイプ不一致
**症状**: WebSocketメッセージが処理されない

**原因**:
- サーバー: `session:data` を送信
- クライアント: `output` を期待

**修正箇所**:
- `packages/client/src/main.tsx`
  - `message.type === 'output'` → `message.type === 'session:data'`

### 3. 入力UI改善（ブラウザ入力欄 + 特殊キーボタン）
**症状**:
- ターミナルへの反映が遅い
- 直接入力すると二重表示（ローカルエコー + PTYエコー）
- Claude Code（inkベース）で文字列一括送信が正しく処理されない

**原因**:
- xterm.js直接入力 + ローカルエコーがPTYエコーと重複
- `inputValue + '\r'`を一括送信するとinkが正しく処理できない

**修正箇所**:
- `packages/client/src/components/TerminalTile.tsx`
  - xterm.jsを**出力専用**に変更（`disableStdin: true`）
  - ブラウザ側に独立した**入力欄**を追加
  - **特殊キーボタン**を追加（Esc, Ctrl+C, Ctrl+D, Tab, Yes, No）
  - 入力を**一文字ずつ送信**するように修正

```typescript
// xterm.js設定（出力専用）
const term = new Terminal({
  cursorBlink: false,
  disableStdin: true, // 入力を無効化
  // ...
});

// 入力送信（一文字ずつ送信してからEnter）
const handleSend = () => {
  for (const char of inputValue) {
    onData(char);  // 一文字ずつ送信
  }
  onData('\r');  // 最後にEnter
  setInputValue('');
};

// 特殊キー送信
const sendSpecialKey = (key: string) => {
  onData(key);  // '\x1b'(Esc), '\x03'(Ctrl+C), etc.
};
```

**UI構成**:
```
┌─────────────────────────────────────┐
│ [ステータス] D:\workspace\ccmonitor  │ ← ヘッダー
├─────────────────────────────────────┤
│                                     │
│  ターミナル出力（xterm.js）          │ ← 出力専用
│                                     │
├─────────────────────────────────────┤
│ [Esc][Ctrl+C][Ctrl+D][Tab][Yes][No] │ ← 特殊キーボタン
│ [入力欄________________] [Send]     │ ← テキスト入力
└─────────────────────────────────────┘
```

## 起動方法

```bash
cd D:\workspace\ccmonitor
pnpm dev
# Server: http://localhost:3000
# Client: http://localhost:5173
```

## 次のフェーズ（Phase 2）

- [ ] ブラウザ通知機能（PWA対応）
- [ ] セッション履歴保存（SQLite or JSON）
- [ ] ログ閲覧機能
- [ ] セッション再接続（ブラウザリロード対応）

## ファイル構成

```
packages/
├── shared/src/index.ts       # 共通型定義
├── server/src/
│   ├── index.ts              # Honoサーバー + WebSocket
│   └── sessionManager.ts     # PTYセッション管理
└── client/src/
    ├── main.tsx              # App + WebSocket統合
    ├── api/sessions.ts       # Tanstack Query hooks
    ├── hooks/useWebSocket.ts # WebSocket管理
    └── components/
        ├── SessionGrid.tsx   # タイルグリッド
        ├── TerminalTile.tsx  # xterm.js + ローカルエコー
        └── NewSessionModal.tsx
```

## WebSocketプロトコル

### Client → Server
```typescript
{ type: 'subscribe', sessionId: string }
{ type: 'unsubscribe', sessionId: string }
{ type: 'input', sessionId: string, data: string }
{ type: 'resize', sessionId: string, cols: number, rows: number }
```

### Server → Client
```typescript
{ type: 'session:created', session: SessionInfo }
{ type: 'session:deleted', sessionId: string }
{ type: 'session:data', sessionId: string, data: string }
{ type: 'session:exit', sessionId: string, exitCode: number }
{ type: 'notification', sessionId: string, notifyType: string, status: string }
```
