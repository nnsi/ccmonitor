# CCMonitor

Claude Code の並列セッションをリアルタイム監視するWebUIアプリケーション。

## 構成

pnpm workspaceによるモノレポ構成:

```
packages/
  client/   - React製フロントエンド (Vite, xterm.js, TanStack)
  server/   - Node.js製バックエンド (Hono, node-pty, WebSocket)
  shared/   - 共有型定義
```

## 主な機能

- 複数のClaude Codeセッションを同時に作成・監視（最大6セッション）
- ターミナル出力のリアルタイム表示
- セッションへのコマンド入力・キーボード操作
- セッション履歴の保存・閲覧
- ステータス変更の通知（running/waiting/completed）

## 開発コマンド

```bash
pnpm install    # 依存関係インストール
pnpm dev        # 開発サーバー起動（client: 5173, server: 3001）
pnpm build      # ビルド
pnpm test       # テスト実行
```

## アーキテクチャ

- **REST API**: セッションのCRUD操作、履歴取得
- **WebSocket**: リアルタイムターミナルI/O、ステータス変更通知
- **node-pty**: 疑似ターミナルでシェルプロセスを管理
- **xterm.js**: ブラウザ上でターミナルをエミュレート
