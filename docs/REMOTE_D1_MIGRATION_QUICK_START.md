# Remote D1 マイグレーション クイックスタート

## 概要

このガイドでは、Cloudflare D1 (remote) に `idAlias` カラムを追加するマイグレーションを適用する方法を説明します。

## 🚨 重要な注意事項

**CLAUDE.md の指示に従い、以下のコマンドはユーザーから明示的に指示がない限り実行しないでください。**

## 前提条件

```bash
# Cloudflare にログイン済みか確認
wrangler whoami

# ログインしていない場合
wrangler login
```

## 方法1: npm スクリプトを使用（推奨）

### フルリセット（開発環境推奨）

データベースを完全にリセットして、すべてのマイグレーションとシードデータを適用:

```bash
npm run d1:reset:remote
```

これは以下を実行します:
1. データベースをクリーンアップ
2. 初期スキーマ適用 (0000_rapid_nuke.sql)
3. idAlias カラム追加 (0001_regular_misty_knight.sql)
4. シードデータ投入

### 段階的適用

既存データがある場合や、個別に適用したい場合:

```bash
# 1. idAlias マイグレーション適用
npm run d1:migrate:0001:remote

# 2. シードデータ投入（必要な場合）
npm run d1:seed:remote
```

## 方法2: wrangler コマンドを直接使用

### idAlias マイグレーションのみ適用

```bash
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --file=./apps/backend/drizzle/0001_regular_misty_knight.sql
```

### 環境別の適用

```bash
# デフォルト環境
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --file=./apps/backend/drizzle/0001_regular_misty_knight.sql

# 開発環境
wrangler d1 execute prototype-hono-drizzle-db-dev \
  --remote \
  --file=./apps/backend/drizzle/0001_regular_misty_knight.sql

# 本番環境
wrangler d1 execute prototype-hono-drizzle-db-prod \
  --remote \
  --file=./apps/backend/drizzle/0001_regular_misty_knight.sql
```

## 確認コマンド

### スキーマ確認

```bash
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --command "PRAGMA table_info(users)"
```

期待される出力に `id_alias` カラムが含まれていることを確認:
```
cid  name        type     notnull  dflt_value  pk
---  ----------  -------  -------  ----------  --
0    id          text     1                    1
1    id_alias    text     1                    0  <- これが追加されている
2    name        text     1                    0
3    avatar_url  text     0                    0
4    created_at  text     1                    0
```

### ユニークインデックス確認

```bash
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --command "SELECT * FROM sqlite_master WHERE type='index' AND tbl_name='users'"
```

### データ確認

```bash
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --command "SELECT id, id_alias, name FROM users LIMIT 5"
```

## トラブルシューティング

### エラー: "table users has no column named id_alias"

**原因**: マイグレーションが適用されていない

**解決策**:
```bash
npm run d1:migrate:0001:remote
```

### エラー: "NOT NULL constraint failed: users.id_alias"

**原因**: 既存のユーザーデータに `id_alias` が設定されていない

**解決策**: データベースをリセット
```bash
npm run d1:reset:remote
```

### マイグレーション適用済みか確認

```bash
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --command "SELECT * FROM __drizzle_migrations"
```

## ローカル環境でのテスト

Remote に適用する前に、ローカルで動作確認:

```bash
# ローカルD1でフルリセット
npm run d1:reset:local

# スキーマ確認
wrangler d1 execute prototype-hono-drizzle-db \
  --local \
  --command "PRAGMA table_info(users)"
```

## 利用可能な npm スクリプト

| スクリプト | 説明 |
|-----------|------|
| `npm run d1:migrate:0001:remote` | idAlias マイグレーション適用 (remote) |
| `npm run d1:migrate:0001:local` | idAlias マイグレーション適用 (local) |
| `npm run d1:migrate:remote` | 全マイグレーション適用 (remote) |
| `npm run d1:migrate:local` | 全マイグレーション適用 (local) |
| `npm run d1:seed:remote` | シードデータ投入 (remote) |
| `npm run d1:seed:local` | シードデータ投入 (local) |
| `npm run d1:reset:remote` | フルリセット (remote) |
| `npm run d1:reset:local` | フルリセット (local) |
| `npm run d1:clean:remote` | データベースクリーンアップ (remote) |

## 詳細情報

より詳しい情報は以下を参照:
- [詳細ガイド](./d1-migration-guide.md)
- [設計ドキュメント](./design-id-alias-feature.md)
