# SQLite (D1) 完全移行実装計画

## 概要

このドキュメントでは、現在の PostgreSQL ベースのアプリケーションを SQLite (Cloudflare D1) に完全移行するための実装計画を定義します。

## 背景と方針

### なぜ完全移行か

- **インフラ方針**: Cloudflare Workers + D1 をメインインフラとして採用
- **シンプル化**: 複数DBのメンテナンスコストを削減
- **コスト最適化**: Cloudflare の無料枠を最大限活用
- **エッジでの実行**: グローバルな低レイテンシを実現

### 移行後の構成

```
開発環境: SQLite (ローカルファイル)
      ↓
ステージング: Cloudflare D1 (ステージング DB)
      ↓
本番環境: Cloudflare D1 (本番 DB)
```

**全環境で SQLite を使用** することで、環境間の差異をなくし、予期しない動作を防ぎます。

---

## 移行の全体像

### 移行フェーズ

```
Phase 1: スキーマ変換
  └─ PostgreSQL → SQLite スキーマ定義の書き換え

Phase 2: DB クライアント更新
  └─ drizzle-orm/node-postgres → drizzle-orm/better-sqlite3

Phase 3: データ移行
  └─ PostgreSQL データの SQLite へのエクスポート

Phase 4: テスト更新
  └─ 既存テストの SQLite 対応

Phase 5: Cloudflare Workers 対応
  └─ wrangler.toml 設定と Workers エントリーポイント

Phase 6: デプロイと検証
  └─ ステージング → 本番への段階的デプロイ
```

---

## Phase 1: スキーマ変換

### 変更が必要な箇所

| PostgreSQL 機能 | SQLite 対応 | 変更内容 |
|----------------|------------|---------|
| `pgEnum` | ❌ 非対応 | `text` + enum 型制約 |
| `uuid` 型 | ❌ 非対応 | `text` 型 + UUID 文字列 |
| `timestamp` | ⚠️ 制限あり | `text` 型 + ISO 8601 |
| `defaultRandom()` | ❌ 非対応 | `$defaultFn(() => crypto.randomUUID())` |
| `defaultNow()` | ❌ 非対応 | `$defaultFn(() => new Date().toISOString())` |
| `CASCADE` | ✅ 対応 | そのまま使用可能 |
| `UNIQUE INDEX` | ✅ 対応 | そのまま使用可能 |

### スキーマ変換の実装

#### Before (PostgreSQL):

```typescript
// apps/backend/src/infrastructure/db/schema.ts
import {
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const conversationTypeEnum = pgEnum('conversation_type', ['direct', 'group'])
export const participantRoleEnum = pgEnum('participant_role', ['member', 'admin'])
export const messageTypeEnum = pgEnum('message_type', ['text', 'system'])
export const systemEventEnum = pgEnum('system_event', ['join', 'leave'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: conversationTypeEnum('type').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

#### After (SQLite):

```typescript
// apps/backend/src/infrastructure/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Enum は型制約として定義
const conversationTypes = ['direct', 'group'] as const
const participantRoles = ['member', 'admin'] as const
const messageTypes = ['text', 'system'] as const
const systemEvents = ['join', 'leave'] as const

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type', { enum: conversationTypes }).notNull(),
  name: text('name'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const participants = sqliteTable('participants', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: participantRoles }).notNull().default('member'),
  joinedAt: text('joined_at').notNull().$defaultFn(() => new Date().toISOString()),
  leftAt: text('left_at'),
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  senderUserId: text('sender_user_id').references(() => users.id, { onDelete: 'set null' }),
  type: text('type', { enum: messageTypes }).notNull().default('text'),
  text: text('text'),
  replyToMessageId: text('reply_to_message_id'),
  systemEvent: text('system_event', { enum: systemEvents }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const reactions = sqliteTable('reactions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  messageId: text('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  emoji: text('emoji').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const conversationReads = sqliteTable('conversation_reads', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  lastReadMessageId: text('last_read_message_id').references(() => messages.id, {
    onDelete: 'set null',
  }),
  lastReadAt: text('last_read_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const bookmarks = sqliteTable('bookmarks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  messageId: text('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})
```

### 変換チェックリスト

- [ ] すべての `pgTable` を `sqliteTable` に変更
- [ ] すべての `uuid()` を `text().$defaultFn(() => crypto.randomUUID())` に変更
- [ ] すべての `timestamp()` を `text().$defaultFn(() => new Date().toISOString())` に変更
- [ ] すべての `pgEnum` を `text(, { enum: [...] })` に変更
- [ ] `uniqueIndex` の構文確認
- [ ] 外部キー制約の動作確認

---

## Phase 2: DB クライアント更新

### 現在の実装

```typescript
// apps/backend/src/infrastructure/db/client.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { loadEnvConfig } from '../../utils/env'

const env = loadEnvConfig()

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
})

export const db = drizzle(pool)

export const closeDbConnection = async () => {
  await pool.end()
}
```

### 移行後の実装

#### ローカル開発環境（better-sqlite3）

```typescript
// apps/backend/src/infrastructure/db/client.ts
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'

const sqlite = new Database('dev.db') // ローカル SQLite ファイル
export const db = drizzle(sqlite, { schema })

export const closeDbConnection = () => {
  sqlite.close()
}
```

#### Cloudflare Workers 環境（D1）

```typescript
// apps/backend/src/index.ts (Workers エントリーポイント)
import { drizzle } from 'drizzle-orm/d1'
import { Hono } from 'hono'
import * as schema from './infrastructure/db/schema'

export interface Env {
  DB: D1Database
  NODE_ENV: string
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const db = drizzle(env.DB, { schema })

    // Hono アプリに DB を注入
    return app.fetch(request, { ...env, db })
  },
}
```

### 依存パッケージの更新

```bash
# PostgreSQL 関連を削除
npm uninstall pg @types/pg

# SQLite 関連を追加
npm install better-sqlite3 @types/better-sqlite3
npm install drizzle-orm@latest

# Cloudflare Workers 型定義
npm install --save-dev @cloudflare/workers-types wrangler
```

```json
// apps/backend/package.json
{
  "dependencies": {
    "@hono/node-server": "^1.12.2",
    "better-sqlite3": "^11.0.0",
    "drizzle-orm": "^0.35.1",
    "hono": "^4.6.5"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.0.0",
    "@types/better-sqlite3": "^7.6.11",
    "drizzle-kit": "^0.26.1",
    "wrangler": "^3.0.0"
  }
}
```

### Docker 設定の更新

#### 新しい docker-compose.yml（SQLite Viewer）

PostgreSQL + Adminer から SQLite + sqlite-web に変更します。

```yaml
# docker-compose.yml
version: '3.8'

services:
  # SQLite Web Viewer - lightweight web-based SQLite database browser
  sqlite-web:
    image: coleifer/sqlite-web:latest
    container_name: hono-drizzle-sqlite-web
    ports:
      - "8080:8080"
    volumes:
      # Mount the backend directory to access dev.db
      - ./apps/backend:/data
    command: ["-H", "0.0.0.0", "-x", "/data/dev.db"]
    environment:
      - SQLITE_DATABASE=/data/dev.db
    restart: unless-stopped

volumes:
  # No volume needed as SQLite uses local file system
  # The dev.db file is stored in apps/backend/dev.db
```

#### npm スクリプトの更新

```json
// package.json
{
  "scripts": {
    "db:viewer": "docker compose up -d",
    "db:viewer:down": "docker compose down",
    "db:viewer:logs": "docker compose logs -f sqlite-web",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "db:logs": "docker compose logs -f sqlite-web",
    "db:generate": "cd apps/backend && npx drizzle-kit generate",
    "db:migrate": "cd apps/backend && npx tsx scripts/migrate.ts"
  }
}
```

#### .gitignore の更新

```gitignore
# SQLite database files
*.db
*.db-shm
*.db-wal
```

#### 使用方法

```bash
# SQLite Viewer を起動
npm run db:viewer

# ブラウザで http://localhost:8080 にアクセス
# dev.db の内容を GUI で確認・編集可能

# Viewer を停止
npm run db:viewer:down
```

#### SQLite Viewer の特徴

- **軽量**: PostgreSQL + Adminer よりもリソース使用量が少ない
- **シンプル**: SQLite ファイルを直接マウントするだけ
- **機能豊富**: SQL クエリ実行、テーブル編集、データエクスポートなど
- **互換性**: ローカル開発の dev.db と同じファイルを参照

---

## Phase 3: データ移行

### PostgreSQL から SQLite へのデータエクスポート

#### Step 1: PostgreSQL データのダンプ

```typescript
// scripts/export-postgres-data.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { writeFileSync } from 'fs'
import * as pgSchema from '../apps/backend/src/infrastructure/db/schema.old' // 古いスキーマを保存

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

async function exportData() {
  const users = await db.select().from(pgSchema.users)
  const conversations = await db.select().from(pgSchema.conversations)
  const participants = await db.select().from(pgSchema.participants)
  const messages = await db.select().from(pgSchema.messages)
  const reactions = await db.select().from(pgSchema.reactions)
  const conversationReads = await db.select().from(pgSchema.conversationReads)
  const bookmarks = await db.select().from(pgSchema.bookmarks)

  const data = {
    users,
    conversations,
    participants,
    messages,
    reactions,
    conversationReads,
    bookmarks,
  }

  writeFileSync('postgres-data.json', JSON.stringify(data, null, 2))
  console.log('Data exported to postgres-data.json')

  await pool.end()
}

exportData()
```

#### Step 2: SQLite へのデータインポート

```typescript
// scripts/import-to-sqlite.ts
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import * as schema from '../apps/backend/src/infrastructure/db/schema'

const sqlite = new Database('dev.db')
const db = drizzle(sqlite, { schema })

async function importData() {
  const data = JSON.parse(readFileSync('postgres-data.json', 'utf-8'))

  // データ型変換関数
  function convertTimestamp(timestamp: Date | string): string {
    if (typeof timestamp === 'string') return timestamp
    return timestamp.toISOString()
  }

  // Users
  for (const user of data.users) {
    await db.insert(schema.users).values({
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: convertTimestamp(user.createdAt),
    })
  }

  // Conversations
  for (const conversation of data.conversations) {
    await db.insert(schema.conversations).values({
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      createdAt: convertTimestamp(conversation.createdAt),
    })
  }

  // Participants
  for (const participant of data.participants) {
    await db.insert(schema.participants).values({
      id: participant.id,
      conversationId: participant.conversationId,
      userId: participant.userId,
      role: participant.role,
      joinedAt: convertTimestamp(participant.joinedAt),
      leftAt: participant.leftAt ? convertTimestamp(participant.leftAt) : null,
    })
  }

  // Messages
  for (const message of data.messages) {
    await db.insert(schema.messages).values({
      id: message.id,
      conversationId: message.conversationId,
      senderUserId: message.senderUserId,
      type: message.type,
      text: message.text,
      replyToMessageId: message.replyToMessageId,
      systemEvent: message.systemEvent,
      createdAt: convertTimestamp(message.createdAt),
    })
  }

  // Reactions
  for (const reaction of data.reactions) {
    await db.insert(schema.reactions).values({
      id: reaction.id,
      messageId: reaction.messageId,
      userId: reaction.userId,
      emoji: reaction.emoji,
      createdAt: convertTimestamp(reaction.createdAt),
    })
  }

  // ConversationReads
  for (const read of data.conversationReads) {
    await db.insert(schema.conversationReads).values({
      id: read.id,
      conversationId: read.conversationId,
      userId: read.userId,
      lastReadMessageId: read.lastReadMessageId,
      lastReadAt: convertTimestamp(read.lastReadAt),
    })
  }

  // Bookmarks
  for (const bookmark of data.bookmarks) {
    await db.insert(schema.bookmarks).values({
      id: bookmark.id,
      messageId: bookmark.messageId,
      userId: bookmark.userId,
      createdAt: convertTimestamp(bookmark.createdAt),
    })
  }

  console.log('Data imported successfully')
  sqlite.close()
}

importData()
```

#### Step 3: データ移行の実行

```bash
# PostgreSQL からデータエクスポート
DATABASE_URL="postgresql://..." tsx scripts/export-postgres-data.ts

# SQLite にインポート
tsx scripts/import-to-sqlite.ts

# データ検証
sqlite3 dev.db "SELECT COUNT(*) FROM users;"
sqlite3 dev.db "SELECT COUNT(*) FROM conversations;"
```

---

## Phase 4: テスト更新

### テストの変更点

#### Before (PostgreSQL):

```typescript
// apps/backend/src/routes/users.test.ts
import { describe, expect, it, beforeAll } from 'vitest'
import app from '../app'

describe('Users API', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'development'
    // PostgreSQL 接続は自動的に確立される
  })

  // テストケース...
})
```

#### After (SQLite):

```typescript
// apps/backend/src/routes/users.test.ts
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import app from '../app'
import { db, closeDbConnection } from '../infrastructure/db/client'
import { sql } from 'drizzle-orm'

describe('Users API', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'development'
  })

  beforeEach(async () => {
    // テストごとに DB をクリーンアップ
    await db.run(sql`DELETE FROM bookmarks`)
    await db.run(sql`DELETE FROM reactions`)
    await db.run(sql`DELETE FROM conversation_reads`)
    await db.run(sql`DELETE FROM messages`)
    await db.run(sql`DELETE FROM participants`)
    await db.run(sql`DELETE FROM conversations`)
    await db.run(sql`DELETE FROM users`)
  })

  afterAll(async () => {
    await closeDbConnection()
  })

  // テストケース...
})
```

### テストデータベース設定

```typescript
// apps/backend/src/infrastructure/db/client.test.ts
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'

// テスト用のインメモリ DB
const sqlite = new Database(':memory:')
export const db = drizzle(sqlite, { schema })

// マイグレーションを適用
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
migrate(db, { migrationsFolder: './drizzle' })
```

---

## Phase 5: Cloudflare Workers 対応

### wrangler.toml 設定

```toml
# apps/backend/wrangler.toml
name = "prototype-hono-drizzle-api"
main = "src/index.ts"
compatibility_date = "2024-12-09"
compatibility_flags = ["nodejs_compat"]

[build]
command = "npm run build"

# D1 データベース設定
[[d1_databases]]
binding = "DB"
database_name = "prototype-hono-drizzle-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[vars]
NODE_ENV = "production"

# ステージング環境
[env.staging]
name = "prototype-hono-drizzle-api-staging"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "prototype-hono-drizzle-db-staging"
database_id = "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"

[env.staging.vars]
NODE_ENV = "staging"
```

### Workers エントリーポイント

```typescript
// apps/backend/src/index.ts
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import app from './app'
import * as schema from './infrastructure/db/schema'

export interface Env {
  DB: D1Database
  NODE_ENV: string
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const db = drizzle(env.DB, { schema })

    // Hono コンテキストに DB を注入
    return app.fetch(request, { ...env, db })
  },
}
```

### Hono アプリケーション修正

```typescript
// apps/backend/src/app.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import healthRouter from './routes/health'
import conversationsRouter from './routes/conversations'
import messagesRouter from './routes/messages'
import usersRouter from './routes/users'

export interface AppEnv {
  DB: D1Database
  NODE_ENV: string
  db: DrizzleD1Database // DI された DB インスタンス
}

const app = new Hono<{ Bindings: AppEnv }>()

app.use('*', cors())

app.route('/health', healthRouter)
app.route('/conversations', conversationsRouter)
app.route('/messages', messagesRouter)
app.route('/users', usersRouter)

export default app
```

### ルーター修正例

```typescript
// apps/backend/src/routes/users.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { users } from '../infrastructure/db/schema'
import { devOnly } from '../middleware/devOnly'

const router = new Hono<{ Bindings: AppEnv }>()

router.get('/', devOnly, async (c) => {
  const db = c.env.db
  const allUsers = await db.select().from(users)
  return c.json(allUsers)
})

router.post(
  '/',
  devOnly,
  zValidator('json', z.object({
    name: z.string().min(1),
    avatarUrl: z.string().url().optional(),
  })),
  async (c) => {
    const db = c.env.db
    const body = c.req.valid('json')

    const [user] = await db.insert(users).values(body).returning()
    return c.json(user, 201)
  }
)

router.get('/:id', async (c) => {
  const db = c.env.db
  const id = c.req.param('id')

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)

  if (!user) {
    return c.json({ message: 'User not found' }, 404)
  }

  return c.json(user)
})

export default router
```

---

## Phase 6: ビルドとデプロイ設定

### Drizzle Kit 設定

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/infrastructure/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID!,
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
} satisfies Config
```

### package.json スクリプト

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "dev:workers": "wrangler dev",
    "build": "tsc",

    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:push:d1": "wrangler d1 migrations apply prototype-hono-drizzle-db",
    "db:studio": "drizzle-kit studio",

    "test": "vitest",
    "test:coverage": "vitest run --coverage",

    "deploy": "wrangler deploy",
    "deploy:staging": "wrangler deploy --env staging",

    "migrate:export": "tsx scripts/export-postgres-data.ts",
    "migrate:import": "tsx scripts/import-to-sqlite.ts"
  }
}
```

### ローカル開発サーバー

```typescript
// apps/backend/src/server.ts
import { serve } from '@hono/node-server'
import app from './app'
import { db } from './infrastructure/db/client'

const port = 3000

console.log(`Server is running on http://localhost:${port}`)

serve({
  fetch: (request) => app.fetch(request, { db, NODE_ENV: 'development' }),
  port,
})
```

---

## 実装スケジュール

### Week 1: スキーマ変換とセットアップ
- [ ] Day 1-2: スキーマファイルの SQLite 変換
- [ ] Day 3-4: DB クライアントの更新
- [ ] Day 5: Drizzle Kit 設定とマイグレーション生成

### Week 2: データ移行とテスト
- [ ] Day 1-2: データエクスポート/インポートスクリプト作成
- [ ] Day 3-4: 全テストの SQLite 対応
- [ ] Day 5: ローカル環境での動作確認

### Week 3: Workers 対応
- [ ] Day 1-2: wrangler.toml 設定と Workers エントリーポイント
- [ ] Day 3-4: 全ルーターの DB 注入対応
- [ ] Day 5: ローカル Workers 環境でのテスト

### Week 4: デプロイと検証
- [ ] Day 1-2: ステージング環境デプロイ
- [ ] Day 3-4: 本番環境デプロイ
- [ ] Day 5: 監視設定と最終確認

---

## チェックリスト

### Phase 1: スキーマ変換
- [ ] `pgTable` → `sqliteTable` に全変更
- [ ] `uuid()` → `text().$defaultFn(() => crypto.randomUUID())` に変更
- [ ] `timestamp()` → `text().$defaultFn(() => new Date().toISOString())` に変更
- [ ] `pgEnum` → `text(, { enum: [...] })` に変更
- [ ] 外部キー制約の動作確認
- [ ] マイグレーション生成と適用

### Phase 2: DB クライアント
- [ ] `drizzle-orm/node-postgres` → `drizzle-orm/better-sqlite3` に変更
- [ ] `pg` パッケージ削除
- [ ] `better-sqlite3` パッケージ追加
- [ ] DB 接続コードの書き換え
- [ ] ローカル SQLite ファイルの作成

### Phase 3: データ移行
- [ ] PostgreSQL データエクスポートスクリプト作成
- [ ] SQLite インポートスクリプト作成
- [ ] データ型変換の実装
- [ ] データ検証

### Phase 4: テスト更新
- [ ] テストの beforeEach でデータクリーンアップ
- [ ] テストの afterAll で DB クローズ
- [ ] 全テストの実行と確認
- [ ] スナップショットテストの更新

### Phase 5: Workers 対応
- [ ] wrangler.toml 作成
- [ ] D1 データベース作成
- [ ] Workers エントリーポイント作成
- [ ] Hono アプリの型定義更新
- [ ] 全ルーターの DB 注入対応

### Phase 6: デプロイ
- [ ] D1 マイグレーション適用
- [ ] ステージング環境デプロイ
- [ ] ステージング環境での動作確認
- [ ] 本番環境デプロイ
- [ ] 監視とログ設定

---

## トラブルシューティング

### 問題1: UUID が文字列として扱われない

**症状**: UUID が正しく保存されない

**解決策**:
```typescript
// UUID バリデーション関数を追加
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}
```

### 問題2: タイムスタンプの比較が正しく動作しない

**症状**: ISO 8601 文字列の比較が期待通りにならない

**解決策**:
```typescript
// 常に ISO 8601 形式で保存・比較
const timestamp = new Date().toISOString()

// 比較時は文字列として比較（SQLite では文字列比較が動作する）
await db.select().from(messages).where(sql`created_at > ${timestamp}`)
```

### 問題3: D1 でマイグレーションが失敗する

**症状**: `wrangler d1 migrations apply` でエラー

**解決策**:
```bash
# ローカルでまずテスト
wrangler d1 migrations apply prototype-hono-drizzle-db --local

# エラーログを確認
wrangler d1 execute prototype-hono-drizzle-db --command "SELECT * FROM sqlite_master"
```

### 問題4: テストでメモリリークが発生する

**症状**: テスト実行後にメモリが解放されない

**解決策**:
```typescript
// afterAll で必ず DB をクローズ
afterAll(async () => {
  await closeDbConnection()
})

// または各テストでインメモリ DB を使用
beforeEach(() => {
  const sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
})
```

---

## ロールバック計画

万が一、移行に失敗した場合の対応策:

### PostgreSQL への復帰手順

1. **PostgreSQL スキーマを復元**
   ```bash
   git checkout origin/main -- apps/backend/src/infrastructure/db/schema.ts
   ```

2. **PostgreSQL クライアントを復元**
   ```bash
   npm install pg @types/pg
   npm uninstall better-sqlite3 @types/better-sqlite3
   ```

3. **データベース接続を復元**
   ```bash
   git checkout origin/main -- apps/backend/src/infrastructure/db/client.ts
   ```

4. **Docker Compose で PostgreSQL 再起動**
   ```bash
   npm run db:up
   npm run db:push
   ```

5. **バックアップからデータ復元**
   ```bash
   psql $DATABASE_URL < backup.sql
   ```

---

## 移行後のメリット

### 開発体験の向上
- ✅ ローカル環境のセットアップが簡単（Docker 不要）
- ✅ SQLite ファイルで簡単にデータを確認可能
- ✅ テストが高速化（インメモリ DB）

### インフラコスト削減
- ✅ PostgreSQL ホスティング不要
- ✅ Cloudflare 無料枠で十分
- ✅ グローバル展開が容易

### パフォーマンス向上
- ✅ エッジでのデータアクセス
- ✅ レイテンシ削減
- ✅ 自動スケーリング

---

## 次のアクション

1. **Week 1 開始**: スキーマ変換から着手
2. **データバックアップ**: PostgreSQL の現在のデータを保存
3. **段階的な実装**: 1つずつフェーズを進める
4. **継続的なテスト**: 各フェーズでテストを実行

この計画に基づいて、SQLite への完全移行を開始します。
