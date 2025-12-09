# スナップショットテスト実装計画: 正規化による動的値の対応

**日付**: 2025-12-09
**ステータス**: 計画
**目的**: UUID・日時などの動的値を正規化してJSONレスポンスのスナップショットテストを実現

## 背景

現在、Zodスキーマを使ったレスポンス構造検証を実装していますが、以下の課題があります:

1. **実際のレスポンス値の検証が不足**
   - 構造は検証できるが、実際のデータ形式や内容は検証していない
   - 将来的な破壊的変更を検出しにくい

2. **動的値の扱いが難しい**
   - UUID、タイムスタンプなどはテスト実行ごとに変わる
   - そのままスナップショットを取ると常に差分が発生

## 目標

**UUID・日時などの動的値を正規化した上で、JSONレスポンス全体のスナップショットテストを実現**

### 検出したい変更

✅ フィールドの追加/削除
✅ 値の型変更
✅ Enum値の変更
✅ ネストされたオブジェクトの構造変更
✅ 配列要素の順序変更
✅ Null/Undefined の変更

### 検出不要な変更

❌ UUID の具体的な値
❌ タイムスタンプの具体的な値
❌ テスト実行ごとに変わるデータベースのAuto-increment ID

## アプローチ

### 1. 正規化（Normalization）戦略

動的値を予測可能な固定値に置換してからスナップショットを取得:

```typescript
// 元のレスポンス
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Test User",
  "createdAt": "2025-12-09T12:34:56.789Z",
  "conversationId": "f9e8d7c6-b5a4-3210-fedc-ba0987654321"
}

// 正規化後（スナップショット用）
{
  "id": "<UUID:1>",
  "name": "Test User",
  "createdAt": "<DATETIME:1>",
  "conversationId": "<UUID:2>"
}
```

**メリット**:
- スナップショットが人間に読みやすい
- 同じUUIDは同じプレースホルダーになる（参照整合性が保たれる）
- Gitでの差分が明確

### 2. 実装アーキテクチャ

```
┌─────────────────────────────────────────┐
│ Test Code                                │
│                                          │
│  const response = await api.request()   │
│  const data = await response.json()     │
│                                          │
│  expectMatchesSnapshot(data, {          │
│    normalizers: [                       │
│      normalizeUUIDs,                    │
│      normalizeDatetimes,                │
│    ]                                    │
│  })                                     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ Snapshot Helper                          │
│                                          │
│  1. Apply normalizers to data           │
│  2. Serialize to formatted JSON         │
│  3. Compare with stored snapshot        │
│  4. Update snapshot if needed           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ Snapshot File (.snap)                    │
│                                          │
│  // src/routes/__snapshots__/           │
│  //   conversations.test.ts.snap        │
│                                          │
│  exports[`test name`] = `               │
│  {                                      │
│    "id": "<UUID:1>",                    │
│    "createdAt": "<DATETIME:1>"          │
│  }                                      │
│  `;                                     │
└─────────────────────────────────────────┘
```

## 詳細設計

### Phase 1: Normalizer実装

#### 1.1 UUIDノーマライザー

```typescript
// apps/backend/src/__tests__/helpers/snapshotNormalizers.ts

export type Normalizer = (data: any, context: NormalizerContext) => any

export interface NormalizerContext {
  uuidMap: Map<string, string>
  datetimeMap: Map<string, string>
  path: string[]
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function normalizeUUIDs(data: any, context: NormalizerContext): any {
  if (typeof data === 'string' && UUID_REGEX.test(data)) {
    if (!context.uuidMap.has(data)) {
      const index = context.uuidMap.size + 1
      context.uuidMap.set(data, `<UUID:${index}>`)
    }
    return context.uuidMap.get(data)
  }

  if (Array.isArray(data)) {
    return data.map((item, i) => {
      context.path.push(`[${i}]`)
      const normalized = normalizeUUIDs(item, context)
      context.path.pop()
      return normalized
    })
  }

  if (data !== null && typeof data === 'object') {
    const normalized: any = {}
    for (const [key, value] of Object.entries(data)) {
      context.path.push(key)
      normalized[key] = normalizeUUIDs(value, context)
      context.path.pop()
    }
    return normalized
  }

  return data
}
```

#### 1.2 日時ノーマライザー

```typescript
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export function normalizeDatetimes(data: any, context: NormalizerContext): any {
  if (typeof data === 'string' && ISO_DATETIME_REGEX.test(data)) {
    if (!context.datetimeMap.has(data)) {
      const index = context.datetimeMap.size + 1
      context.datetimeMap.set(data, `<DATETIME:${index}>`)
    }
    return context.datetimeMap.get(data)
  }

  if (Array.isArray(data)) {
    return data.map((item, i) => {
      context.path.push(`[${i}]`)
      const normalized = normalizeDatetimes(item, context)
      context.path.pop()
      return normalized
    })
  }

  if (data !== null && typeof data === 'object') {
    const normalized: any = {}
    for (const [key, value] of Object.entries(data)) {
      context.path.push(key)
      normalized[key] = normalizeDatetimes(value, context)
      context.path.pop()
    }
    return normalized
  }

  return data
}
```

#### 1.3 配列順序ノーマライザー（オプション）

```typescript
export interface SortConfig {
  path: string // e.g., "participants"
  sortBy: string // e.g., "userId"
}

export function createArraySorter(config: SortConfig): Normalizer {
  return (data: any, context: NormalizerContext) => {
    // Implementation to sort arrays at specific paths
    // Useful for deterministic snapshots when order doesn't matter
  }
}
```

### Phase 2: スナップショットヘルパー

#### 2.1 メインヘルパー関数

```typescript
// apps/backend/src/__tests__/helpers/snapshotHelpers.ts

import { expect } from 'vitest'

export interface SnapshotOptions {
  normalizers?: Normalizer[]
  sortArrays?: SortConfig[]
  // 将来的な拡張用
  includeMetadata?: boolean
}

export function expectMatchesSnapshot(
  data: any,
  options: SnapshotOptions = {}
): void {
  const context: NormalizerContext = {
    uuidMap: new Map(),
    datetimeMap: new Map(),
    path: [],
  }

  // Default normalizers
  const normalizers = options.normalizers || [
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
```

#### 2.2 配列要素用ヘルパー

```typescript
export function expectArrayItemsMatchSnapshot(
  items: any[],
  options: SnapshotOptions = {}
): void {
  // Validate each item in array has same structure
  items.forEach((item, index) => {
    expectMatchesSnapshot(item, {
      ...options,
      // Add index to snapshot name for clarity
    })
  })
}
```

### Phase 3: テストへの統合

#### 3.1 使用例: 単一オブジェクト

```typescript
// apps/backend/src/routes/conversations.test.ts

import { expectMatchesSnapshot } from '../__tests__/helpers/snapshotHelpers'

describe('POST /conversations', () => {
  it('creates a direct conversation - snapshot test', async () => {
    const user1 = await createUser('User 1')
    const user2 = await createUser('User 2')

    const response = await app.request('/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'direct',
        participantIds: [user1.id, user2.id],
      }),
    })

    expect(response.status).toBe(201)
    const conversation = await response.json()

    // Zod validation (structure check)
    expectValidZodSchema(getConversationsIdResponse, conversation)

    // Snapshot test (full response check with normalization)
    expectMatchesSnapshot(conversation, {
      normalizers: [normalizeUUIDs, normalizeDatetimes],
    })

    // Business logic assertions (specific values)
    expect(conversation.type).toBe('direct')
    expect(conversation.participants).toHaveLength(2)
  })
})
```

#### 3.2 使用例: 配列レスポンス

```typescript
it('returns list of messages - snapshot test', async () => {
  // ... setup and request ...

  const messages = await response.json()

  // Zod validation for structure
  expectValidZodSchemaArray(getConversationsIdMessagesResponseItem, messages)

  // Snapshot for full array (with normalization)
  expectMatchesSnapshot(messages, {
    normalizers: [normalizeUUIDs, normalizeDatetimes],
    sortArrays: [{ path: '', sortBy: 'createdAt' }], // Optional: ensure deterministic order
  })
})
```

### Phase 4: スナップショットファイルの管理

#### 4.1 ディレクトリ構造

```
apps/backend/src/routes/
├── __snapshots__/
│   ├── conversations.test.ts.snap
│   ├── messages.test.ts.snap
│   └── users.test.ts.snap
├── conversations.test.ts
├── messages.test.ts
└── users.test.ts
```

#### 4.2 スナップショットファイルの例

```javascript
// apps/backend/src/routes/__snapshots__/conversations.test.ts.snap

exports[`POST /conversations > creates a direct conversation - snapshot test 1`] = `
{
  "createdAt": "<DATETIME:1>",
  "id": "<UUID:1>",
  "name": null,
  "participants": [
    {
      "conversationId": "<UUID:1>",
      "id": "<UUID:2>",
      "joinedAt": "<DATETIME:1>",
      "leftAt": null,
      "role": "member",
      "userId": "<UUID:3>"
    },
    {
      "conversationId": "<UUID:1>",
      "id": "<UUID:4>",
      "joinedAt": "<DATETIME:1>",
      "leftAt": null,
      "role": "member",
      "userId": "<UUID:5>"
    }
  ],
  "type": "direct"
}
`;

exports[`POST /conversations > creates a group conversation - snapshot test 1`] = `
{
  "createdAt": "<DATETIME:1>",
  "id": "<UUID:1>",
  "name": "Test Group",
  "participants": [
    {
      "conversationId": "<UUID:1>",
      "id": "<UUID:2>",
      "joinedAt": "<DATETIME:1>",
      "leftAt": null,
      "role": "member",
      "userId": "<UUID:3>"
    },
    {
      "conversationId": "<UUID:1>",
      "id": "<UUID:4>",
      "joinedAt": "<DATETIME:1>",
      "leftAt": null,
      "role": "member",
      "userId": "<UUID:5>"
    },
    {
      "conversationId": "<UUID:1>",
      "id": "<UUID:6>",
      "joinedAt": "<DATETIME:1>",
      "leftAt": null,
      "role": "member",
      "userId": "<UUID:7>"
    }
  ],
  "type": "group"
}
`;
```

## 実装ロードマップ

### フェーズ1: 基盤実装 (2-3時間)

**目標**: 正規化機能とスナップショットヘルパーの基本実装

- [ ] `snapshotNormalizers.ts` の作成
  - [ ] `normalizeUUIDs` 実装
  - [ ] `normalizeDatetimes` 実装
  - [ ] ユニットテスト作成

- [ ] `snapshotHelpers.ts` の作成
  - [ ] `expectMatchesSnapshot` 実装
  - [ ] Vitestのスナップショット機能統合

- [ ] 正規化ロジックのテスト
  - [ ] ネストされたオブジェクトの正規化
  - [ ] 配列内の正規化
  - [ ] 同一UUIDの同一プレースホルダー化

### フェーズ2: パイロット導入 (1-2時間)

**目標**: 1つのテストファイルで動作確認

- [ ] `users.test.ts` への適用
  - [ ] GET /users のスナップショット
  - [ ] POST /users のスナップショット
  - [ ] GET /users/:id のスナップショット

- [ ] スナップショットの生成確認
  - [ ] `npm run test -- -u` でスナップショット更新
  - [ ] 生成されたスナップショットの可読性確認

- [ ] 回帰テスト確認
  - [ ] スナップショット更新なしでテストが通ることを確認
  - [ ] 意図的な変更でテストが失敗することを確認

### フェーズ3: 全面展開 (3-4時間)

**目標**: 全テストファイルへの適用

- [ ] `conversations.test.ts` への適用
  - [ ] 9つのエンドポイントにスナップショットテスト追加
  - [ ] ネストされた participants 配列の正規化確認

- [ ] `messages.test.ts` への適用
  - [ ] 4つのエンドポイントにスナップショットテスト追加
  - [ ] Bookmark/Reaction の正規化確認

- [ ] 配列ソート機能の追加（必要に応じて）
  - [ ] メッセージリストなど、順序が保証されない配列への対応

### フェーズ4: ドキュメント化とCI統合 (1時間)

- [ ] 使用ガイドの作成
  - [ ] スナップショット更新方法
  - [ ] レビュー時の確認ポイント

- [ ] CI/CDへの統合
  - [ ] スナップショット差分がある場合のテスト失敗
  - [ ] PRレビューでのスナップショット差分確認

## トレードオフと考慮事項

### メリット

✅ **完全なレスポンス保証**
  - フィールドの追加/削除を即座に検出
  - 値の型変更を検出
  - ネストされた構造の変更を検出

✅ **可読性の高いスナップショット**
  - 動的値が正規化されているため、Git差分が読みやすい
  - レビュー時に変更内容が明確

✅ **メンテナンスの容易さ**
  - OpenAPI仕様変更時はスナップショット更新だけで対応可能
  - 手動でのアサーション追加不要

✅ **Zodスキーマ検証との相補性**
  - Zod: 構造の厳密な検証
  - スナップショット: 実際の値を含む完全な検証
  - 両方使うことで最強の保証

### デメリット・リスク

❌ **スナップショットファイルの肥大化**
  - 対策: 重要なエンドポイントのみスナップショットテスト適用
  - 対策: 大きな配列は最初のN件のみスナップショット化

❌ **過度な脆弱性**
  - 無害な変更（順序変更など）でもテスト失敗
  - 対策: 配列ソート機能で順序を正規化

❌ **レビュー負荷**
  - スナップショット更新時のレビューが必要
  - 対策: 明確なガイドラインとツール支援

### 推奨適用範囲

**🟢 積極的に適用すべき**:
- 単一オブジェクトのレスポンス（GET /users/:id, POST /conversations など）
- 重要なビジネスロジックのエンドポイント
- 外部公開API

**🟡 選択的に適用**:
- リスト取得エンドポイント（最初の数件のみスナップショット化）
- ページネーションがあるエンドポイント

**🔴 適用を避けるべき**:
- 非常に大きなレスポンス（数百件の配列など）
- 頻繁に変更される開発中のエンドポイント
- 内部専用の開発用エンドポイント

## Vitestの機能活用

Vitestは標準でスナップショット機能を提供:

```typescript
// 基本的な使い方
expect(value).toMatchSnapshot()

// インラインスナップショット（スナップショットファイル不要）
expect(value).toMatchInlineSnapshot(`"expected value"`)

// スナップショット更新
// npm run test -- -u

// 特定のテストのみスナップショット更新
// npm run test -- -u -t "test name pattern"
```

## 段階的な移行戦略

既存のZod検証テストとの共存:

```typescript
// Step 1: Zodスキーマ検証のみ（現状）
expectValidZodSchema(schema, data)
expect(data.type).toBe('direct')

// Step 2: スナップショットテスト追加（移行期）
expectValidZodSchema(schema, data)
expectMatchesSnapshot(data) // 追加
expect(data.type).toBe('direct')

// Step 3: スナップショットテストに一本化（理想）
expectMatchesSnapshot(data)
// ビジネスロジック固有のアサーションのみ残す
expect(data.type).toBe('direct')
```

## 成功の指標

- [ ] 全エンドポイントでスナップショットテスト導入
- [ ] スナップショット更新時のレビュープロセス確立
- [ ] CI/CDでのスナップショットテスト通過率 100%
- [ ] 開発者からのフィードバックが好意的
- [ ] スナップショット差分による破壊的変更の早期発見事例

## 次のステップ

1. **承認待ち**: この計画のレビューと承認
2. **技術検証**: 小規模なPoCで正規化ロジックの動作確認
3. **フェーズ1開始**: normalizers と helpers の実装
4. **パイロット導入**: users.test.ts での動作確認

---

**関連ドキュメント**:
- `SNAPSHOT_TESTING_DESIGN_JA.md` - スナップショットテスト設計（既存）
- `TEST_IMPROVEMENTS_JA.md` - テスト改善提案（Zod検証）
- Vitestスナップショット公式ドキュメント: https://vitest.dev/guide/snapshot.html
