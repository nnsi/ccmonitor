# Claude Code Monitor (ccmonitor) 実装計画

## 概要
複数のClaude Codeセッションを並列管理するWebUIアプリケーション。

## 確定した要件

| 項目 | 仕様 |
|------|------|
| UIレイアウト | タイル形式、最大6個同時表示 |
| Claude Code起動 | 自動起動（素の`claude`コマンド） |
| 完了検知 | Claude Code hooks連携（HTTP通知） |
| 作業ディレクトリ | セッション作成時に指定 |
| プロンプト | 渡さない（ターミナルで手入力） |
| 通知タイミング | 入力待ち + 確認待ち + 完了時 |
| フロントエンド | React + Vite + Tailwind + Tanstack Router/Query |
| バックエンド | Hono |
| プラットフォーム | Windows対応必須（Win10 1809+） |
| プロジェクト構成 | pnpm モノレポ |
| セッション特定 | CWDで特定 |
| テスト | Vitest（最初から導入） |
| 配布 | デスクトップアプリ化（Electron/Tauri）を視野に |
| 追加機能 | セッション履歴/ログ（Phase 2） |

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| パッケージ管理 | pnpm (workspaces) |
| バックエンド | Node.js + Hono + TypeScript |
| ターミナル | node-pty |
| WebSocket | ws (hono/node-ws) |
| フロントエンド | React + Vite + xterm.js + TypeScript |
| ルーティング | Tanstack Router |
| API/状態管理 | Tanstack Query |
| スタイリング | Tailwind CSS |
| テスト | Vitest |
| 通知 | Web Notification API |

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │              React Application                   │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐           │   │
│  │  │ xterm   │ │ xterm   │ │ xterm   │  (max 6)  │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘           │   │
│  │       │           │           │                 │   │
│  │       └───────────┼───────────┘                 │   │
│  │                   │ WebSocket                   │   │
│  └───────────────────┼─────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────────────┐
│                 Node.js Server                          │
│                       │                                 │
│  ┌────────────────────┴────────────────────────────┐   │
│  │              Session Manager                     │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐         │   │
│  │  │ node-pty│  │ node-pty│  │ node-pty│         │   │
│  │  │(claude) │  │(claude) │  │(claude) │         │   │
│  │  └─────────┘  └─────────┘  └─────────┘         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  POST /api/notify  ← Claude Code Hooks          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Claude Code Hooks 設定

CWDを含めて送信し、サーバー側でセッションを特定する。

```json
// ~/.claude/settings.json に追加
{
  "hooks": {
    "Notification": [
      {
        "matcher": "idle_prompt|permission_prompt",
        "hooks": [{
          "type": "command",
          "command": "curl -s -X POST http://localhost:3000/api/notify -H \"Content-Type: application/json\" -d \"{\\\"type\\\":\\\"waiting\\\",\\\"cwd\\\":\\\"$(pwd)\\\"}\""
        }]
      }
    ],
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "curl -s -X POST http://localhost:3000/api/notify -H \"Content-Type: application/json\" -d \"{\\\"type\\\":\\\"completed\\\",\\\"cwd\\\":\\\"$(pwd)\\\"}\""
      }]
    }]
  }
}
```

**セッション特定の流れ:**
1. セッション作成時にCWD（作業ディレクトリ）を登録
2. hooks通知にCWDを含めて送信
3. サーバーでCWDからセッションIDを逆引き

## 実装フェーズ

### Phase 1: MVP（基本機能）

#### 1.1 プロジェクトセットアップ ✅
- [x] pnpm workspace 初期化
- [x] packages/server: Hono, node-pty, ws
- [x] packages/client: Vite + React + Tailwind + Tanstack Query
- [x] packages/shared: 共通型定義
- [x] Vitest セットアップ
- [x] 開発環境構築（同時起動スクリプト）

#### 1.2 バックエンド実装 ✅
- [x] Honoサーバー構築
- [x] WebSocketサーバー構築
- [x] SessionManager実装
  - セッション作成（ID生成、PTYスポーン）
  - セッション削除（PTYキル）
  - セッション一覧取得
- [x] POST /api/notify エンドポイント（hooks受信）

#### 1.3 フロントエンド実装 ✅
- [x] React基本構造
- [x] xterm.js統合
- [x] タイルレイアウト（CSS Grid、最大6個）
- [x] 新規セッション作成UI（ディレクトリ指定）
- [x] セッション削除UI
- [x] WebSocket接続管理

### Phase 2: 拡張機能 ✅

- [x] セッション状態表示（実行中/待機中/完了）
  - hooks通知受信時に状態を更新
  - UIにステータスバッジを表示（色分け対応）
- [x] セッション履歴保存（JSON）
  - historyManager.ts実装
  - GET /api/history, DELETE /api/history エンドポイント
- [x] ログ閲覧機能
  - HistoryModal.tsx実装
  - 履歴一覧表示、クリア機能
- [x] セッション再接続（ブラウザリロード対応）
  - 出力バッファ保持（最大50KB）
  - WebSocket再接続時にバッファを送信
- [x] パス比較のcase-insensitive化（Windows対応）

### Phase 3: 通知・デスクトップアプリ化（検討中）

- [ ] ブラウザ通知機能（PWA対応）
  - Web Notification API権限要求
  - hooks通知受信 → ブラウザ通知表示

Web版完成後に検討。候補：
- **Electron**: 移行コスト低、node-ptyがそのまま使える
- **Tauri**: 軽量だがバックエンドRust化が必要

## ファイル構成（pnpm モノレポ）

```
ccmonitor/
├── package.json              # ルート（workspaces設定）
├── pnpm-workspace.yaml
├── packages/
│   ├── server/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts          # Honoサーバー + WebSocket
│   │   │   └── sessionManager.ts # PTYセッション管理
│   │   └── tsconfig.json
│   ├── client/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── routes/
│   │   │   │   ├── __root.tsx
│   │   │   │   └── index.tsx     # メイン画面
│   │   │   ├── components/
│   │   │   │   ├── TerminalTile.tsx
│   │   │   │   ├── SessionGrid.tsx
│   │   │   │   └── NewSessionModal.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useWebSocket.ts
│   │   │   ├── api/
│   │   │   │   └── sessions.ts   # Tanstack Query hooks
│   │   │   └── index.css         # Tailwind
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   └── tsconfig.json
│   └── shared/                   # 共通型定義（API型など）
│       ├── package.json
│       └── src/
│           └── types.ts
├── vitest.config.ts
├── tsconfig.json                 # ルート設定
└── README.md
```

## API設計

### REST API

| Method | Path | 説明 |
|--------|------|------|
| GET | /api/sessions | セッション一覧取得 |
| POST | /api/sessions | 新規セッション作成 |
| DELETE | /api/sessions/:id | セッション削除 |
| POST | /api/notify | Claude Code hooks通知受信 |

### WebSocket メッセージ

```typescript
// Client → Server
{ type: 'input', sessionId: string, data: string }
{ type: 'resize', sessionId: string, cols: number, rows: number }

// Server → Client
{ type: 'output', sessionId: string, data: string }
{ type: 'exit', sessionId: string, code: number }
{ type: 'notification', sessionId: string, notifyType: 'waiting'|'completed' }
```

## 注意事項

1. **Windows要件**: Windows 10 version 1809以降が必須
2. **ビルドツール**: node-ptyはネイティブモジュール
   - Visual Studio Build Tools (C++ワークロード)
   - Python 3.x
3. **Claude Codeパス**: `claude`コマンドがPATHに通っている必要あり
4. **hooks設定**: ユーザーが手動で設定する必要あり（初回のみ）

## 次のステップ

ユーザー承認後、Phase 1.1から実装を開始。
