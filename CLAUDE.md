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
pnpm dev        # 開発サーバー起動（client: 2356, server: 1470）
pnpm build      # ビルド
pnpm test       # テスト実行
```

## アーキテクチャ

- **REST API**: セッションのCRUD操作、履歴取得
- **WebSocket**: リアルタイムターミナルI/O、ステータス変更通知
- **node-pty**: 疑似ターミナルでシェルプロセスを管理
- **xterm.js**: ブラウザ上でターミナルをエミュレート

## サブエージェント活用の知見

サブエージェントでサーバー/クライアントを並列実装する際の注意点:

1. **共通型定義を先に作成**: WebSocketメッセージ型などを`packages/shared`に定義
2. **型の参照を明示**: サブエージェントには作成した型を参照するよう指示
3. **プロトコルの一貫性**: subscribe/unsubscribeのフロー、メッセージタイプ名を統一
4. **連携部分のバグ**: コンポーネント間の接続部分でバグが出やすい。特にWebSocketのプロトコル
