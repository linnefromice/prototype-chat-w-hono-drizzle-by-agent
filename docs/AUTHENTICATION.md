# Authentication Implementation Guide

## 概要

このAPIは、**BetterAuth**を使用したセッションベースの認証システムを実装しています。ユーザー名とパスワードによる認証をサポートし、HTTPOnlyクッキーを使用してセッションを管理します。

## 技術スタック

- **認証ライブラリ**: [BetterAuth](https://www.better-auth.com/) v1.x
- **認証方式**: Username/Password (BetterAuth username plugin)
- **セッション管理**: Cookie-based sessions (HttpOnly)
- **データベース**: SQLite (Cloudflare D1 / BetterSQLite3)
- **ORM**: Drizzle ORM
- **パスワードハッシュ**: BetterAuthが自動的にbcrypt相当の処理を実行

## データベーススキーマ

### 認証関連テーブル

#### 1. `auth_user` テーブル
コア認証情報を保存（BetterAuthが管理）

```sql
CREATE TABLE auth_user (
  id TEXT PRIMARY KEY,              -- ユーザーID (UUID形式)
  username TEXT NOT NULL UNIQUE,    -- ユーザー名 (3-20文字、英数字とアンダースコア)
  email TEXT NOT NULL UNIQUE,       -- メールアドレス (必須)
  emailVerified INTEGER,            -- メール確認済みフラグ (boolean)
  name TEXT NOT NULL,               -- 表示名
  image TEXT,                       -- プロフィール画像URL (nullable)
  createdAt INTEGER NOT NULL,       -- 作成日時 (Unix timestamp)
  updatedAt INTEGER NOT NULL        -- 更新日時 (Unix timestamp)
);

CREATE UNIQUE INDEX auth_user_email_idx ON auth_user(email);
CREATE UNIQUE INDEX auth_user_username_idx ON auth_user(username);
```

**重要な制約**:
- ユーザー名は**大文字小文字を区別しない** (ログイン時)
- ユーザー名は英数字とアンダースコアのみ（ハイフンは不可）
- メールアドレスは必須

#### 2. `auth_session` テーブル
セッション情報を保存

```sql
CREATE TABLE auth_session (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,       -- セッション期限 (7日間)
  token TEXT NOT NULL UNIQUE,       -- セッショントークン
  ipAddress TEXT,
  userAgent TEXT,
  FOREIGN KEY (userId) REFERENCES auth_user(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX auth_session_token_idx ON auth_session(token);
CREATE INDEX auth_session_user_id_idx ON auth_session(userId);
```

**セッション設定**:
- 有効期限: 7日間 (`expiresIn: 60 * 60 * 24 * 7`)
- 更新間隔: 24時間 (`updateAge: 60 * 60 * 24`)

#### 3. `auth_account` テーブル
外部OAuth連携用（将来の拡張用）

```sql
CREATE TABLE auth_account (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  accessToken TEXT,
  refreshToken TEXT,
  expiresAt INTEGER,
  password TEXT,                    -- ローカル認証用ハッシュ化パスワード
  FOREIGN KEY (userId) REFERENCES auth_user(id) ON DELETE CASCADE
);

CREATE INDEX auth_account_provider_account_idx
  ON auth_account(providerId, accountId);
```

#### 4. `auth_verification` テーブル
メール確認・パスワードリセット用

```sql
CREATE TABLE auth_verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER,
  updatedAt INTEGER
);

CREATE INDEX auth_verification_identifier_idx ON auth_verification(identifier);
```

#### 5. `users` テーブル (Chat Users)
チャット機能用のユーザー情報

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  id_alias TEXT NOT NULL UNIQUE,   -- ユーザーID別名 (3-30文字)
  auth_user_id TEXT UNIQUE,         -- auth_userへの参照
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (auth_user_id) REFERENCES auth_user(id) ON DELETE CASCADE
);
```

**設計の意図**:
- `auth_user`: 認証専用（BetterAuthが管理）
- `users`: チャット機能専用（アプリケーションが管理）
- 分離することで、認証とビジネスロジックを独立させ、将来的な拡張性を確保

## API エンドポイント

### 認証エンドポイント

#### 1. ユーザー登録
```
POST /api/auth/sign-up/email
```

**リクエスト**:
```json
{
  "username": "user123",
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "User Name"
}
```

**バリデーション**:
- `username`: 3-20文字、英数字とアンダースコアのみ、大文字小文字区別なし
- `email`: 有効なメールアドレス形式（必須）
- `password`: 8文字以上
- `name`: 表示名（必須）

**レスポンス** (200 OK):
```json
{
  "user": {
    "id": "cm5abc123...",
    "username": "user123",
    "email": "user@example.com",
    "name": "User Name",
    "emailVerified": false,
    "image": null,
    "createdAt": "2025-12-18T12:00:00.000Z",
    "updatedAt": "2025-12-18T12:00:00.000Z"
  },
  "token": "abc123..."
}
```

**Set-Cookie ヘッダー**:
```
better-auth.session_token=<token>; Path=/; HttpOnly; SameSite=Lax
```

**エラーレスポンス** (400):
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Username already exists"
}
```

#### 2. ログイン
```
POST /api/auth/sign-in/username
```

**リクエスト**:
```json
{
  "username": "user123",
  "password": "SecurePass123!"
}
```

**注意**: ユーザー名は大文字小文字を区別しません（`user123` = `USER123` = `User123`）

**レスポンス** (200 OK):
```json
{
  "user": {
    "id": "cm5abc123...",
    "username": "user123",
    "email": "user@example.com",
    "name": "User Name",
    "emailVerified": false,
    "image": null,
    "createdAt": "2025-12-18T12:00:00.000Z",
    "updatedAt": "2025-12-18T12:00:00.000Z"
  }
}
```

**Set-Cookie ヘッダー**:
```
better-auth.session_token=<token>; Path=/; HttpOnly; SameSite=Lax
```

**エラーレスポンス** (401):
```json
{
  "code": "INVALID_CREDENTIALS",
  "message": "Invalid username or password"
}
```

#### 3. セッション取得
```
GET /api/auth/get-session
```

**ヘッダー**:
```
Cookie: better-auth.session_token=<token>
```

**レスポンス** (200 OK - 認証済み):
```json
{
  "session": {
    "id": "session123",
    "expiresAt": "2025-12-25T12:00:00.000Z",
    "userId": "cm5abc123...",
    "token": "abc123..."
  },
  "user": {
    "id": "cm5abc123...",
    "username": "user123",
    "email": "user@example.com",
    "name": "User Name",
    "emailVerified": false,
    "image": null,
    "createdAt": "2025-12-18T12:00:00.000Z",
    "updatedAt": "2025-12-18T12:00:00.000Z"
  }
}
```

**レスポンス** (200 OK - 未認証):
```json
null
```

#### 4. ログアウト
```
POST /api/auth/sign-out
```

**ヘッダー**:
```
Cookie: better-auth.session_token=<token>
```

**レスポンス** (200 OK):
```
(空のレスポンス)
```

**Set-Cookie ヘッダー** (クッキー削除):
```
better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
```

### 保護されたエンドポイント

#### 5. 認証ユーザー情報取得
```
GET /api/protected/me
```

**ヘッダー** (必須):
```
Cookie: better-auth.session_token=<token>
```

**レスポンス** (200 OK):
```json
{
  "user": {
    "id": "cm5abc123...",
    "username": "user123",
    "name": "User Name",
    "email": "user@example.com",
    "emailVerified": false
  },
  "session": {
    "id": "session123",
    "expiresAt": "2025-12-25T12:00:00.000Z"
  }
}
```

**エラーレスポンス** (401):
```json
{
  "error": "Unauthorized"
}
```

#### 6. ユーザープロフィール取得
```
GET /api/protected/profile
```

**レスポンス** (200 OK):
```json
{
  "auth": {
    "id": "cm5abc123...",
    "username": "user123",
    "name": "User Name",
    "email": "user@example.com"
  },
  "chat": {
    "id": "uuid-chat-user",
    "idAlias": "user_alias",
    "name": "Chat Display Name",
    "avatarUrl": "https://example.com/avatar.png"
  }
}
```

**注意**: `chat`は`null`の場合があります（チャットユーザーが未作成の場合）

#### 7. プロフィール名更新
```
PUT /api/protected/profile/name
```

**リクエスト**:
```json
{
  "name": "New Display Name"
}
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "chatUser": {
    "id": "uuid-chat-user",
    "idAlias": "user_alias",
    "name": "New Display Name",
    "avatarUrl": "https://example.com/avatar.png"
  }
}
```

#### 8. 公開エンドポイント (オプショナル認証)
```
GET /api/protected/public
```

**レスポンス** (認証済み):
```json
{
  "message": "Hello, user123!",
  "authenticated": true
}
```

**レスポンス** (未認証):
```json
{
  "message": "Hello, guest!",
  "authenticated": false
}
```

## クライアント実装ガイド

### 1. ユーザー登録フロー

```typescript
// 1. ユーザー登録
const signUp = async (username: string, email: string, password: string, name: string) => {
  const response = await fetch('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // クッキーを自動的に送受信
    body: JSON.stringify({ username, email, password, name })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const data = await response.json();
  return data.user;
};

// 使用例
try {
  const user = await signUp('john_doe', 'john@example.com', 'SecurePass123!', 'John Doe');
  console.log('登録成功:', user);
  // クッキーは自動的に保存されるため、追加処理は不要
} catch (error) {
  console.error('登録失敗:', error.message);
}
```

### 2. ログインフロー

```typescript
// 1. ログイン
const signIn = async (username: string, password: string) => {
  const response = await fetch('/api/auth/sign-in/username', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    throw new Error('Invalid credentials');
  }

  const data = await response.json();
  return data.user;
};

// 使用例
try {
  const user = await signIn('john_doe', 'SecurePass123!');
  console.log('ログイン成功:', user);
  // リダイレクトやホーム画面への遷移
} catch (error) {
  console.error('ログイン失敗:', error.message);
}
```

### 3. セッション確認フロー

```typescript
// アプリ起動時やページ読み込み時にセッションを確認
const checkSession = async () => {
  const response = await fetch('/api/auth/get-session', {
    credentials: 'include'
  });

  const session = await response.json();

  if (session) {
    console.log('ログイン済み:', session.user);
    return session.user;
  } else {
    console.log('未ログイン');
    return null;
  }
};

// 使用例（React）
useEffect(() => {
  checkSession().then(user => {
    if (user) {
      setCurrentUser(user);
    } else {
      // ログイン画面にリダイレクト
      router.push('/login');
    }
  });
}, []);
```

### 4. 保護されたAPIの呼び出し

```typescript
// 認証が必要なエンドポイントへのリクエスト
const fetchProtectedData = async () => {
  const response = await fetch('/api/protected/me', {
    credentials: 'include' // セッションクッキーを送信
  });

  if (response.status === 401) {
    // 未認証の場合
    throw new Error('Please login');
  }

  const data = await response.json();
  return data;
};

// プロフィール更新
const updateProfileName = async (name: string) => {
  const response = await fetch('/api/protected/profile/name', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name })
  });

  if (!response.ok) {
    throw new Error('Failed to update profile');
  }

  return await response.json();
};
```

### 5. ログアウトフロー

```typescript
const signOut = async () => {
  const response = await fetch('/api/auth/sign-out', {
    method: 'POST',
    credentials: 'include'
  });

  if (response.ok) {
    console.log('ログアウト成功');
    // ログイン画面にリダイレクト
    window.location.href = '/login';
  }
};
```

### 6. エラーハンドリング

```typescript
// グローバルエラーハンドラー
const handleAuthError = (error: any) => {
  if (error.status === 401) {
    // セッション切れ
    console.log('Session expired. Please login again.');
    window.location.href = '/login';
  } else if (error.status === 400) {
    // バリデーションエラー
    const message = error.message || 'Validation error';
    alert(message);
  } else {
    // その他のエラー
    console.error('Unexpected error:', error);
  }
};

// Fetch ラッパー
const authFetch = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw { status: response.status, message: error.message };
  }

  return response.json();
};
```

## セキュリティ考慮事項

### 1. クッキー設定

- **HttpOnly**: JavaScriptからアクセス不可（XSS攻撃対策）
- **SameSite=Lax**: CSRF攻撃対策
- **Secure**: HTTPS環境で送信（本番環境）
- **Path=/**: すべてのパスで有効

### 2. パスワード要件

- 最小8文字
- BetterAuthが自動的にbcryptでハッシュ化
- 平文パスワードは保存されない

### 3. セッション管理

- セッション有効期限: 7日間
- 自動延長: 24時間ごとに更新
- ログアウト時に即座に無効化

### 4. CORS設定

クライアントアプリが異なるドメインから接続する場合、サーバー側でCORS設定が必要：

```typescript
// Honoでの設定例
import { cors } from 'hono/cors'

app.use('/api/*', cors({
  origin: 'http://localhost:3001', // クライアントのオリジン
  credentials: true, // クッキーの送受信を許可
}))
```

### 5. 推奨事項

- **HTTPS**: 本番環境では必ずHTTPSを使用
- **レート制限**: ログイン試行の制限を実装（将来の拡張）
- **2要素認証**: 将来的にTOTPプラグインを追加可能
- **メール確認**: 現在は無効化されているが、有効化を推奨

## トラブルシューティング

### クッキーが保存されない

**原因**: `credentials: 'include'` が設定されていない

**解決策**:
```typescript
fetch(url, {
  credentials: 'include' // 必須
})
```

### CORS エラー

**原因**: サーバー側のCORS設定が不足

**解決策**: サーバー側で `credentials: true` を設定

### セッションが即座に切れる

**原因**: クッキーのドメインまたはパスが一致しない

**解決策**: ブラウザのDevToolsでクッキーを確認し、正しく保存されているか確認

### 401 エラーが頻発する

**原因**: セッションの有効期限切れまたはクッキーが送信されていない

**解決策**:
1. `credentials: 'include'` を確認
2. セッション有効期限を確認（7日間）
3. ログアウトして再ログイン

## TypeScript 型定義

```typescript
// Request types
export type SignUpRequest = {
  username: string;     // 3-20文字、英数字とアンダースコア
  email: string;        // 有効なメールアドレス
  password: string;     // 最小8文字
  name: string;         // 表示名
};

export type SignInRequest = {
  username: string;     // 大文字小文字区別なし
  password: string;
};

// Response types
export type AuthUser = {
  id: string;
  username: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;    // ISO 8601形式
  updatedAt: string;
};

export type AuthResponse = {
  user: AuthUser;
  token?: string;       // オプショナル
};

export type SessionResponse = {
  session: {
    id: string;
    expiresAt: string;
    userId: string;
    token: string;
  };
  user: AuthUser;
} | null;

export type AuthUserInfo = {
  user: {
    id: string;
    username: string;
    name: string;
    email: string;
    emailVerified: boolean;
  };
  session: {
    id: string;
    expiresAt: string;
  };
};

export type UserProfile = {
  auth: {
    id: string;
    username: string;
    name: string;
    email: string;
  };
  chat: {
    id: string;
    idAlias: string;
    name: string;
    avatarUrl: string | null;
  } | null;
};
```

## 将来の拡張性

### 1. OAuth連携

BetterAuthは以下のプロバイダーをサポート：
- GitHub
- Google
- Discord
- その他多数

設定例：
```typescript
// config.ts
socialProviders: {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  }
}
```

### 2. 2要素認証 (TOTP)

```typescript
import { twoFactor } from 'better-auth/plugins'

plugins: [
  username(),
  twoFactor({
    issuer: "YourAppName",
  })
]
```

### 3. メール確認

```typescript
emailAndPassword: {
  enabled: true,
  requireEmailVerification: true, // 有効化
}
```

## まとめ

- **認証方式**: Username/Password (Cookie-based sessions)
- **セッション管理**: HttpOnly クッキー、7日間有効
- **データベース**: SQLite (auth_user, auth_session, auth_account, auth_verification)
- **セキュリティ**: bcryptパスワードハッシュ、HttpOnly/SameSite クッキー
- **クライアント**: `credentials: 'include'` を常に設定
- **拡張性**: OAuth, 2FA, メール確認などの追加が容易

詳細な実装や質問がある場合は、[BetterAuth公式ドキュメント](https://www.better-auth.com/docs)を参照してください。
