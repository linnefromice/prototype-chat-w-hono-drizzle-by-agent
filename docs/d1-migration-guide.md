# D1 マイグレーション適用ガイド

## Remote D1 へのマイグレーション適用方法

### 前提条件

1. Cloudflare アカウントにログイン済み
2. D1 データベースが作成済み
3. `wrangler` CLI がインストール済み

### 方法1: wrangler d1 execute コマンド（推奨）

#### 1. 認証確認
```bash
wrangler whoami
```

ログインしていない場合:
```bash
wrangler login
```

#### 2. データベース名の確認
`wrangler.toml` で定義されているデータベース名:
- **デフォルト**: `prototype-hono-drizzle-db`
- **開発環境**: `prototype-hono-drizzle-db-dev`
- **本番環境**: `prototype-hono-drizzle-db-prod`

#### 3. 既存のマイグレーション確認

Remote D1 に適用済みのマイグレーションを確認:
```bash
wrangler d1 execute prototype-hono-drizzle-db --remote --command "SELECT * FROM __drizzle_migrations"
```

#### 4. 新しいマイグレーション適用

**注意**: CLAUDE.md の指示に従い、ユーザーから明示的に指示がない限り、以下のコマンドは実行しないでください。

##### マイグレーション 0001 の適用 (idAlias カラム追加)
```bash
# デフォルト環境に適用
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --file=./apps/backend/drizzle/0001_regular_misty_knight.sql

# 開発環境に適用
wrangler d1 execute prototype-hono-drizzle-db-dev \
  --remote \
  --file=./apps/backend/drizzle/0001_regular_misty_knight.sql

# 本番環境に適用
wrangler d1 execute prototype-hono-drizzle-db-prod \
  --remote \
  --file=./apps/backend/drizzle/0001_regular_misty_knight.sql
```

#### 5. マイグレーション適用の確認

スキーマ確認:
```bash
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --command "PRAGMA table_info(users)"
```

`id_alias` カラムが追加されていることを確認してください。

#### 6. 既存データへの対応

**重要**: このマイグレーションは既存の `users` テーブルに `NOT NULL` カラムを追加します。

既存データがある場合の対処法:

**Option A: データベースを再作成（開発環境推奨）**
```bash
# 1. データベースをクリーンアップ
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --file=./apps/backend/drizzle/cleanup.sql

# 2. 初期マイグレーション適用
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --file=./apps/backend/drizzle/0000_rapid_nuke.sql

# 3. idAlias マイグレーション適用
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --file=./apps/backend/drizzle/0001_regular_misty_knight.sql

# 4. シードデータ投入
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --file=./apps/backend/drizzle/seeds/001_users.sql
```

**Option B: 既存データを維持（本番環境向け）**

既存のユーザーデータに `idAlias` を設定する必要があります:

```bash
# 一時的に NULL を許可するマイグレーション
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --command "ALTER TABLE users ADD COLUMN id_alias text"

# 既存ユーザーに idAlias を設定（例: id の一部を使用）
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --command "UPDATE users SET id_alias = LOWER(REPLACE(SUBSTR(id, 1, 8), '-', '')) WHERE id_alias IS NULL"

# NOT NULL 制約と UNIQUE インデックスを追加（手動で ALTER が必要）
# SQLite の制約: 既存カラムに NOT NULL を追加するには、テーブルの再作成が必要
```

### 方法2: package.json スクリプトを更新

#### 1. package.json にスクリプト追加

```json
{
  "scripts": {
    "d1:migrate:0001:remote": "wrangler d1 execute prototype-hono-drizzle-db --remote --file=./drizzle/0001_regular_misty_knight.sql",
    "d1:migrate:0001:local": "wrangler d1 execute prototype-hono-drizzle-db --local --file=./drizzle/0001_regular_misty_knight.sql"
  }
}
```

#### 2. スクリプト実行

```bash
npm run d1:migrate:0001:remote
```

### 方法3: Drizzle Kit を使用（将来の推奨方法）

現在のプロジェクトでは、Drizzle Kit は Better SQLite3 用に設定されています。
D1 用の設定を追加する場合:

```typescript
// drizzle.config.d1.ts (新規作成)
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/infrastructure/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1-http', // D1 HTTP API を使用
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID!,
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
})
```

## トラブルシューティング

### エラー: "no such column: users.id_alias"

**原因**: マイグレーションが適用されていない

**解決策**:
```bash
# マイグレーション適用
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --file=./apps/backend/drizzle/0001_regular_misty_knight.sql
```

### エラー: "NOT NULL constraint failed"

**原因**: 既存データに `id_alias` が設定されていない

**解決策**: 上記 "Option B: 既存データを維持" を参照

### マイグレーション履歴の確認

```bash
wrangler d1 execute prototype-hono-drizzle-db \
  --remote \
  --command "SELECT * FROM __drizzle_migrations ORDER BY created_at"
```

## ベストプラクティス

### 1. マイグレーション前にバックアップ

D1 には現在ネイティブなバックアップ機能がないため、重要なデータは別途エクスポート:
```bash
wrangler d1 export prototype-hono-drizzle-db --remote --output=backup.sql
```

### 2. 段階的適用

1. **ローカル環境** → `--local` で動作確認
2. **開発環境** → `-dev` データベースで確認
3. **本番環境** → `-prod` データベースに適用

### 3. ロールバック計画

SQLite (D1) はカラムの削除が制限されているため、ロールバックは困難です。
テーブル再作成が必要な場合があります。

## マイグレーションファイル一覧

現在のプロジェクトのマイグレーションファイル:

- `0000_rapid_nuke.sql` - 初期スキーマ（全テーブル作成）
- `0001_regular_misty_knight.sql` - idAlias カラム追加
- `seeds/001_users.sql` - 初期ユーザーデータ
- `cleanup.sql` - 全テーブル削除

## 参考リンク

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler D1 Commands](https://developers.cloudflare.com/workers/wrangler/commands/#d1)
- [Drizzle ORM Migrations](https://orm.drizzle.team/kit-docs/overview)
