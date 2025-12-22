# prototype-chat-w-hono-drizzle-by-agent

## Project Overview

Cloudflare Workers上で動作するチャットアプリケーションAPIです。Hono、Drizzle ORM、D1データベースを使用し、OpenAPIによる型安全な開発を実現しています。

### 技術スタック

- **ランタイム**: Cloudflare Workers
- **Webフレームワーク**: Hono
- **データベース**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **認証**: Better Auth (username/password認証)
- **型生成**: OpenAPI + Orval
- **テスト**: Vitest

## Prerequisites

- Node.js 20+ and npm
- Cloudflare アカウント (本番デプロイ用)
- Wrangler CLI (npm経由でインストール可能)

## クイックスタート

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
# .envファイルを作成
cp apps/backend/.env.example apps/backend/.env

# .envを編集（必須項目）
# BETTER_AUTH_SECRET=<generate-random-secret>
# BASE_URL=http://localhost:8787
```

**SECRET生成方法**:

```bash
# OpenSSLで生成
openssl rand -hex 32

# または Node.jsで生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. OpenAPI型の生成

```bash
npm run generate:api
```

### 4. ローカルD1データベースのセットアップ

```bash
# マイグレーション実行
cd apps/backend
npm run d1:migrate:local

# シードデータ投入
npm run d1:seed:users:local
npm run operation:seed:auth-users:local
```

### 5. ローカル開発サーバーの起動

```bash
# Wrangler Devで起動
npm run wrangler:dev

# または npm scriptから
cd apps/backend
npm run wrangler:dev
```

アクセス: http://localhost:8787

## 開発ワークフロー

### テスト実行

```bash
# バックエンドテストを実行
npm run backend:test

# カバレッジ付きテスト
npm run test:coverage

# テストUI（ブラウザ）
cd apps/backend
npm run test:ui
```

### OpenAPI仕様変更後

`packages/openapi/openapi.yaml` を編集した後：

```bash
npm run api:update
# 実行内容: generate:api → build → test
```

### ビルドとテスト

```bash
# ビルド + テスト
npm run build:test

# または個別に
npm run backend:build
npm run backend:test
```

## デプロイ（Cloudflare Workers）

### 初回セットアップ

```bash
cd apps/backend

# 1. D1データベースを作成
npm run d1:create
# 出力されたdatabase_idをwrangler.tomlに設定

# 2. BetterAuthシークレットを設定
npx wrangler secret put BETTER_AUTH_SECRET
# プロンプトで入力: <your-secret-key>

# 3. マイグレーション実行
npm run d1:migrate:remote

# 4. シードデータ投入
npm run d1:seed:users:remote
npm run operation:seed:auth-users:remote
```

### デプロイ実行

```bash
cd apps/backend
npm run wrangler:deploy

# デプロイURL: https://prototype-hono-drizzle-backend.linnefromice.workers.dev
```

### デプロイ後の確認

```bash
# ヘルスチェック
curl https://prototype-hono-drizzle-backend.linnefromice.workers.dev/health

# ログ確認
npx wrangler tail prototype-hono-drizzle-backend
```

## データベース管理

### ローカルD1

```bash
cd apps/backend

# マイグレーション
npm run d1:migrate:local

# シードデータ投入
npm run d1:seed:users:local
npm run operation:seed:auth-users:local

# ユーザー一覧確認
npm run d1:list-users:local
npm run d1:list-auth-users:local

# データベースリセット（全削除＋再構築）
npm run d1:reset:local
```

### 本番D1

```bash
cd apps/backend

# マイグレーション
npm run d1:migrate:remote

# シードデータ投入
npm run d1:seed:users:remote
npm run operation:seed:auth-users:remote

# ユーザー一覧確認
npm run d1:list-users:remote
npm run d1:list-auth-users:remote

# データベースリセット（注意！）
npm run d1:reset:remote
```

## よく使うコマンド

### 開発

```bash
# ローカル開発サーバー起動
npm run wrangler:dev  # または cd apps/backend && npm run wrangler:dev

# テスト実行
npm run backend:test

# ビルド
npm run backend:build

# OpenAPI型生成
npm run generate:api
```

### データベース

```bash
# ローカルDBリセット
cd apps/backend
npm run d1:reset:local

# 本番DBリセット（注意！）
cd apps/backend
npm run d1:reset:remote

# SQLクエリ実行
npm run d1:query:local "SELECT * FROM users"
npm run d1:query:remote "SELECT * FROM users"
```

### デプロイ

```bash
# デプロイ
cd apps/backend
npm run wrangler:deploy

# ログ確認
npx wrangler tail prototype-hono-drizzle-backend
```

## 環境設定の詳細

HTTP/HTTPS、Cookie Secure属性、環境変数の詳細については以下を参照してください：

📖 **[環境設定ガイド](docs/ENVIRONMENT_SETUP.md)**

- ローカル開発とCloudflare環境の違い
- HTTP/HTTPSとSecure属性の扱い
- 環境変数の設定方法
- トラブルシューティング

## 認証機能

Better Authによるusername/password認証を実装しています。

📖 **[認証ドキュメント](docs/AUTHENTICATION.md)**

### デフォルトユーザー

シードデータで以下のユーザーが作成されます：

| username | password | 説明 |
|----------|----------|------|
| alice | Password123! | 一般ユーザー |
| bob | Password123! | 一般ユーザー |
| carol | Password123! | 一般ユーザー |

### 認証エンドポイント

```bash
# ユーザー登録
POST /api/auth/sign-up/username
{
  "username": "newuser",
  "password": "Password123!",
  "name": "New User"
}

# ログイン
POST /api/auth/sign-in/username
{
  "username": "alice",
  "password": "Password123!"
}

# ログアウト
POST /api/auth/sign-out
```

## APIドキュメント

OpenAPI仕様書: `packages/openapi/openapi.yaml`

### 主要エンドポイント

- `GET /health` - ヘルスチェック
- `POST /api/auth/sign-up/username` - ユーザー登録
- `POST /api/auth/sign-in/username` - ログイン
- `POST /api/auth/sign-out` - ログアウト
- `GET /conversations` - 会話一覧取得
- `POST /conversations` - 会話作成
- `GET /conversations/:id/messages` - メッセージ一覧取得
- `POST /conversations/:id/messages` - メッセージ送信
- `POST /conversations/:id/leave` - 会話から退出
- `GET /bookmarks` - ブックマーク一覧取得

## Workspace Layout

```
.
├── apps/
│   └── backend/           # Hono API (Cloudflare Workers)
│       ├── src/
│       │   ├── index.ts   # Workers エントリーポイント
│       │   ├── server.ts  # Node.js開発サーバー
│       │   ├── routes/    # APIルート
│       │   ├── usecases/  # ビジネスロジック
│       │   ├── repositories/  # データアクセス層
│       │   └── infrastructure/
│       │       ├── db/    # Drizzleスキーマ・クライアント
│       │       └── auth/  # Better Auth設定
│       ├── drizzle/       # マイグレーションファイル
│       ├── wrangler.toml  # Cloudflare Workers設定
│       └── package.json
│
├── packages/
│   └── openapi/          # OpenAPI仕様と型生成
│       ├── openapi.yaml  # OpenAPI仕様書
│       └── dist/         # 生成された型・スキーマ
│
└── docs/                 # プロジェクトドキュメント
    ├── ENVIRONMENT_SETUP.md  # 環境設定ガイド
    ├── AUTHENTICATION.md     # 認証ドキュメント
    └── AUTHENTICATION_STATUS.md  # 認証実装状況
```

## トラブルシューティング

### ローカル開発でCookieが保存されない

**原因**: `BASE_URL` がHTTPSになっている

**解決策**:
```bash
# .envファイルを確認
cat apps/backend/.env

# BASE_URLをHTTPに変更
BASE_URL=http://localhost:8787  # ✅ 正しい
```

### 本番環境で認証が失敗する

**原因**: Cloudflare Secretsが設定されていない

**解決策**:
```bash
cd apps/backend
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret list
npm run wrangler:deploy
```

### テストが失敗する

**解決策**:
```bash
# .env.testファイルを確認
cp apps/backend/.env apps/backend/.env.test

# テスト再実行
npm run backend:test
```

詳細は [環境設定ガイド](docs/ENVIRONMENT_SETUP.md) を参照してください。

## ライセンス

MIT

---

## 関連ドキュメント

- 📖 [環境設定ガイド](docs/ENVIRONMENT_SETUP.md) - HTTP/HTTPS、環境変数、デプロイ方法
- 📖 [認証ドキュメント](docs/AUTHENTICATION.md) - Better Auth実装の詳細
- 📖 [認証実装状況](docs/AUTHENTICATION_STATUS.md) - 認証機能の実装状況
