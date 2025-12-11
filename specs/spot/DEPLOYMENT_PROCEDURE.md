# Cloudflare Workers & D1 デプロイ手順書

このドキュメントでは、Cloudflare Workers と D1 データベースのデプロイ手順を説明します。

## 目次

- [前提条件](#前提条件)
- [CI/CD による自動デプロイ](#cicd-による自動デプロイ)
  - [GitHub Actions の設定](#github-actions-の設定)
  - [自動デプロイの動作](#自動デプロイの動作)
  - [手動デプロイの実行](#手動デプロイの実行)
- [初期構築](#初期構築)
  - [1. 初期構築: D1 データベース](#1-初期構築-d1-データベース)
  - [2. 初期構築: Workers API](#2-初期構築-workers-api)
- [更新リリース](#更新リリース)
  - [3. 更新リリース: D1 マイグレーション](#3-更新リリース-d1-マイグレーション)
  - [4. 更新リリース: Workers API](#4-更新リリース-workers-api)
- [環境別デプロイ](#環境別デプロイ)
- [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

以下がインストールされていることを確認してください：

- Node.js (v18 以上推奨)
- npm または yarn
- Cloudflare アカウント

---

## CI/CD による自動デプロイ

GitHub Actions を使用して、D1 データベースと Workers を自動的にデプロイできます。

### GitHub Actions の設定

#### 必要な GitHub Secrets

リポジトリの Settings > Secrets and variables > Actions で以下のシークレットを設定します：

1. **CLOUDFLARE_API_TOKEN**
   - Cloudflare ダッシュボードで作成: https://dash.cloudflare.com/profile/api-tokens
   - 必要な権限:
     - `Workers Scripts:Edit`
     - `D1:Edit`
   - 作成手順:
     ```
     1. Cloudflare ダッシュボードにログイン
     2. My Profile > API Tokens を選択
     3. "Create Token" をクリック
     4. "Edit Cloudflare Workers" テンプレートを選択
     5. 権限に "D1:Edit" を追加
     6. "Continue to summary" > "Create Token"
     7. トークンをコピーして GitHub Secrets に追加
     ```

2. **CLOUDFLARE_ACCOUNT_ID**
   - Cloudflare ダッシュボードで確認: https://dash.cloudflare.com/
   - Workers & Pages のページに表示される Account ID をコピー
   - または wrangler で確認: `npx wrangler whoami`

---

### 自動デプロイの動作

`.github/workflows/deploy-workers.yml` ワークフローは以下の条件で自動実行されます：

**トリガー条件**:
- `main` ブランチへのプッシュ（以下のパスに変更があった場合）
  - `apps/backend/**`
  - `packages/openapi/**`
  - `.github/workflows/deploy-workers.yml`

**実行内容**:
1. 依存パッケージのインストール
2. TypeScript ビルド
3. D1 マイグレーションの適用（リモート）
4. シードデータの投入（users のみ、既存データがあればスキップ）
5. Workers へのデプロイ
6. デプロイサマリーの表示

**デプロイフロー例**:
```
git commit -m "Update user API"
git push origin main
↓
GitHub Actions が自動実行
↓
D1 マイグレーション適用
↓
Workers デプロイ
↓
本番環境に反映
```

---

### 手動デプロイの実行

GitHub Actions UI から手動でデプロイを実行することもできます。

**手順**:
1. GitHub リポジトリの「Actions」タブを開く
2. 「Deploy to Cloudflare Workers」ワークフローを選択
3. 「Run workflow」をクリック
4. 環境を選択（production または dev）
5. 「Run workflow」を実行

**メリット**:
- コードを変更せずにデプロイ可能
- 環境を明示的に選択できる
- リリースタイミングを制御できる

---

### CI/CD のトラブルシューティング

#### ワークフローが失敗する

**原因 1: API トークンが無効**
```
Error: Authentication error
```
**解決策**:
- `CLOUDFLARE_API_TOKEN` を再生成して更新
- トークンの権限を確認（Workers Scripts:Edit, D1:Edit）

**原因 2: Account ID が間違っている**
```
Error: Could not find account
```
**解決策**:
- `CLOUDFLARE_ACCOUNT_ID` を確認して更新
- `npx wrangler whoami` で正しい ID を取得

**原因 3: マイグレーションファイルが見つからない**
```
Error: ENOENT: no such file or directory
```
**解決策**:
- マイグレーションファイルが `drizzle/` ディレクトリに存在することを確認
- ファイル名が正しいか確認

---

#### デプロイは成功するがアクセスできない

**原因**: D1 バインディングが設定されていない

**解決策**:
1. `wrangler.toml` の `database_id` を確認
2. D1 データベースが作成されているか確認:
   ```bash
   npx wrangler d1 list
   ```
3. 必要に応じてデータベースを作成し、`wrangler.toml` を更新

---

## 初期構築

初めて Cloudflare Workers と D1 をセットアップする場合の手順です。

### 1. 初期構築: D1 データベース

#### 1-1. Cloudflare へのログイン

**目的**: Cloudflare アカウントで Wrangler CLI を認証

```bash
cd apps/backend
npx wrangler login
```

ブラウザが開き、Google または GitHub アカウントで認証します。

---

#### 1-2. D1 データベースの作成

**目的**: 本番用の D1 データベースインスタンスを作成

```bash
npm run d1:create
# または
npx wrangler d1 create prototype-hono-drizzle-db
```

**出力例**:
```
✅ Successfully created DB 'prototype-hono-drizzle-db'

[[d1_databases]]
binding = "DB"
database_name = "prototype-hono-drizzle-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**重要**: 出力された `database_id` をコピーします。

---

#### 1-3. wrangler.toml の更新

**目的**: 作成した D1 データベース ID を設定ファイルに反映

`apps/backend/wrangler.toml` を開き、`database_id` を更新します：

```toml
# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "prototype-hono-drizzle-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← ここに貼り付け
```

**環境別のデータベース ID も設定する場合**（オプション）:

```toml
# For local development
[env.dev]
[[env.dev.d1_databases]]
binding = "DB"
database_name = "prototype-hono-drizzle-db-dev"
database_id = "dev-database-id-here"

# For production
[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "prototype-hono-drizzle-db-prod"
database_id = "prod-database-id-here"
```

---

#### 1-4. データベーススキーマのマイグレーション

**目的**: D1 データベースにテーブル構造を作成

```bash
npm run d1:migrate:remote
# または
npx wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --file=./drizzle/0000_rapid_nuke.sql
```

**実行内容**:
- `users` テーブルの作成
- `conversations` テーブルの作成
- `participants` テーブルの作成
- `messages` テーブルの作成
- `reactions` テーブルの作成
- `conversation_reads` テーブルの作成
- `message_bookmarks` テーブルの作成

**確認コマンド**:
```bash
npx wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table'"
```

---

#### 1-5. シードデータの投入

**目的**: 初期ユーザーデータ（10人）を登録

```bash
npm run d1:seed:remote
# または
npx wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --file=./drizzle/seeds/001_users.sql
```

**登録されるユーザー**:
- Alice, Bob, Carol, Dave, Eve, Frank, Grace, Heidi, Ivan, Judy

**確認コマンド**:
```bash
npx wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --command="SELECT COUNT(*) as count FROM users"
```

期待される出力: `count: 10`

---

### 2. 初期構築: Workers API

#### 2-1. Workers のデプロイ

**目的**: Hono API を Cloudflare Workers にデプロイ

```bash
npm run wrangler:deploy
# または
npx wrangler deploy
```

**実行内容**:
- TypeScript コードのビルド
- Workers へのアップロード
- エッジネットワークへの配信

**出力例**:
```
Uploaded prototype-hono-drizzle-backend (2.34 sec)
Published prototype-hono-drizzle-backend (0.25 sec)
  https://prototype-hono-drizzle-backend.{your-subdomain}.workers.dev
```

---

#### 2-2. デプロイの確認

**目的**: API が正常に動作していることを確認

```bash
# ヘルスチェックエンドポイント
curl https://prototype-hono-drizzle-backend.{your-subdomain}.workers.dev/health

# ユーザー一覧取得
curl https://prototype-hono-drizzle-backend.{your-subdomain}.workers.dev/users
```

**期待される結果**:
- ヘルスチェック: `{"status":"ok"}`
- ユーザー一覧: 10人のユーザー情報が返される

---

## 更新リリース

既存環境のアップデート手順です。

### 3. 更新リリース: D1 マイグレーション

#### 3-1. マイグレーションファイルの生成

**目的**: スキーマ変更を SQL ファイルとして出力

スキーマファイル (`src/infrastructure/db/schema.ts`) を変更した後：

```bash
npm run db:generate
# または
npx drizzle-kit generate
```

**実行内容**:
- `drizzle/` ディレクトリに新しいマイグレーションファイルを生成
- 例: `0001_new_migration.sql`

---

#### 3-2. マイグレーションの適用

**目的**: 本番 D1 データベースにスキーマ変更を反映

```bash
# 新しいマイグレーションファイルを適用
npx wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --file=./drizzle/0001_new_migration.sql
```

**注意事項**:
- マイグレーションは**順番に**実行する必要があります
- 本番環境では慎重に実行してください
- 事前にローカルまたは dev 環境でテストすることを推奨

**ローカルでのテスト**:
```bash
npm run d1:migrate:local
# または
npx wrangler d1 execute prototype-hono-drizzle-db \
  --local \
  --file=./drizzle/0001_new_migration.sql
```

---

#### 3-3. マイグレーション確認

**目的**: スキーマ変更が正しく適用されたことを確認

```bash
# テーブル一覧を確認
npx wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table'"

# 特定のテーブル構造を確認
npx wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --command="PRAGMA table_info(users)"
```

---

### 4. 更新リリース: Workers API

#### 4-1. コードのビルド確認

**目的**: デプロイ前にビルドエラーがないことを確認

```bash
npm run build
```

エラーがないことを確認します。

---

#### 4-2. ローカルテスト（オプション）

**目的**: デプロイ前にローカルで動作確認

```bash
npm run wrangler:dev
```

別のターミナルで API をテスト：
```bash
curl http://localhost:8787/health
curl http://localhost:8787/users
```

---

#### 4-3. Workers のデプロイ

**目的**: 更新された API コードを本番環境にデプロイ

```bash
npm run wrangler:deploy
# または
npx wrangler deploy
```

**実行内容**:
- 最新のコードをビルド
- Workers にアップロード
- 自動的にエッジネットワークに配信

---

#### 4-4. デプロイ後の確認

**目的**: 本番環境で正常に動作していることを確認

```bash
# API バージョン確認（実装されている場合）
curl https://prototype-hono-drizzle-backend.{your-subdomain}.workers.dev/health

# 主要なエンドポイントのテスト
curl https://prototype-hono-drizzle-backend.{your-subdomain}.workers.dev/users
curl https://prototype-hono-drizzle-backend.{your-subdomain}.workers.dev/conversations
```

---

## 環境別デプロイ

### 開発環境 (dev)

**D1 データベース作成**:
```bash
npx wrangler d1 create prototype-hono-drizzle-db-dev
```

**wrangler.toml に ID を設定**:
```toml
[env.dev]
[[env.dev.d1_databases]]
binding = "DB"
database_name = "prototype-hono-drizzle-db-dev"
database_id = "dev-database-id-here"
```

**マイグレーションとシード**:
```bash
npx wrangler d1 execute prototype-hono-drizzle-db-dev \
  --remote \
  --file=./drizzle/0000_rapid_nuke.sql

npx wrangler d1 execute prototype-hono-drizzle-db-dev \
  --remote \
  --file=./drizzle/seeds/001_users.sql
```

**Workers デプロイ**:
```bash
npx wrangler deploy --env dev
```

---

### 本番環境 (production)

**D1 データベース作成**:
```bash
npx wrangler d1 create prototype-hono-drizzle-db-prod
```

**wrangler.toml に ID を設定**:
```toml
[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "prototype-hono-drizzle-db-prod"
database_id = "prod-database-id-here"
```

**マイグレーションとシード**:
```bash
npx wrangler d1 execute prototype-hono-drizzle-db-prod \
  --remote \
  --file=./drizzle/0000_rapid_nuke.sql

npx wrangler d1 execute prototype-hono-drizzle-db-prod \
  --remote \
  --file=./drizzle/seeds/001_users.sql
```

**Workers デプロイ**:
```bash
npx wrangler deploy --env production
```

---

## データベースリセット（緊急時）

### ローカル D1 のリセット

**目的**: ローカル開発環境のデータベースを初期状態に戻す

```bash
npm run d1:reset:local
```

このコマンドは以下を順次実行します：
1. データベースのクリーンアップ (`cleanup.sql`)
2. スキーマの再作成 (`0000_rapid_nuke.sql`)
3. シードデータの投入 (`001_users.sql`)

---

### リモート D1 のリセット（慎重に実行）

**⚠️ 警告**: 本番データベースの**全データが削除**されます

```bash
npm run d1:reset:remote
```

**手動での段階的リセット**（推奨）:
```bash
# 1. データベースをクリーンアップ
npm run d1:clean:remote

# 2. スキーマを再作成
npm run d1:migrate:remote

# 3. シードデータを投入
npm run d1:seed:remote
```

---

## トラブルシューティング

### エラー: "Cannot find binding 'DB'"

**原因**: `wrangler.toml` に D1 バインディングが設定されていない

**解決策**:
1. D1 データベースを作成: `npm run d1:create`
2. 出力された `database_id` を `wrangler.toml` に設定
3. Workers を再デプロイ: `npm run wrangler:deploy`

---

### エラー: "Table does not exist"

**原因**: マイグレーションが実行されていない

**解決策**:
```bash
npm run d1:migrate:remote
```

---

### エラー: "UNIQUE constraint failed"

**原因**: シードデータが既に存在している状態で再度投入しようとした

**解決策**:
```bash
# オプション 1: データベースをリセット
npm run d1:reset:remote

# オプション 2: 手動でデータを削除
npx wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --command="DELETE FROM users"
```

---

### デプロイが失敗する

**原因**: ビルドエラーまたは設定ミス

**解決策**:
1. ローカルでビルド確認: `npm run build`
2. ローカルで動作確認: `npm run wrangler:dev`
3. エラーメッセージを確認して修正
4. 再度デプロイ: `npm run wrangler:deploy`

---

### Workers のログを確認したい

**リアルタイムログ**:
```bash
npx wrangler tail
```

**Cloudflare ダッシュボード**:
1. https://dash.cloudflare.com/ にアクセス
2. Workers & Pages を選択
3. デプロイした Worker を選択
4. 「Logs」タブをクリック

---

## クイックリファレンス

### よく使うコマンド

| 目的 | コマンド |
|------|---------|
| D1 データベース作成 | `npm run d1:create` |
| マイグレーション（本番） | `npm run d1:migrate:remote` |
| シード投入（本番） | `npm run d1:seed:remote` |
| Workers デプロイ | `npm run wrangler:deploy` |
| ローカル開発サーバー | `npm run wrangler:dev` |
| データベースリセット（ローカル） | `npm run d1:reset:local` |
| ログ確認 | `npx wrangler tail` |

### 初回デプロイのチェックリスト

- [ ] `npx wrangler login` で認証完了
- [ ] `npm run d1:create` でデータベース作成
- [ ] `wrangler.toml` に `database_id` を設定
- [ ] `npm run d1:migrate:remote` でスキーマ作成
- [ ] `npm run d1:seed:remote` でシードデータ投入
- [ ] `npm run wrangler:deploy` で Workers デプロイ
- [ ] デプロイされた URL で動作確認

### 更新リリースのチェックリスト

- [ ] スキーマ変更がある場合: `npm run db:generate` で マイグレーション生成
- [ ] スキーマ変更がある場合: `npm run d1:migrate:remote` で適用
- [ ] `npm run build` でビルド確認
- [ ] （オプション）`npm run wrangler:dev` でローカルテスト
- [ ] `npm run wrangler:deploy` でデプロイ
- [ ] 本番環境で動作確認

---

## 関連ドキュメント

- [CLOUDFLARE_WORKERS.md](./CLOUDFLARE_WORKERS.md) - Cloudflare Workers デプロイガイド（英語）
- [CLOUDFLARE_WORKERS_JA.md](./CLOUDFLARE_WORKERS_JA.md) - Cloudflare Workers デプロイガイド（日本語）
- [ENVIRONMENTS_AND_DATABASE.md](../design/ENVIRONMENTS_AND_DATABASE.md) - 環境パターンとデータベース管理
- [Cloudflare D1 公式ドキュメント](https://developers.cloudflare.com/d1/)
- [Cloudflare Workers 公式ドキュメント](https://developers.cloudflare.com/workers/)
