# スナップショットテスト実装: 具体的なステップバイステップガイド

**作成日**: 2025-12-09
**元ドキュメント**: [SNAPSHOT_TESTING_WITH_NORMALIZATION_JA.md](./SNAPSHOT_TESTING_WITH_NORMALIZATION_JA.md)
**目的**: 実装計画を具体的な実行可能タスクに分解

---

## 📋 全体の流れ

```
Step 1: 基盤実装 (Normalizers)
    ↓
Step 2: ヘルパー関数実装
    ↓
Step 3: ユニットテスト作成
    ↓
Step 4: パイロット導入 (users.test.ts)
    ↓
Step 5: 全面展開 (conversations, messages)
    ↓
Step 6: ドキュメント化
```

---

## Step 1: UUID正規化の実装

### タスク 1.1: ファイル作成

```bash
# ファイル作成
touch apps/backend/src/__tests__/helpers/snapshotNormalizers.ts
```

### タスク 1.2: 型定義の実装

**ファイル**: `apps/backend/src/__tests__/helpers/snapshotNormalizers.ts`

```typescript
/**
 * Snapshot normalizers for dynamic values
 */

export interface NormalizerContext {
  uuidMap: Map<string, string>
  datetimeMap: Map<string, string>
  path: string[]
}

export type Normalizer = (data: any, context: NormalizerContext) => any
```

**チェックポイント**:
- [ ] 型定義をコピー&ペースト
- [ ] TypeScriptエラーがないことを確認

### タスク 1.3: UUID正規化関数の実装

**同じファイルに追加**:

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Normalizes UUIDs to <UUID:N> format
 * Same UUID gets same placeholder to maintain referential integrity
 */
export function normalizeUUIDs(data: any, context: NormalizerContext): any {
  // Handle string values
  if (typeof data === 'string' && UUID_REGEX.test(data)) {
    if (!context.uuidMap.has(data)) {
      const index = context.uuidMap.size + 1
      context.uuidMap.set(data, `<UUID:${index}>`)
    }
    return context.uuidMap.get(data)
  }

  // Handle arrays recursively
  if (Array.isArray(data)) {
    return data.map((item, i) => {
      context.path.push(`[${i}]`)
      const normalized = normalizeUUIDs(item, context)
      context.path.pop()
      return normalized
    })
  }

  // Handle objects recursively
  if (data !== null && typeof data === 'object') {
    const normalized: any = {}
    for (const [key, value] of Object.entries(data)) {
      context.path.push(key)
      normalized[key] = normalizeUUIDs(value, context)
      context.path.pop()
    }
    return normalized
  }

  // Return primitives as-is
  return data
}
```

**チェックポイント**:
- [ ] 関数をコピー&ペースト
- [ ] TypeScriptビルドが通ることを確認: `npm run backend:build`

---

## Step 2: 日時正規化の実装

### タスク 2.1: 日時正規化関数の実装

**同じファイルに追加**:

```typescript
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/**
 * Normalizes ISO datetime strings to <DATETIME:N> format
 */
export function normalizeDatetimes(data: any, context: NormalizerContext): any {
  // Handle string values
  if (typeof data === 'string' && ISO_DATETIME_REGEX.test(data)) {
    if (!context.datetimeMap.has(data)) {
      const index = context.datetimeMap.size + 1
      context.datetimeMap.set(data, `<DATETIME:${index}>`)
    }
    return context.datetimeMap.get(data)
  }

  // Handle arrays recursively
  if (Array.isArray(data)) {
    return data.map((item, i) => {
      context.path.push(`[${i}]`)
      const normalized = normalizeDatetimes(item, context)
      context.path.pop()
      return normalized
    })
  }

  // Handle objects recursively
  if (data !== null && typeof data === 'object') {
    const normalized: any = {}
    for (const [key, value] of Object.entries(data)) {
      context.path.push(key)
      normalized[key] = normalizeDatetimes(value, context)
      context.path.pop()
    }
    return normalized
  }

  // Return primitives as-is
  return data
}
```

**チェックポイント**:
- [ ] 関数をコピー&ペースト
- [ ] TypeScriptビルドが通ることを確認

---

## Step 3: スナップショットヘルパーの実装

### タスク 3.1: ファイル作成

```bash
touch apps/backend/src/__tests__/helpers/snapshotHelpers.ts
```

### タスク 3.2: 基本ヘルパーの実装

**ファイル**: `apps/backend/src/__tests__/helpers/snapshotHelpers.ts`

```typescript
import { expect } from 'vitest'
import {
  type Normalizer,
  type NormalizerContext,
  normalizeUUIDs,
  normalizeDatetimes,
} from './snapshotNormalizers'

export interface SnapshotOptions {
  normalizers?: Normalizer[]
  // Future extensions
  sortArrays?: Array<{ path: string; sortBy: string }>
}

/**
 * Validates data against a snapshot with normalization
 *
 * @param data - The data to snapshot
 * @param options - Snapshot options (normalizers, etc.)
 *
 * @example
 * ```typescript
 * const user = await response.json()
 * expectMatchesSnapshot(user)
 * ```
 */
export function expectMatchesSnapshot(
  data: any,
  options: SnapshotOptions = {}
): void {
  const context: NormalizerContext = {
    uuidMap: new Map(),
    datetimeMap: new Map(),
    path: [],
  }

  // Default normalizers: UUID and datetime
  const normalizers = options.normalizers ?? [
    normalizeUUIDs,
    normalizeDatetimes,
  ]

  // Apply normalizers in sequence
  let normalized = data
  for (const normalizer of normalizers) {
    normalized = normalizer(normalized, context)
  }

  // Use Vitest's built-in snapshot functionality
  expect(normalized).toMatchSnapshot()
}

/**
 * Validates array items against snapshots
 * Useful for ensuring all items in an array have consistent structure
 */
export function expectArrayItemsMatchSnapshot(
  items: any[],
  options: SnapshotOptions = {}
): void {
  if (!Array.isArray(items)) {
    throw new Error('Expected an array')
  }

  items.forEach((item, index) => {
    const context: NormalizerContext = {
      uuidMap: new Map(),
      datetimeMap: new Map(),
      path: [`[${index}]`],
    }

    const normalizers = options.normalizers ?? [
      normalizeUUIDs,
      normalizeDatetimes,
    ]

    let normalized = item
    for (const normalizer of normalizers) {
      normalized = normalizer(normalized, context)
    }

    expect(normalized).toMatchSnapshot(`item ${index}`)
  })
}
```

**チェックポイント**:
- [ ] 関数をコピー&ペースト
- [ ] TypeScriptビルドが通ることを確認

---

## Step 4: ユニットテストの作成

### タスク 4.1: テストファイル作成

```bash
touch apps/backend/src/__tests__/helpers/snapshotNormalizers.test.ts
```

### タスク 4.2: UUID正規化のテスト

**ファイル**: `apps/backend/src/__tests__/helpers/snapshotNormalizers.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { normalizeUUIDs, type NormalizerContext } from './snapshotNormalizers'

describe('normalizeUUIDs', () => {
  it('normalizes UUID strings to placeholders', () => {
    const context: NormalizerContext = {
      uuidMap: new Map(),
      datetimeMap: new Map(),
      path: [],
    }

    const data = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      name: 'Test User',
    }

    const result = normalizeUUIDs(data, context)

    expect(result).toEqual({
      id: '<UUID:1>',
      name: 'Test User',
    })
  })

  it('assigns same placeholder to duplicate UUIDs', () => {
    const context: NormalizerContext = {
      uuidMap: new Map(),
      datetimeMap: new Map(),
      path: [],
    }

    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const data = {
      userId: uuid,
      conversationId: 'f9e8d7c6-b5a4-3210-fedc-ba0987654321',
      participants: [
        { userId: uuid }, // Same UUID should get same placeholder
      ],
    }

    const result = normalizeUUIDs(data, context)

    expect(result.userId).toBe('<UUID:1>')
    expect(result.participants[0].userId).toBe('<UUID:1>')
    expect(result.conversationId).toBe('<UUID:2>')
  })

  it('handles nested objects', () => {
    const context: NormalizerContext = {
      uuidMap: new Map(),
      datetimeMap: new Map(),
      path: [],
    }

    const data = {
      conversation: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        participants: [
          { id: 'f9e8d7c6-b5a4-3210-fedc-ba0987654321' },
        ],
      },
    }

    const result = normalizeUUIDs(data, context)

    expect(result.conversation.id).toBe('<UUID:1>')
    expect(result.conversation.participants[0].id).toBe('<UUID:2>')
  })

  it('preserves non-UUID strings', () => {
    const context: NormalizerContext = {
      uuidMap: new Map(),
      datetimeMap: new Map(),
      path: [],
    }

    const data = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      name: 'Not a UUID',
      type: 'direct',
    }

    const result = normalizeUUIDs(data, context)

    expect(result.id).toBe('<UUID:1>')
    expect(result.name).toBe('Not a UUID')
    expect(result.type).toBe('direct')
  })
})
```

### タスク 4.3: 日時正規化のテスト

**同じファイルに追加**:

```typescript
import { normalizeDatetimes } from './snapshotNormalizers'

describe('normalizeDatetimes', () => {
  it('normalizes ISO datetime strings to placeholders', () => {
    const context: NormalizerContext = {
      uuidMap: new Map(),
      datetimeMap: new Map(),
      path: [],
    }

    const data = {
      createdAt: '2025-12-09T12:34:56.789Z',
      name: 'Test',
    }

    const result = normalizeDatetimes(data, context)

    expect(result).toEqual({
      createdAt: '<DATETIME:1>',
      name: 'Test',
    })
  })

  it('assigns same placeholder to duplicate datetimes', () => {
    const context: NormalizerContext = {
      uuidMap: new Map(),
      datetimeMap: new Map(),
      path: [],
    }

    const datetime = '2025-12-09T12:34:56.789Z'
    const data = {
      createdAt: datetime,
      updatedAt: datetime,
      items: [
        { timestamp: datetime },
      ],
    }

    const result = normalizeDatetimes(data, context)

    expect(result.createdAt).toBe('<DATETIME:1>')
    expect(result.updatedAt).toBe('<DATETIME:1>')
    expect(result.items[0].timestamp).toBe('<DATETIME:1>')
  })

  it('preserves non-datetime strings', () => {
    const context: NormalizerContext = {
      uuidMap: new Map(),
      datetimeMap: new Map(),
      path: [],
    }

    const data = {
      createdAt: '2025-12-09T12:34:56.789Z',
      name: '2025-12-09', // Not ISO format
      value: 'some string',
    }

    const result = normalizeDatetimes(data, context)

    expect(result.createdAt).toBe('<DATETIME:1>')
    expect(result.name).toBe('2025-12-09')
    expect(result.value).toBe('some string')
  })
})
```

**チェックポイント**:
- [ ] テストをコピー&ペースト
- [ ] テストを実行: `npm run test -- snapshotNormalizers.test.ts --run`
- [ ] 全てのテストが通ることを確認

---

## Step 5: パイロット導入 (users.test.ts)

### タスク 5.1: users.test.ts にスナップショットテストを追加

**ファイル**: `apps/backend/src/routes/users.test.ts`

**変更1: importを追加**

```typescript
import { expectMatchesSnapshot } from '../__tests__/helpers/snapshotHelpers'
```

**変更2: 最初のテストにスナップショットを追加**

既存のテスト:
```typescript
it('returns list of users in development mode', async () => {
  // ... setup ...

  const users = await response.json()
  expect(Array.isArray(users)).toBe(true)
  expect(users.length).toBeGreaterThan(0)

  // Zod schema validation for all users in the array
  expectValidZodSchemaArray(getUsersResponseItem, users, 'users')
})
```

更新後:
```typescript
it('returns list of users in development mode', async () => {
  // Create a user first to ensure there's at least one user
  await app.request('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test User for List',
      avatarUrl: 'https://example.com/test.jpg',
    }),
  })

  const response = await app.request('/users')

  expect(response.status).toBe(200)

  const users = await response.json()
  expect(Array.isArray(users)).toBe(true)
  expect(users.length).toBeGreaterThan(0)

  // Zod schema validation
  expectValidZodSchemaArray(getUsersResponseItem, users, 'users')

  // Snapshot test (NEW!)
  expectMatchesSnapshot(users)
})
```

**チェックポイント**:
- [ ] importを追加
- [ ] スナップショットテストを追加
- [ ] テストを実行: `npm run test -- users.test.ts --run`
- [ ] テストが通ることを確認

### タスク 5.2: スナップショットファイルの確認

```bash
# スナップショットファイルが生成されていることを確認
ls -la apps/backend/src/routes/__snapshots__/users.test.ts.snap

# スナップショットファイルの内容を確認
cat apps/backend/src/routes/__snapshots__/users.test.ts.snap
```

**期待される内容**:
```javascript
exports[`Users API > GET /users > returns list of users in development mode 1`] = `
[
  {
    "avatarUrl": "https://example.com/test.jpg",
    "createdAt": "<DATETIME:1>",
    "id": "<UUID:1>",
    "name": "Test User for List"
  }
]
`;
```

**チェックポイント**:
- [ ] スナップショットファイルが生成されている
- [ ] UUIDが `<UUID:N>` 形式になっている
- [ ] 日時が `<DATETIME:N>` 形式になっている
- [ ] その他の値（name, avatarUrl）は元のまま

### タスク 5.3: 残りのusers.test.tsテストにも適用

**POST /users のテスト**:

```typescript
it('creates a user with name and avatarUrl in development mode', async () => {
  const response = await app.request('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
    }),
  })

  expect(response.status).toBe(201)

  const user = await response.json()

  // Zod schema validation
  expectValidZodSchema(getUsersUserIdResponse, user, 'user')

  // Snapshot test (NEW!)
  expectMatchesSnapshot(user)

  // Business logic assertions
  expect(user.name).toBe('Test User')
  expect(user.avatarUrl).toBe('https://example.com/avatar.jpg')
})
```

**GET /users/:id のテスト**:

```typescript
it('returns user by id', async () => {
  // First create a user
  const createResponse = await app.request('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Findable User',
      avatarUrl: 'https://example.com/findable.jpg',
    }),
  })

  const createdUser = await createResponse.json()

  // Then find it
  const response = await app.request(`/users/${createdUser.id}`)

  expect(response.status).toBe(200)

  const user = await response.json()

  // Zod schema validation
  expectValidZodSchema(getUsersUserIdResponse, user, 'user')

  // Snapshot test (NEW!)
  expectMatchesSnapshot(user)

  // Business logic assertions
  expect(user.id).toBe(createdUser.id)
  expect(user.name).toBe('Findable User')
  expect(user.avatarUrl).toBe('https://example.com/findable.jpg')
})
```

**チェックポイント**:
- [ ] 3つのテストにスナップショットテスト追加
- [ ] テストを実行: `npm run test -- users.test.ts --run`
- [ ] 全てのテストが通る
- [ ] スナップショットファイルに3つのスナップショットが生成されている

---

## Step 6: 回帰テストの確認

### タスク 6.1: スナップショット更新なしでテストが通ることを確認

```bash
# スナップショット更新なしでテスト実行
npm run test -- users.test.ts --run

# 全て通ることを確認
```

**チェックポイント**:
- [ ] スナップショット更新なしでテストが通る

### タスク 6.2: 意図的な変更でテストが失敗することを確認

**一時的にAPIレスポンスを変更**:

```typescript
// apps/backend/src/routes/users.ts
// 一時的に新しいフィールドを追加

router.get('/:userId', async c => {
  const { userId } = GetUserByIdParamsSchema.parse(c.req.param())
  const user = await userUsecase.getUser(userId)

  if (!user) {
    throw new HttpError(404, 'User not found')
  }

  // 一時的に追加
  return c.json({ ...user, newField: 'test' })
})
```

```bash
# テスト実行
npm run test -- users.test.ts --run

# スナップショット不一致エラーが出ることを確認
```

**チェックポイント**:
- [ ] テストが失敗する
- [ ] エラーメッセージでスナップショット差分が表示される
- [ ] `newField` が追加されたことがわかる

**変更を戻す**:

```typescript
// 追加した newField を削除
return c.json(user)
```

---

## Step 7: conversations.test.ts への適用

### タスク 7.1: importを追加

```typescript
import { expectMatchesSnapshot } from '../__tests__/helpers/snapshotHelpers'
```

### タスク 7.2: 主要なテストにスナップショットを追加

**POST /conversations (direct)**:

```typescript
it('creates a direct conversation with 2 participants', async () => {
  // ... setup ...

  const conversation = await response.json()

  // Zod schema validation ensures complete response structure
  expectValidZodSchema(getConversationsIdResponse, conversation, 'conversation')

  // Snapshot test (NEW!)
  expectMatchesSnapshot(conversation)

  // Additional business logic assertions
  expect(conversation.type).toBe('direct')
  expect(conversation.name == null).toBe(true)
  expect(conversation.participants).toHaveLength(2)
  expect(conversation.participants[0].role).toBe('member')
})
```

**POST /conversations (group)**:

```typescript
it('creates a group conversation with name and 3+ participants', async () => {
  // ... setup ...

  const conversation = await response.json()

  // Zod schema validation
  expectValidZodSchema(getConversationsIdResponse, conversation, 'conversation')

  // Snapshot test (NEW!)
  expectMatchesSnapshot(conversation)

  // Business logic assertions
  expect(conversation.type).toBe('group')
  expect(conversation.name).toBe('Test Group')
  expect(conversation.participants).toHaveLength(3)
})
```

**GET /conversations**:

```typescript
it('returns list of conversations for a user', async () => {
  // ... setup ...

  const conversations = await response.json()
  expect(Array.isArray(conversations)).toBe(true)
  expect(conversations.length).toBeGreaterThan(0)

  // Zod schema validation for all conversations in the array
  expectValidZodSchemaArray(getConversationsResponseItem, conversations, 'conversations')

  // Snapshot test (NEW!)
  expectMatchesSnapshot(conversations)
})
```

**チェックポイント**:
- [ ] 少なくとも5つの主要テストにスナップショット追加
- [ ] テストを実行: `npm run test -- conversations.test.ts --run`
- [ ] 全て通ることを確認
- [ ] スナップショットファイルを確認

---

## Step 8: messages.test.ts への適用

### タスク 8.1: 主要なテストにスナップショットを追加

**POST /messages/:id/reactions**:

```typescript
it('adds a reaction to a message', async () => {
  // ... setup ...

  const reaction = await response.json()

  // Zod schema validation
  expectValidZodSchema(deleteMessagesIdReactionsEmojiResponse, reaction, 'reaction')

  // Snapshot test (NEW!)
  expectMatchesSnapshot(reaction)

  // Business logic assertions
  expect(reaction.messageId).toBe(message.id)
  expect(reaction.userId).toBe(user2.id)
  expect(reaction.emoji).toBe('👍')
})
```

**POST /messages/:id/bookmarks**:

```typescript
it('bookmarks a message', async () => {
  // ... setup ...

  const result = await response.json()

  // Zod schema validation
  expectValidZodSchema(postMessagesIdBookmarksResponse, result, 'bookmark response')

  // Snapshot test (NEW!)
  expectMatchesSnapshot(result)

  // Business logic assertions
  expect(result.status).toBe('bookmarked')
  expect(result.bookmark.messageId).toBe(message.id)
  expect(result.bookmark.userId).toBe(user2.id)
})
```

**チェックポイント**:
- [ ] 主要なテストにスナップショット追加
- [ ] テストを実行: `npm run test -- messages.test.ts --run`
- [ ] 全て通ることを確認

---

## Step 9: ドキュメント化

### タスク 9.1: 使用ガイドの作成

```bash
touch specs/guides/SNAPSHOT_TESTING_GUIDE.md
```

**ファイル内容**:

```markdown
# スナップショットテスト使用ガイド

## スナップショットの更新方法

### 全てのスナップショットを更新
\`\`\`bash
npm run test -- -u
\`\`\`

### 特定のテストファイルのみ更新
\`\`\`bash
npm run test -- users.test.ts -u
\`\`\`

### 特定のテストケースのみ更新
\`\`\`bash
npm run test -- -u -t "creates a user"
\`\`\`

## PRレビュー時の確認ポイント

### スナップショット差分の確認

1. **意図した変更か確認**
   - 新しいフィールド追加は意図的か？
   - フィールド削除は破壊的変更ではないか？
   - 型の変更は意図的か？

2. **正規化の確認**
   - UUIDが `<UUID:N>` 形式になっているか
   - 日時が `<DATETIME:N>` 形式になっているか

3. **参照整合性の確認**
   - 同じUUIDが同じプレースホルダーになっているか

### スナップショット差分の例

#### ✅ 正常な追加
\`\`\`diff
  {
    "id": "<UUID:1>",
    "name": "Test User",
+   "email": "test@example.com",
    "createdAt": "<DATETIME:1>"
  }
\`\`\`

#### ⚠️ 破壊的変更
\`\`\`diff
  {
    "id": "<UUID:1>",
    "name": "Test User",
-   "avatarUrl": "https://example.com/avatar.jpg",
    "createdAt": "<DATETIME:1>"
  }
\`\`\`

## トラブルシューティング

### スナップショットが常に失敗する

**原因**: 正規化されていない動的値がある

**解決方法**:
1. スナップショットファイルを確認
2. UUID や日時が生の値のままになっていないか確認
3. 必要に応じて normalizer を追加

### 配列の順序が不定でテストが不安定

**解決方法**:
\`\`\`typescript
// TODO: 配列ソート機能を実装予定
// 現在は手動でソート
const sortedData = [...data].sort((a, b) => a.id.localeCompare(b.id))
expectMatchesSnapshot(sortedData)
\`\`\`
```

**チェックポイント**:
- [ ] ガイドを作成
- [ ] READMEに参照を追加

---

## Step 10: CI/CD統合

### タスク 10.1: GitHub Actions設定確認

既存の `.github/workflows/test.yml` にスナップショットテストが含まれているか確認:

```yaml
- name: Run tests
  run: npm run test
```

スナップショット差分がある場合、テストが失敗するため追加設定不要。

**チェックポイント**:
- [ ] CIでテストが実行されることを確認
- [ ] PRで意図的にスナップショットを変更してCIが失敗することを確認

---

## 完了チェックリスト

### 基盤実装
- [ ] `snapshotNormalizers.ts` 作成
- [ ] UUID正規化関数実装
- [ ] 日時正規化関数実装
- [ ] `snapshotHelpers.ts` 作成
- [ ] ヘルパー関数実装
- [ ] ユニットテスト作成・通過

### パイロット導入
- [ ] users.test.ts に適用
- [ ] スナップショット生成確認
- [ ] 回帰テスト確認
- [ ] 意図的な変更でテスト失敗確認

### 全面展開
- [ ] conversations.test.ts に適用（5+ テスト）
- [ ] messages.test.ts に適用（3+ テスト）
- [ ] 全テスト実行・通過

### ドキュメント化
- [ ] 使用ガイド作成
- [ ] README更新
- [ ] レビューガイドライン作成

### CI/CD
- [ ] CI設定確認
- [ ] PRテスト確認

---

## 次のステップ（オプション）

### 配列ソート機能の追加
メッセージリストなど順序が保証されない配列に対応

### カスタム正規化ルールの追加
プロジェクト固有の動的値に対応

### インラインスナップショットの検討
小さなテストケースではインラインスナップショットも有用

---

**関連ドキュメント**:
- [SNAPSHOT_TESTING_WITH_NORMALIZATION_JA.md](./SNAPSHOT_TESTING_WITH_NORMALIZATION_JA.md) - 元の実装計画
- [Vitest Snapshot Testing](https://vitest.dev/guide/snapshot.html) - 公式ドキュメント
