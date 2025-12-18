# 認証機能の現状整理

## 現状サマリー

**認証ミドルウェアは実装されているが、チャット系APIには適用されていない**

### ✅ 実装済み

1. **BetterAuth認証システム**
   - Username/Password認証
   - セッション管理（Cookie-based）
   - 認証用データベーステーブル（`auth_user`, `auth_session`, etc.）

2. **認証エンドポイント** (`/api/auth/*`)
   - POST /api/auth/sign-up/email
   - POST /api/auth/sign-in/username
   - GET /api/auth/get-session
   - POST /api/auth/sign-out

3. **認証ミドルウェア** (`src/middleware/requireAuth.ts`)
   - `requireAuth`: 認証必須（401エラーを返す）
   - `optionalAuth`: 認証オプショナル（認証状態を取得するが必須ではない）

4. **保護されたエンドポイント例** (`/api/protected/*`)
   - GET /api/protected/me - 認証ユーザー情報
   - GET /api/protected/profile - プロフィール取得
   - PUT /api/protected/profile/name - プロフィール更新
   - GET /api/protected/public - オプショナル認証デモ

### ❌ 未適用

**チャット系APIには認証チェックが実装されていない**

現在、以下のエンドポイントは**誰でもアクセス可能**な状態です：

#### 1. Conversations API (`/conversations`)

```typescript
// src/routes/conversations.ts
// 認証ミドルウェアなし ❌

GET /conversations?userId=xxx           // 会話一覧取得
POST /conversations                     // 会話作成
GET /conversations/:id                  // 会話詳細取得
POST /conversations/:id/participants    // 参加者追加
DELETE /conversations/:id/participants/:userId  // 参加者削除
GET /conversations/:id/messages         // メッセージ一覧
POST /conversations/:id/messages        // メッセージ送信
POST /conversations/:id/read            // 既読更新
GET /conversations/:id/unread-count     // 未読数取得
```

**現在の認証方式**: `userId` をクエリパラメータまたはリクエストボディで受け取る

**問題点**:
- ユーザーIDを偽装可能
- 他人の会話を閲覧・操作できる
- なりすましが可能

#### 2. Messages API (`/messages`)

```typescript
// src/routes/messages.ts
// 認証ミドルウェアなし ❌

DELETE /messages/:id?userId=xxx              // メッセージ削除
GET /messages/:id/reactions                  // リアクション一覧
POST /messages/:id/reactions                 // リアクション追加
DELETE /messages/:id/reactions/:emoji?userId=xxx  // リアクション削除
POST /messages/:id/bookmarks                 // ブックマーク追加
DELETE /messages/:id/bookmarks?userId=xxx    // ブックマーク削除
```

**現在の認証方式**: `userId` をクエリパラメータまたはリクエストボディで受け取る

**問題点**:
- ユーザーIDを偽装して他人のメッセージを削除可能
- 他人のリアクション・ブックマークを操作可能

#### 3. Users API (`/users`)

```typescript
// src/routes/users.ts
// 一部のエンドポイントにdevOnlyミドルウェアあり

GET /users                    // ユーザー一覧（devOnly ✅）
POST /users                   // ユーザー作成（devOnly ✅）
GET /users/:userId            // ユーザー取得（認証なし ❌）
GET /users/:userId/bookmarks  // ブックマーク一覧（認証なし ❌）
POST /users/login             // 旧ログイン（idAlias方式、認証なし ❌）
```

**問題点**:
- 誰でも任意のユーザー情報を取得可能
- 誰でも任意のユーザーのブックマークを閲覧可能

## 認証ミドルウェアの詳細

### requireAuth ミドルウェア

認証必須のエンドポイントに適用。未認証の場合は401エラーを返す。

```typescript
import { requireAuth } from '../middleware/requireAuth'

// 使用例
router.get('/protected', requireAuth, async (c) => {
  const authUser = c.get('authUser')     // 認証ユーザー情報
  const authSession = c.get('authSession') // セッション情報

  // authUser.id を使用して認証済みユーザーのリソースのみ操作
  return c.json({ user: authUser })
})
```

**利用可能な変数**:
- `c.get('authUser')`: 認証済みユーザー情報
  - `id`: ユーザーID
  - `username`: ユーザー名
  - `email`: メールアドレス
  - `name`: 表示名
  - その他のユーザー情報
- `c.get('authSession')`: セッション情報
  - `id`: セッションID
  - `expiresAt`: 有効期限

### optionalAuth ミドルウェア

認証はオプショナル。認証されている場合は情報を取得し、未認証でも処理を継続。

```typescript
import { optionalAuth } from '../middleware/requireAuth'

// 使用例
router.get('/public', optionalAuth, async (c) => {
  const authUser = c.get('authUser')

  if (authUser) {
    return c.json({ message: `Hello, ${authUser.username}!` })
  } else {
    return c.json({ message: 'Hello, guest!' })
  }
})
```

## 推奨される修正方針

### Option 1: 全エンドポイントに認証を必須化（推奨）

すべてのチャット系APIに`requireAuth`ミドルウェアを適用し、`userId`パラメータを廃止。

**メリット**:
- セキュリティが大幅に向上
- なりすまし・不正アクセス防止
- クライアント実装がシンプル（`userId`を送る必要がない）

**変更例**:

```typescript
// Before ❌
router.get('/', async c => {
  const userId = c.req.query('userId')  // クライアントから送信
  const conversations = await chatUsecase.listConversationsForUser(userId ?? '')
  return c.json(conversations)
})

// After ✅
router.get('/', requireAuth, async c => {
  const authUser = c.get('authUser')
  const userId = authUser!.id  // セッションから取得（改ざん不可）
  const conversations = await chatUsecase.listConversationsForUser(userId)
  return c.json(conversations)
})
```

**必要な修正箇所**:

1. **conversations.ts** - すべてのエンドポイントに`requireAuth`を追加
2. **messages.ts** - すべてのエンドポイントに`requireAuth`を追加
3. **users.ts** - 一部のエンドポイントに`requireAuth`を追加

### Option 2: 段階的な移行

開発用の旧エンドポイント（`userId`パラメータ方式）を残しつつ、新しい認証付きエンドポイントを追加。

```typescript
// 旧エンドポイント（開発用のみ）
router.get('/', devOnly, async c => {
  const userId = c.req.query('userId')
  // ...
})

// 新エンドポイント（本番用）
router.get('/auth', requireAuth, async c => {
  const userId = c.get('authUser')!.id
  // ...
})
```

**メリット**:
- 既存のクライアントコードを破壊しない
- 段階的な移行が可能

**デメリット**:
- エンドポイントが重複
- 将来的に旧エンドポイントの削除が必要

### Option 3: auth_user と users テーブルの連携

現在、認証ユーザー（`auth_user`）とチャットユーザー（`users`）が分離されています。

**現在の設計**:
- `auth_user`: BetterAuthが管理（認証専用）
- `users`: アプリケーションが管理（チャット機能用、`id_alias`あり）
- `users.auth_user_id`: `auth_user.id`への外部キー

**統合が必要な場合の対応**:

1. ユーザー登録時に自動的にチャットユーザーも作成
2. `auth_user.id` → `users.auth_user_id` のマッピングを常に確認
3. 認証ミドルウェアでチャットユーザー情報も取得

```typescript
// 例: 認証済みユーザーのチャットプロフィール取得
router.get('/profile', requireAuth, async (c) => {
  const authUser = c.get('authUser')

  // auth_user.id からチャットユーザーを検索
  const chatUser = await db
    .select()
    .from(users)
    .where(eq(users.authUserId, authUser!.id))
    .get()

  return c.json({
    auth: authUser,
    chat: chatUser
  })
})
```

## 具体的な修正例

### 修正例 1: GET /conversations（会話一覧）

#### Before（現在）
```typescript
// ❌ セキュリティリスクあり
router.get('/', async c => {
  const userId = c.req.query('userId')  // クライアントが送信
  try {
    const db = await getDbClient(c)
    const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
    const conversations = await chatUsecase.listConversationsForUser(userId ?? '')
    return c.json(conversations)
  } catch (error) {
    return handleError(error, c)
  }
})
```

**問題**: `userId`を偽装すれば他人の会話を閲覧可能

#### After（推奨）
```typescript
// ✅ セキュア
import { requireAuth } from '../middleware/requireAuth'
import type { AuthVariables } from '../infrastructure/auth'

const router = new Hono<{
  Bindings: Env
  Variables: AuthVariables  // 認証変数の型定義
}>()

router.get('/', requireAuth, async c => {
  const authUser = c.get('authUser')
  const userId = authUser!.id  // セッションから取得（改ざん不可）

  try {
    const db = await getDbClient(c)
    const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
    const conversations = await chatUsecase.listConversationsForUser(userId)
    return c.json(conversations)
  } catch (error) {
    return handleError(error, c)
  }
})
```

### 修正例 2: DELETE /messages/:id（メッセージ削除）

#### Before（現在）
```typescript
// ❌ セキュリティリスクあり
router.delete('/:id', async c => {
  const messageId = c.req.param('id')
  const userId = c.req.query('userId')  // クライアントが送信

  if (!userId) {
    return c.json({ message: 'userId is required' }, 400)
  }

  try {
    const db = await getDbClient(c)
    const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
    await chatUsecase.deleteMessage(messageId, userId)
    return c.body(null, 204)
  } catch (error) {
    return handleError(error, c)
  }
})
```

**問題**: `userId`を偽装すれば他人のメッセージを削除可能

#### After（推奨）
```typescript
// ✅ セキュア
router.delete('/:id', requireAuth, async c => {
  const messageId = c.req.param('id')
  const authUser = c.get('authUser')
  const userId = authUser!.id  // セッションから取得（改ざん不可）

  try {
    const db = await getDbClient(c)
    const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
    await chatUsecase.deleteMessage(messageId, userId)
    return c.body(null, 204)
  } catch (error) {
    return handleError(error, c)
  }
})
```

### 修正例 3: POST /conversations/:id/messages（メッセージ送信）

#### Before（現在）
```typescript
// ❌ セキュリティリスクあり
router.post('/:id/messages', async c => {
  const conversationId = c.req.param('id')
  try {
    const db = await getDbClient(c)
    const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
    const payload = SendMessageRequestSchema.parse(await c.req.json())
    // payload.senderUserId をそのまま信用（改ざん可能）
    const message = await chatUsecase.sendMessage(conversationId, payload)
    return c.json(message, 201)
  } catch (error) {
    return handleError(error, c)
  }
})
```

**問題**: `senderUserId`を偽装して他人になりすましてメッセージ送信可能

#### After（推奨）
```typescript
// ✅ セキュア
router.post('/:id/messages', requireAuth, async c => {
  const conversationId = c.req.param('id')
  const authUser = c.get('authUser')

  try {
    const db = await getDbClient(c)
    const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
    const body = await c.req.json()

    // クライアントから送信されたsenderUserIdは無視し、
    // 認証済みユーザーIDで上書き
    const payload = SendMessageRequestSchema.parse({
      ...body,
      senderUserId: authUser!.id  // セッションから取得（改ざん不可）
    })

    const message = await chatUsecase.sendMessage(conversationId, payload)
    return c.json(message, 201)
  } catch (error) {
    return handleError(error, c)
  }
})
```

## クライアント側の変更

### Before（現在）

```typescript
// ❌ userIdを毎回送信する必要がある
const getConversations = async (userId: string) => {
  const response = await fetch(`/conversations?userId=${userId}`)
  return response.json()
}

const sendMessage = async (conversationId: string, userId: string, text: string) => {
  const response = await fetch(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      senderUserId: userId,  // 改ざん可能
      text
    })
  })
  return response.json()
}
```

### After（推奨）

```typescript
// ✅ クッキーで自動認証、userIdは不要
const getConversations = async () => {
  const response = await fetch('/conversations', {
    credentials: 'include'  // セッションクッキーを自動送信
  })

  if (response.status === 401) {
    // 未認証 → ログイン画面へリダイレクト
    throw new Error('Unauthorized')
  }

  return response.json()
}

const sendMessage = async (conversationId: string, text: string) => {
  const response = await fetch(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // セッションクッキーを自動送信
    body: JSON.stringify({
      // senderUserIdは不要（サーバー側で自動設定）
      text
    })
  })

  if (response.status === 401) {
    throw new Error('Unauthorized')
  }

  return response.json()
}
```

**メリット**:
- `userId`の管理が不要
- セキュリティ向上（改ざん不可）
- コードがシンプル

## まとめ

### 現状
- ✅ 認証システムは完全に実装済み
- ✅ 認証ミドルウェアは利用可能
- ❌ **チャット系APIには認証が適用されていない**
- ❌ `userId`パラメータ方式でセキュリティリスクあり

### 推奨アクション

**優先度: 高**
1. すべてのチャット系エンドポイントに`requireAuth`ミドルウェアを適用
2. `userId`クエリパラメータ/リクエストボディを削除
3. 認証済みユーザーのIDをセッションから取得

**優先度: 中**
4. OpenAPI specを更新（全エンドポイントに`security`定義追加）
5. クライアントコードを更新（`credentials: 'include'`追加、`userId`削除）
6. テストを更新（認証付きリクエストに変更）

**優先度: 低（将来の拡張）**
7. 権限チェック（会話の参加者のみアクセス可能など）
8. レート制限
9. 監査ログ

### セキュリティリスク評価

現在の実装では、以下のセキュリティリスクが存在します：

| リスク | 深刻度 | 影響 |
|--------|--------|------|
| 他人の会話を閲覧 | **高** | プライバシー侵害 |
| なりすましメッセージ送信 | **高** | データ整合性の破損 |
| 他人のメッセージ削除 | **高** | データ損失 |
| 他人のリアクション操作 | 中 | データ整合性の破損 |
| 他人のブックマーク閲覧 | 中 | プライバシー侵害 |

**結論**: 本番環境にデプロイする前に、必ず認証ミドルウェアの適用が必要です。
