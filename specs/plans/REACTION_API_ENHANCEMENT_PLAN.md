# リアクション機能拡張 実装計画

## 概要

チャットメッセージに対するリアクション機能を拡張し、以下の2つの機能を実装する。

1. 特定メッセージのリアクション一覧取得API
2. メッセージ取得時にリアクション情報を含める機能

## 前提条件

- **リアクションの形式**: 配列形式で返却（集約処理なし）
- **パフォーマンス**: 最適化は後続対応（ページネーション等で対応予定）
- **互換性**: 破壊的変更OK（開発中のため）

## 現状の問題点

### 実装済みのAPI

- `POST /messages/{id}/reactions` - リアクション追加
- `DELETE /messages/{id}/reactions/{emoji}` - リアクション削除

### 不足している機能

1. **リアクション一覧取得API**: 特定メッセージに紐づく全リアクションを取得する手段がない
2. **メッセージ一覧でのリアクション情報**: `GET /conversations/{id}/messages` のレスポンスにリアクションが含まれない

### 問題の影響

- メッセージごとにリアクションを表示するには、個別にAPIを叩く必要がある（将来的にN+1問題）
- クライアント側でリアクション表示のための追加実装が必要

---

## フェーズ1: 特定メッセージのリアクション一覧取得API

### 1.1 OpenAPIスキーマ更新

**ファイル:** `packages/openapi/openapi.yaml`

エンドポイント `GET /messages/{id}/reactions` を追加:

```yaml
/messages/{id}/reactions:
  get:
    summary: Get reactions for a message
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      '200':
        description: List of reactions
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/Reaction'
      '404':
        description: Message not found
```

### 1.2 型生成

```bash
npm run generate:api
```

### 1.3 Repository層

**ファイル:** `apps/backend/src/repositories/chatRepository.ts`

インターフェースにメソッドを追加:

```typescript
export interface ChatRepository {
  // ... 既存のメソッド

  listReactions(messageId: string): Promise<Reaction[]>
}
```

**ファイル:** `apps/backend/src/repositories/drizzleChatRepository.ts`

実装を追加:

```typescript
async listReactions(messageId: string): Promise<Reaction[]> {
  const reactionRows = await this.client
    .select()
    .from(reactions)
    .where(eq(reactions.messageId, messageId))

  return reactionRows.map(mapReaction)
}
```

### 1.4 Usecase層

**ファイル:** `apps/backend/src/usecases/chatUsecase.ts`

メソッドを追加:

```typescript
async listReactions(messageId: string): Promise<Reaction[]> {
  const message = await this.repo.findMessageById(messageId)
  if (!message) {
    throw new HttpError(404, 'Message not found')
  }
  return this.repo.listReactions(messageId)
}
```

### 1.5 Router層

**ファイル:** `apps/backend/src/routes/messages.ts`

エンドポイントを追加:

```typescript
router.get('/:id/reactions', async c => {
  const messageId = c.req.param('id')

  try {
    const db = await getDbClient(c)
    const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
    const reactions = await chatUsecase.listReactions(messageId)
    return c.json(reactions)
  } catch (error) {
    return handleError(error, c)
  }
})
```

### 1.6 テスト

**ファイル:** `apps/backend/src/routes/messages.test.ts`

テストケースを追加:

- リアクションが0件の場合
- 複数のユーザーが同じ絵文字でリアクションした場合
- 複数の絵文字でリアクションがある場合
- 存在しないメッセージIDの場合（404エラー）

```typescript
describe('GET /messages/:id/reactions', () => {
  it('returns empty array when no reactions', async () => {
    // テスト実装
  })

  it('returns all reactions for a message', async () => {
    // テスト実装
  })

  it('returns 404 for non-existent message', async () => {
    // テスト実装
  })
})
```

---

## フェーズ2: メッセージ取得時にリアクションを含める

### 2.1 OpenAPIスキーマ更新

**ファイル:** `packages/openapi/openapi.yaml`

`Message` スキーマに `reactions` フィールドを追加:

```yaml
Message:
  type: object
  properties:
    id:
      type: string
      format: uuid
    conversationId:
      type: string
      format: uuid
    senderUserId:
      type: string
      format: uuid
      nullable: true
    type:
      type: string
      enum: [text, system]
    text:
      type: string
      nullable: true
    replyToMessageId:
      type: string
      format: uuid
      nullable: true
    systemEvent:
      type: string
      enum: [join, leave]
      nullable: true
    createdAt:
      type: string
      format: date-time
    reactions:  # 追加
      type: array
      items:
        $ref: '#/components/schemas/Reaction'
  required:
    - id
    - conversationId
    - type
    - createdAt
    - reactions  # 必須フィールドとして追加
```

### 2.2 型生成

```bash
npm run generate:api
```

### 2.3 Repository層の実装拡張

**ファイル:** `apps/backend/src/repositories/drizzleChatRepository.ts`

`listMessages` メソッドを修正:

```typescript
async listMessages(conversationId: string, options: MessageQueryOptions = {}): Promise<Message[]> {
  const { before, limit = 50 } = options

  // 1. メッセージを取得
  const messageRows = await this.client
    .select()
    .from(messages)
    .where(
      before
        ? and(eq(messages.conversationId, conversationId), lt(messages.createdAt, before))
        : eq(messages.conversationId, conversationId),
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit)

  // 2. 各メッセージのリアクションを取得
  const messagesWithReactions = await Promise.all(
    messageRows.map(async (msgRow) => {
      const reactionRows = await this.client
        .select()
        .from(reactions)
        .where(eq(reactions.messageId, msgRow.id))

      return {
        ...mapMessage(msgRow),
        reactions: reactionRows.map(mapReaction),
      }
    })
  )

  return messagesWithReactions
}
```

**注意:** パフォーマンス最適化（一括取得、JOIN等）は後続タスクで対応予定

### 2.4 テスト更新

**ファイル:** `apps/backend/src/routes/conversations.test.ts`

既存のメッセージ一覧取得テストを更新:

- `reactions` フィールドが配列として存在することを確認
- リアクションがある場合とない場合の両方を検証

```typescript
it('includes reactions in message list', async () => {
  // メッセージにリアクションを追加
  // メッセージ一覧を取得
  // reactionsフィールドが含まれていることを検証
})
```

**ファイル:** `apps/backend/src/routes/__snapshots__/messages.test.ts.snap`

- スナップショットの更新が必要（`reactions: []` が含まれる）

---

## 実装ステップ（チェックリスト）

### フェーズ1: リアクション一覧取得API

- [ ] 1. OpenAPIスキーマ追加 (`GET /messages/{id}/reactions`)
- [ ] 2. 型生成 (`npm run generate:api`)
- [ ] 3. Repository インターフェース追加 (`chatRepository.ts`)
- [ ] 4. Repository 実装 (`drizzleChatRepository.ts` - `listReactions`)
- [ ] 5. Usecase 実装 (`chatUsecase.ts` - `listReactions`)
- [ ] 6. Router 実装 (`messages.ts` - `GET /:id/reactions`)
- [ ] 7. テスト実装 (`messages.test.ts`)
- [ ] 8. テスト実行・確認

### フェーズ2: メッセージにリアクションを含める

- [ ] 1. OpenAPIスキーマ更新 (Messageに`reactions`フィールド追加)
- [ ] 2. 型生成 (`npm run generate:api`)
- [ ] 3. Repository実装修正 (`drizzleChatRepository.ts` - `listMessages`)
- [ ] 4. 既存テスト更新 (`conversations.test.ts`)
- [ ] 5. スナップショット更新
- [ ] 6. テスト実行・確認

---

## 技術的な詳細

### リアクションのデータ構造

```typescript
// Reaction型（既存）
interface Reaction {
  id: string           // UUID
  messageId: string    // UUID
  userId: string       // UUID
  emoji: string        // 絵文字文字列
  createdAt: string    // ISO 8601日時
}

// Message型（更新後）
interface Message {
  id: string
  conversationId: string
  senderUserId?: string | null
  type: 'text' | 'system'
  text?: string | null
  replyToMessageId?: string | null
  systemEvent?: 'join' | 'leave' | null
  createdAt: string
  reactions: Reaction[]  // 追加
}
```

### データベーススキーマ

既存のreactionsテーブル:

```sql
CREATE TABLE reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);
```

---

## 将来的な改善案（後続タスク）

### パフォーマンス最適化

1. **一括取得方式への変更**
   - メッセージIDを集めて `WHERE message_id IN (...)` で一括取得
   - N+1問題の解消

2. **インデックスの確認・追加**
   - `reactions.message_id` にインデックスが適切に設定されているか確認

3. **ページネーション対応**
   - リアクション数が多い場合の対応

### 機能拡張

1. **リアクション集約API**
   - 絵文字ごとにグルーピングした集約データを返すエンドポイント
   - `{ emoji: '👍', count: 5, userIds: [...] }` 形式

2. **リアクション通知機能**
   - リアクションが追加されたときの通知

---

## 関連ドキュメント

- [OpenAPI仕様](../../packages/openapi/openapi.yaml)
- [Messages API ドキュメント](../../apps/docs/docs/api/messages.md)
- [データベーススキーマ](../../apps/backend/src/infrastructure/db/schema.ts)

---

## 変更履歴

- 2025-12-17: 初版作成
