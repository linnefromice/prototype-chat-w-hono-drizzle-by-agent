# API スナップショットテスト実装設計

**日付**: 2025-12-08
**ステータス**: 設計検討
**関連**: PROJECT_IMPROVEMENTS_251208_CLAUDE.md - テスト改善セクション

## 概要

JSON リクエスト/レスポンスに対するスナップショットテストを実装し、API の回帰テストとドキュメント化を強化する。

## 目的

1. **回帰テスト強化**: API レスポンス形式の意図しない変更を検出
2. **ドキュメント化**: 実際のリクエスト/レスポンス例をスナップショットとして保存
3. **OpenAPI 仕様との整合性検証**: 生成された Zod スキーマと実際のレスポンスの一貫性確保
4. **レビュー効率化**: PR 時にスナップショット差分で API 変更を可視化

## 現状分析

### 既存のテスト構成

**テストファイル**:
- `src/routes/health.test.ts` - ヘルスチェックエンドポイントの基本テスト
- `src/routes/items.integration.test.ts` - Items API の統合テスト
- `src/usecases/*.test.ts` - ユースケース層のユニットテスト
- `src/middleware/devOnly.test.ts` - ミドルウェアのテスト

**テストランナー**: Vitest

**現在のテスト方式**:
```typescript
// 個別プロパティのアサーション
expect(response.status).toBe(200)
const body = await response.json()
expect(body).toEqual([])

// または
expect(created.name).toBe('Test Item')
expect(created.id).toBeDefined()
```

**課題**:
- レスポンス全体の構造変更を検出しにくい
- 新しいフィールド追加時に既存テストが通ってしまう
- API のドキュメントとしての価値が低い
- 動的な値（UUID、タイムスタンプ）の扱いが煩雑

### API エンドポイント一覧

| エンドポイント | メソッド | 実装ファイル | テスト有無 |
|------------|--------|-----------|----------|
| `/health` | GET | health.ts | ✅ |
| `/items` | GET | items.ts | ✅ |
| `/items` | POST | items.ts | ✅ |
| `/users` | POST | users.ts | ❌ |
| `/users/:userId/bookmarks` | GET | users.ts | ❌ |
| `/conversations` | GET | conversations.ts | ❌ |
| `/conversations` | POST | conversations.ts | ❌ |
| `/conversations/:id` | GET | conversations.ts | ❌ |
| `/conversations/:id/participants` | POST | conversations.ts | ❌ |
| `/conversations/:id/participants/:userId` | DELETE | conversations.ts | ❌ |
| `/conversations/:id/messages` | GET | conversations.ts | ❌ |
| `/conversations/:id/messages` | POST | conversations.ts | ❌ |
| `/conversations/:id/read` | POST | conversations.ts | ❌ |
| `/conversations/:id/unread-count` | GET | conversations.ts | ❌ |
| `/messages/:id/reactions` | POST | messages.ts | ❌ |
| `/messages/:id/reactions/:emoji` | DELETE | messages.ts | ❌ |
| `/messages/:id/bookmarks` | POST | messages.ts | ❌ |
| `/messages/:id/bookmarks` | DELETE | messages.ts | ❌ |

**テストカバレッジのギャップ**: 18 エンドポイント中 3 エンドポイント (17%) のみテスト実装済み

## スナップショットテスト設計

### 1. アーキテクチャ

```
apps/backend/
├── src/
│   ├── routes/
│   │   ├── health.snapshot.test.ts
│   │   ├── items.snapshot.test.ts
│   │   ├── conversations.snapshot.test.ts
│   │   ├── messages.snapshot.test.ts
│   │   └── users.snapshot.test.ts
│   └── __tests__/
│       ├── helpers/
│       │   ├── snapshot-serializers.ts    # カスタムシリアライザ
│       │   ├── test-factories.ts          # テストデータ生成
│       │   └── api-client.ts              # API リクエストヘルパー
│       └── snapshots/
│           ├── health/
│           │   └── GET_health.snap
│           ├── items/
│           │   ├── GET_items_empty.snap
│           │   ├── GET_items_multiple.snap
│           │   ├── POST_items_success.snap
│           │   └── POST_items_validation_error.snap
│           ├── conversations/
│           │   └── ...
│           └── messages/
│               └── ...
```

### 2. スナップショットシリアライザ戦略

#### 動的値の正規化

**課題**: UUID、タイムスタンプなどの動的な値をスナップショットに含めると、毎回テストが失敗する

**解決策**: カスタムシリアライザで動的値をプレースホルダーに置換

```typescript
// src/__tests__/helpers/snapshot-serializers.ts
import { expect } from 'vitest'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export function normalizeSnapshot(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(normalizeSnapshot)
  }

  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    // UUID の正規化
    if (typeof value === 'string' && UUID_REGEX.test(value)) {
      normalized[key] = '<UUID>'
    }
    // ISO 8601 datetime の正規化
    else if (typeof value === 'string' && ISO_DATETIME_REGEX.test(value)) {
      normalized[key] = '<DATETIME>'
    }
    // ネストされたオブジェクトの再帰処理
    else if (typeof value === 'object' && value !== null) {
      normalized[key] = normalizeSnapshot(value)
    }
    else {
      normalized[key] = value
    }
  }
  return normalized
}

// Vitest カスタムシリアライザの登録
expect.addSnapshotSerializer({
  test: (val) => typeof val === 'object' && val !== null,
  serialize: (val, config, indentation, depth, refs, printer) => {
    const normalized = normalizeSnapshot(val)
    return printer(normalized, config, indentation, depth, refs)
  },
})
```

**正規化例**:
```typescript
// 元のレスポンス
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Alice",
  "createdAt": "2025-12-08T10:30:00.123Z"
}

// 正規化後（スナップショット）
{
  "id": "<UUID>",
  "name": "Alice",
  "createdAt": "<DATETIME>"
}
```

### 3. テストパターン

#### パターン A: 正常系スナップショット

```typescript
// src/routes/items.snapshot.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import app from '../app'
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from '../__tests__/helpers/database'
import { createTestItem } from '../__tests__/helpers/test-factories'

describe('Items API Snapshots', () => {
  beforeAll(async () => {
    await setupTestDatabase()
  })

  beforeEach(async () => {
    await clearDatabase()
  })

  afterAll(async () => {
    await teardownTestDatabase()
  })

  describe('GET /items', () => {
    it('returns empty array when no items exist', async () => {
      const response = await app.request('/items')
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toMatchSnapshot()
    })

    it('returns array of items', async () => {
      // テストデータの作成
      await createTestItem({ name: 'Item 1' })
      await createTestItem({ name: 'Item 2' })
      await createTestItem({ name: 'Item 3' })

      const response = await app.request('/items')
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toMatchSnapshot()
    })
  })

  describe('POST /items', () => {
    it('creates item successfully', async () => {
      const response = await app.request('/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Item' }),
      })
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body).toMatchSnapshot()
    })
  })
})
```

#### パターン B: エラーレスポンススナップショット

```typescript
describe('POST /items - Error Cases', () => {
  it('returns 400 when name is too short', async () => {
    const response = await app.request('/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ab' }), // 3文字未満
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchSnapshot()
  })

  it('returns 400 when request body is invalid JSON', async () => {
    const response = await app.request('/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchSnapshot()
  })

  it('returns 400 when name field is missing', async () => {
    const response = await app.request('/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchSnapshot()
  })
})
```

#### パターン C: OpenAPI 契約テストとスナップショットの組み合わせ

```typescript
import { getItemsResponse, postItemsBody } from 'openapi'

describe('POST /items - Contract & Snapshot', () => {
  it('matches OpenAPI schema and snapshot', async () => {
    const response = await app.request('/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Contract Test Item' }),
    })
    const body = await response.json()

    // OpenAPI スキーマ検証
    const validation = postItemsBody.safeParse({ name: 'Contract Test Item' })
    expect(validation.success).toBe(true)

    // レスポンススキーマ検証（仮）
    // TODO: OpenAPI からレスポンススキーマも生成する
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('name')
    expect(body).toHaveProperty('createdAt')

    // スナップショット検証
    expect(body).toMatchSnapshot()
  })
})
```

### 4. テストヘルパーの実装

#### データファクトリ

```typescript
// src/__tests__/helpers/test-factories.ts
import { db } from '../../infrastructure/db/client'
import { items, users, conversations } from '../../infrastructure/db/schema'

export async function createTestItem(data: { name: string }) {
  const [item] = await db.insert(items).values(data).returning()
  return item
}

export async function createTestUser(data: { name: string; avatarUrl?: string | null }) {
  const [user] = await db.insert(users).values(data).returning()
  return user
}

export async function createTestConversation(data: {
  type: 'direct' | 'group'
  name?: string | null
  participantIds: string[]
}) {
  const [conversation] = await db.insert(conversations).values({
    type: data.type,
    name: data.name,
  }).returning()

  // participants の追加は別の関数で実装
  return conversation
}
```

#### データベースヘルパー

```typescript
// src/__tests__/helpers/database.ts
import { sql } from 'drizzle-orm'
import { db, closeDbConnection } from '../../infrastructure/db/client'

export async function setupTestDatabase() {
  // テーブル作成は既存のマイグレーションを使用
  // またはテスト用の簡易セットアップ
}

export async function clearDatabase() {
  // すべてのテーブルをTRUNCATE
  await db.execute(sql`TRUNCATE TABLE items CASCADE;`)
  await db.execute(sql`TRUNCATE TABLE users CASCADE;`)
  await db.execute(sql`TRUNCATE TABLE conversations CASCADE;`)
  await db.execute(sql`TRUNCATE TABLE messages CASCADE;`)
  // ... 他のテーブル
}

export async function teardownTestDatabase() {
  await closeDbConnection()
}
```

### 5. スナップショット例

#### GET /items (空配列)
```
// src/__tests__/snapshots/items/GET_items_empty.snap
exports[`Items API Snapshots > GET /items > returns empty array when no items exist 1`] = `[]`;
```

#### GET /items (複数アイテム)
```
// src/__tests__/snapshots/items/GET_items_multiple.snap
exports[`Items API Snapshots > GET /items > returns array of items 1`] = `
[
  {
    "id": "<UUID>",
    "name": "Item 1",
    "createdAt": "<DATETIME>",
  },
  {
    "id": "<UUID>",
    "name": "Item 2",
    "createdAt": "<DATETIME>",
  },
  {
    "id": "<UUID>",
    "name": "Item 3",
    "createdAt": "<DATETIME>",
  },
]
`;
```

#### POST /items (成功)
```
// src/__tests__/snapshots/items/POST_items_success.snap
exports[`Items API Snapshots > POST /items > creates item successfully 1`] = `
{
  "id": "<UUID>",
  "name": "New Item",
  "createdAt": "<DATETIME>",
}
`;
```

#### POST /items (バリデーションエラー)
```
// src/__tests__/snapshots/items/POST_items_validation_error.snap
exports[`Items API Snapshots > POST /items - Error Cases > returns 400 when name is too short 1`] = `
{
  "message": "Item name too short",
}
`;
```

### 6. Vitest 設定の更新

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // スナップショットディレクトリの設定
    resolveSnapshotPath: (testPath, snapExtension) => {
      const relativePath = path.relative(__dirname, testPath)
      const snapshotPath = relativePath
        .replace(/^src\//, 'src/__tests__/snapshots/')
        .replace(/\.test\.ts$/, snapExtension)
      return path.join(__dirname, snapshotPath)
    },
  },
  resolve: {
    alias: {
      '@openapi': path.resolve(__dirname, '../../packages/openapi/dist'),
    },
  },
})
```

### 7. npm スクリプトの追加

```json
// package.json (backend)
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:snapshot": "vitest --run --update",
    "test:snapshot:update": "vitest --run -u",
    "test:coverage": "vitest --coverage"
  }
}
```

## 実装フェーズ

### フェーズ 1: 基盤整備（1週間）

**タスク**:
1. スナップショットシリアライザの実装
   - UUID 正規化
   - タイムスタンプ正規化
   - Vitest への登録

2. テストヘルパーの実装
   - データファクトリ（createTestItem, createTestUser, etc.）
   - データベースヘルパー（setup, teardown, clear）
   - API クライアントヘルパー（オプション）

3. Vitest 設定の更新
   - スナップショットパス設定
   - セットアップファイルの整備

**成果物**:
- `src/__tests__/helpers/snapshot-serializers.ts`
- `src/__tests__/helpers/test-factories.ts`
- `src/__tests__/helpers/database.ts`
- 更新された `vitest.config.ts`

### フェーズ 2: 既存エンドポイントのスナップショット化（1週間）

**タスク**:
1. Health API のスナップショットテスト
   - `GET /health` 正常系

2. Items API のスナップショットテスト
   - `GET /items` 空配列
   - `GET /items` 複数アイテム
   - `POST /items` 成功
   - `POST /items` バリデーションエラー

3. 既存のテストとの共存
   - `items.integration.test.ts` との役割分担を明確化
   - 統合テスト: データフロー全体の検証
   - スナップショットテスト: レスポンス形式の検証

**成果物**:
- `src/routes/health.snapshot.test.ts`
- `src/routes/items.snapshot.test.ts`
- スナップショットファイル（`__tests__/snapshots/`）

### フェーズ 3: 未テストエンドポイントのカバレッジ拡大（2週間）

**優先度順**:
1. **高優先度**: Core Chat API
   - `POST /conversations` - 会話作成
   - `GET /conversations` - 会話一覧
   - `POST /conversations/:id/messages` - メッセージ送信
   - `GET /conversations/:id/messages` - メッセージ一覧

2. **中優先度**: Chat 補助機能
   - `POST /messages/:id/reactions` - リアクション追加
   - `DELETE /messages/:id/reactions/:emoji` - リアクション削除
   - `POST /conversations/:id/read` - 既読更新
   - `GET /conversations/:id/unread-count` - 未読数取得

3. **低優先度**: 管理機能
   - `POST /users` - ユーザー作成
   - `POST /conversations/:id/participants` - 参加者追加
   - `DELETE /conversations/:id/participants/:userId` - 参加者削除
   - `POST /messages/:id/bookmarks` - ブックマーク追加
   - `DELETE /messages/:id/bookmarks` - ブックマーク削除
   - `GET /users/:userId/bookmarks` - ブックマーク一覧

**成果物**:
- `src/routes/conversations.snapshot.test.ts`
- `src/routes/messages.snapshot.test.ts`
- `src/routes/users.snapshot.test.ts`
- 全エンドポイントのスナップショット

### フェーズ 4: エラーケースとエッジケースの拡充（1週間）

**タスク**:
1. 全エンドポイントの 4xx エラーケース
   - 400: バリデーションエラー
   - 403: アクセス拒否
   - 404: リソース不在

2. エッジケース
   - 空文字列、null、undefined
   - 境界値（最小/最大長）
   - 不正な形式（UUID、datetime）

3. 並行操作のテスト
   - 競合状態のシミュレーション
   - トランザクション整合性の検証

**成果物**:
- エラーケーススナップショット
- エッジケーステスト

## メリットとデメリット

### メリット

1. **回帰テストの強化**
   - API レスポンス形式の意図しない変更を即座に検出
   - フィールド追加・削除・型変更を可視化

2. **ドキュメント化**
   - スナップショットが実際のレスポンス例として機能
   - OpenAPI 仕様と実装の乖離を検出

3. **開発効率の向上**
   - テストコードの記述量削減（`expect(body).toMatchSnapshot()` のみ）
   - 新規エンドポイント追加時のテスト作成が容易

4. **レビュー効率化**
   - PR で API 変更が差分として可視化
   - 影響範囲の把握が容易

5. **リファクタリングの安全性**
   - 内部実装変更時にレスポンス形式の一貫性を保証

### デメリット

1. **スナップショットの肥大化**
   - レスポンスが大きい場合、スナップショットファイルが巨大化
   - Git リポジトリサイズの増加

2. **過剰な更新**
   - 正当な API 変更時にすべてのスナップショットを更新する必要
   - `--update` の誤用で意図しない変更を承認するリスク

3. **動的値の扱い**
   - UUID、タイムスタンプの正規化が必要
   - カスタムシリアライザの保守コスト

4. **テスト実行時間**
   - スナップショット比較のオーバーヘッド
   - 大量のエンドポイントでは実行時間が増加

5. **スナップショットの可読性**
   - 大きな JSON の差分は読みにくい
   - どのフィールドが重要かわかりにくい

### デメリットへの対策

1. **スナップショットサイズ対策**
   - 大きなレスポンスは部分的にスナップショット化
   - ページネーション結果は最初の数件のみテスト

2. **更新プロセスの確立**
   - スナップショット更新時は必ず差分をレビュー
   - CI でスナップショット不一致を明示的にエラー化

3. **シリアライザの保守**
   - 動的値パターンのドキュメント化
   - 正規化ルールのテスト

4. **パフォーマンス対策**
   - スナップショットテストと統合テストを分離
   - 並列実行の最適化

## 代替案との比較

### 代替案 A: 個別アサーションのみ

**現状のアプローチ**:
```typescript
expect(response.status).toBe(200)
expect(body.id).toBeDefined()
expect(body.name).toBe('Test Item')
```

**比較**:
- ✅ テストの意図が明確
- ✅ 特定フィールドのみ検証
- ❌ レスポンス全体の構造変更を検出できない
- ❌ 新規フィールド追加を検出できない

**結論**: スナップショットテストと併用することで補完

### 代替案 B: OpenAPI 契約テストのみ

**アプローチ**:
```typescript
const result = getItemsResponse.safeParse(body)
expect(result.success).toBe(true)
```

**比較**:
- ✅ OpenAPI 仕様との整合性を保証
- ✅ 型安全性の検証
- ❌ スキーマ準拠であれば任意の値を許容
- ❌ 実際のレスポンス例が残らない

**結論**: スナップショットテストと併用することで補完

### 推奨: ハイブリッドアプローチ

**3層テスト戦略**:

1. **契約テスト**: OpenAPI スキーマとの整合性
   ```typescript
   expect(validation.success).toBe(true)
   ```

2. **ビジネスロジックテスト**: 特定フィールドの値検証
   ```typescript
   expect(body.name).toBe('Expected Name')
   ```

3. **スナップショットテスト**: レスポンス全体の構造検証
   ```typescript
   expect(body).toMatchSnapshot()
   ```

**役割分担**:
- 契約テスト: 型とスキーマの検証
- ビジネスロジックテスト: 動的な値とビジネスルールの検証
- スナップショットテスト: レスポンス形式の回帰テストとドキュメント化

## リスクと対策

### リスク 1: スナップショット更新の誤用

**リスク**: 開発者が差分を確認せずに `--update` を実行し、意図しない変更を承認

**対策**:
1. CI でスナップショット不一致を検出
2. PR テンプレートにスナップショット変更のチェックリスト追加
3. スナップショット更新のガイドラインをドキュメント化
4. レビュー時にスナップショット差分を必ず確認

### リスク 2: テスト実行時間の増加

**リスク**: 全エンドポイントのスナップショットテストで CI 実行時間が大幅に増加

**対策**:
1. テストを並列実行
2. スナップショットテストを別ジョブとして分離
3. 変更のあったファイルに関連するテストのみ実行（オプション）

### リスク 3: データベース状態の管理

**リスク**: テスト間でデータベース状態が干渉し、不安定なテストになる

**対策**:
1. 各テストの `beforeEach` でデータベースをクリア
2. トランザクションロールバックの活用（オプション）
3. テストデータのファクトリ化で一貫性を保証

## 成功指標（KPI）

1. **テストカバレッジ**
   - 目標: 全エンドポイント (18) のスナップショットテスト実装
   - 測定: テスト済みエンドポイント数 / 全エンドポイント数

2. **回帰テスト検出率**
   - 目標: API 変更の 100% をスナップショット不一致で検出
   - 測定: スナップショット不一致で検出された変更 / 全 API 変更

3. **テスト実行時間**
   - 目標: 全テスト実行時間 < 30秒
   - 測定: CI でのテストジョブ実行時間

4. **スナップショット更新頻度**
   - 目標: 適切な頻度での更新（月 2-5 回程度）
   - 測定: スナップショット更新コミット数

## 次のステップ

### 即座に実行可能なアクション

1. **スナップショットシリアライザの実装**
   - `src/__tests__/helpers/snapshot-serializers.ts` 作成
   - UUID、タイムスタンプ正規化の実装
   - Vitest セットアップファイルへの登録

2. **Health API のスナップショットテスト作成**
   - `src/routes/health.snapshot.test.ts` 作成
   - 最初のスナップショット生成
   - CI での実行確認

3. **テストヘルパーの実装**
   - データファクトリの基本実装
   - データベースヘルパーの実装

### 承認が必要な決定事項

1. **スナップショット配置戦略**
   - 提案: `src/__tests__/snapshots/` に集約
   - 代替: 各テストファイルと同じディレクトリ

2. **テスト実行戦略**
   - 提案: 既存テストとスナップショットテストを統合
   - 代替: 別の npm スクリプトとして分離

3. **CI 統合方法**
   - 提案: 既存の CI パイプラインに追加
   - 代替: 別の CI ジョブとして実行

## 参考資料

- [Vitest Snapshot Testing](https://vitest.dev/guide/snapshot.html)
- [Jest Snapshot Testing Best Practices](https://jestjs.io/docs/snapshot-testing)
- [Effective Snapshot Testing](https://kentcdodds.com/blog/effective-snapshot-testing)
- [OpenAPI Contract Testing](https://swagger.io/blog/api-testing/openapi-driven-api-testing/)

## 関連ドキュメント

- `PROJECT_IMPROVEMENTS_251208_CLAUDE.md` - 全体的なプロジェクト改善提案
- `specs/openapi.yml` - API 仕様定義
- `packages/openapi/dist/index.ts` - 生成された Zod スキーマ

---

**ドキュメント履歴**
- 2025-12-08: 初稿作成（設計検討フェーズ）
