# 環境設定ガイド

このドキュメントでは、ローカル開発環境とCloudflare Workers本番環境における環境設定の違い、HTTP/HTTPSの扱い、Cookie Secure属性の設定について説明します。

## 目次

1. [環境の概要](#環境の概要)
2. [環境変数の設定](#環境変数の設定)
3. [HTTP/HTTPS とSecure属性の扱い](#httphttps-とsecure属性の扱い)
4. [起動方法とデプロイ方法](#起動方法とデプロイ方法)
5. [データベース管理](#データベース管理)
6. [トラブルシューティング](#トラブルシューティング)

---

## 環境の概要

本プロジェクトは以下の3つの実行環境をサポートしています：

| 環境 | プロトコル | データベース | 認証Cookie Secure属性 | 用途 |
|------|-----------|-------------|---------------------|------|
| **テスト** | HTTP (localhost:3000) | BetterSQLite3 (メモリ) | `false` | 自動テスト実行 |
| **ローカル開発** | HTTP (localhost:8787) | D1 Local (`.wrangler/state/`) | `false` | Wranglerでの開発 |
| **本番** | HTTPS (workers.dev) | D1 Remote (Cloudflare) | `true` | 本番環境 |

---

## 環境変数の設定

### 1. ローカル開発環境 (`.env`)

`apps/backend/.env` ファイルで設定します：

```bash
# Better Auth Configuration
BETTER_AUTH_SECRET=<your-secret-key>
BETTER_AUTH_URL=http://localhost:8787
BASE_URL=http://localhost:8787

# Node Server Configuration (npm run dev 用)
PORT=3000
DATABASE_URL=<not-used-for-d1>
```

**重要ポイント**:
- `BASE_URL` と `BETTER_AUTH_URL` は **HTTP** を使用（Secure属性が `false` になります）
- `BETTER_AUTH_SECRET` はランダムな文字列（64文字推奨）

#### SECRET生成方法

```bash
# OpenSSLで生成
openssl rand -hex 32

# Node.jsで生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Cloudflare Workers環境 (`wrangler.toml` + Secrets)

#### `apps/backend/wrangler.toml`

```toml
name = "prototype-hono-drizzle-backend"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# ローカル開発用の環境変数
[vars]
BASE_URL = "http://localhost:8787"

# D1データベース接続設定
[[d1_databases]]
binding = "DB"
database_name = "prototype-hono-drizzle-db"
database_id = "59d1bb59-6480-433f-9f7d-3f24330873cc"
```

#### Cloudflare Secrets (本番環境)

シークレット情報はコマンドで設定します（`wrangler.toml`には書かない）：

```bash
# BETTER_AUTH_SECRETを設定（本番環境）
npx wrangler secret put BETTER_AUTH_SECRET
# プロンプトで値を入力: <your-secret-key>

# 設定済みシークレットの確認
npx wrangler secret list

# 出力例:
# [
#   {
#     "name": "BETTER_AUTH_SECRET",
#     "type": "secret_text"
#   }
# ]
```

**重要**: 本番環境では `BASE_URL` は自動的にCloudflare Workersの実際のURLになります。

---

## HTTP/HTTPS とSecure属性の扱い

### Better Auth設定のロジック

`apps/backend/src/infrastructure/auth/config.ts`:

```typescript
export const createAuth = (db: DrizzleD1Database<typeof schema>, secret?: string, baseUrl?: string) => {
  // 環境に応じたbaseURLの決定
  const baseURL = process.env.NODE_ENV === 'test'
    ? 'http://localhost:3000'  // テスト環境: HTTP
    : (baseUrl || process.env.BETTER_AUTH_URL || process.env.BASE_URL || 'https://prototype-hono-drizzle-backend.linnefromice.workers.dev')

  // HTTPSかどうかでSecure属性を切り替え
  const isSecureContext = baseURL.startsWith('https://')

  return betterAuth({
    secret: secret || process.env.BETTER_AUTH_SECRET,
    baseURL,
    basePath: '/api/auth',

    // 重要: HTTPSの場合のみSecure属性を有効化
    advanced: {
      useSecureCookies: isSecureContext,
    },

    // ... 他の設定
  })
}
```

### 環境ごとのCookie設定

| 環境 | baseURL | isSecureContext | useSecureCookies | Cookie属性 |
|------|---------|----------------|-----------------|-----------|
| テスト | `http://localhost:3000` | `false` | `false` | `HttpOnly; SameSite=Lax` |
| ローカル開発 | `http://localhost:8787` | `false` | `false` | `HttpOnly; SameSite=Lax` |
| 本番 | `https://*.workers.dev` | `true` | `true` | `HttpOnly; SameSite=Lax; Secure` |

**Secure属性が `true` の場合**:
- Cookieは **HTTPSでのみ** 送信されます
- HTTPでアクセスするとCookieが送信されず、認証が失敗します

**Secure属性が `false` の場合**:
- HTTPでもCookieが送信されます
- ローカル開発で必須の設定

---

## 起動方法とデプロイ方法

### 1. テスト実行（自動テスト）

```bash
# バックエンドのテストを実行
npm run backend:test

# カバレッジ付きテスト
npm run test:coverage

# テストUI（ブラウザ）
cd apps/backend
npm run test:ui
```

**環境設定**:
- `NODE_ENV=test` が自動設定
- `baseURL = http://localhost:3000`
- BetterSQLite3（メモリDB）を使用
- Secure属性: `false`

---

### 2. ローカル開発（Wrangler Dev）

#### セットアップ

```bash
# 1. .envファイルを作成
cd apps/backend
cp .env.example .env

# 2. .envを編集
# BETTER_AUTH_SECRET=<generated-secret>
# BASE_URL=http://localhost:8787

# 3. D1ローカルデータベースをセットアップ
npm run d1:migrate:local
npm run d1:seed:users:local
npm run operation:seed:auth-users:local
```

#### 起動

```bash
# Wrangler Devサーバーを起動（推奨）
npm run wrangler:dev

# アクセス: http://localhost:8787
```

**環境設定**:
- `wrangler.toml` の `[vars]` から `BASE_URL=http://localhost:8787` を読み込み
- `.env` から `BETTER_AUTH_SECRET` を読み込み
- D1 Local (`.wrangler/state/v3/d1/miniflare-D1DatabaseObject/...`)を使用
- Secure属性: `false`

#### オプション: Node.js開発サーバー（非推奨）

```bash
# @hono/node-serverで起動（D1が使えない）
npm run dev:backend

# アクセス: http://localhost:3000
```

**注意**: D1バインディングが動作しないため、D1関連機能が使えません。

---

### 3. 本番環境デプロイ（Cloudflare Workers）

#### 初回セットアップ

```bash
# 1. D1データベースを作成（初回のみ）
npm run d1:create

# 出力されたdatabase_idをwrangler.tomlに設定
# database_id = "<your-database-id>"

# 2. BetterAuthシークレットを設定（初回のみ）
npx wrangler secret put BETTER_AUTH_SECRET
# プロンプトで入力: <your-secret-key>

# 3. マイグレーション実行
npm run d1:migrate:remote

# 4. シードデータ投入
npm run d1:seed:users:remote
npm run operation:seed:auth-users:remote
```

#### デプロイ

```bash
# Cloudflare Workersにデプロイ
npm run wrangler:deploy

# デプロイURL（例）: https://prototype-hono-drizzle-backend.linnefromice.workers.dev
```

**環境設定**:
- `baseURL` は自動的にCloudflareのWorkers URLになります
- `BETTER_AUTH_SECRET` はCloudflare Secretsから取得
- D1 Remote（Cloudflareのマネージドデータベース）を使用
- Secure属性: `true` （HTTPSのため）

#### デプロイ後の確認

```bash
# ログをリアルタイムで確認
npx wrangler tail prototype-hono-drizzle-backend

# ヘルスチェック
curl https://prototype-hono-drizzle-backend.linnefromice.workers.dev/health

# 認証テスト
curl -X POST https://prototype-hono-drizzle-backend.linnefromice.workers.dev/api/auth/sign-in/username \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "Password123!"}'
```

---

## データベース管理

### ローカルD1データベース

```bash
# マイグレーション実行
npm run d1:migrate:local

# シードデータ投入
npm run d1:seed:users:local
npm run operation:seed:auth-users:local

# データベースクエリ実行
npm run d1:query:local "SELECT * FROM users"

# ユーザー一覧確認
npm run d1:list-users:local
npm run d1:list-auth-users:local

# データベースリセット（全削除＋再構築）
npm run d1:reset:local

# データベースクリーンアップ（データ削除）
npm run d1:clean:local
```

### 本番D1データベース

```bash
# マイグレーション実行
npm run d1:migrate:remote

# シードデータ投入
npm run d1:seed:users:remote
npm run operation:seed:auth-users:remote

# データベースクエリ実行
npm run d1:query:remote "SELECT * FROM users"

# ユーザー一覧確認
npm run d1:list-users:remote
npm run d1:list-auth-users:remote

# データベースリセット（全削除＋再構築）
npm run d1:reset:remote

# データベースクリーンアップ（データ削除）
npm run d1:clean:remote
```

---

## トラブルシューティング

### 問題1: ローカル開発でCookieが保存されない

**症状**:
- ログイン後もCookieがブラウザに保存されない
- 認証状態が維持されない

**原因**:
- `BASE_URL` がHTTPSになっている
- Secure属性が `true` になっている

**解決策**:

```bash
# .envファイルを確認
cat apps/backend/.env

# BASE_URLをHTTPに変更
BASE_URL=http://localhost:8787  # ✅ 正しい
# BASE_URL=https://localhost:8787  # ❌ 間違い
```

### 問題2: 本番環境で認証が失敗する

**症状**:
- デプロイ後に認証エンドポイントが500エラー
- `BETTER_AUTH_SECRET is required` エラー

**原因**:
- Cloudflare Secretsが設定されていない

**解決策**:

```bash
# シークレットを設定
npx wrangler secret put BETTER_AUTH_SECRET

# 設定確認
npx wrangler secret list

# 再デプロイ
npm run wrangler:deploy
```

### 問題3: ローカルD1データベースが見つからない

**症状**:
- `wrangler dev` 起動時にD1エラー
- テーブルが存在しない

**解決策**:

```bash
# ローカルD1をリセット
npm run d1:reset:local

# または個別に実行
npm run d1:clean:local
npm run d1:migrate:local
npm run d1:seed:users:local
npm run operation:seed:auth-users:local
```

### 問題4: テストが失敗する

**症状**:
- `BETTER_AUTH_SECRET is required` エラー
- データベース接続エラー

**解決策**:

テスト環境では `.env.test` が使用されます：

```bash
# .env.testファイルを確認
cat apps/backend/.env.test

# 必要に応じて.envから.env.testにコピー
cp apps/backend/.env apps/backend/.env.test
```

---

## まとめ

### 環境別設定早見表

| 項目 | テスト | ローカル開発 | 本番 |
|------|--------|------------|------|
| **起動コマンド** | `npm test` | `npm run wrangler:dev` | `npm run wrangler:deploy` |
| **URL** | http://localhost:3000 | http://localhost:8787 | https://*.workers.dev |
| **DB** | BetterSQLite3 (メモリ) | D1 Local | D1 Remote |
| **Secure属性** | `false` | `false` | `true` |
| **環境変数ソース** | `.env.test` | `.env` + `wrangler.toml` | Cloudflare Secrets |
| **BASE_URL** | 自動設定 | `.env` | 自動設定 |
| **BETTER_AUTH_SECRET** | `.env.test` | `.env` | Cloudflare Secret |

### よく使うコマンド

```bash
# ローカル開発開始
npm run wrangler:dev

# テスト実行
npm run backend:test

# 本番デプロイ
npm run wrangler:deploy

# ローカルDBリセット
npm run d1:reset:local

# 本番DBリセット（注意！）
npm run d1:reset:remote

# ログ確認（本番）
npx wrangler tail prototype-hono-drizzle-backend
```

---

このガイドに従うことで、ローカル開発環境と本番環境で適切なHTTP/HTTPS設定とCookie Secure属性の管理ができます。
