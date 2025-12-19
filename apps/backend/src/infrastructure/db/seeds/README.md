# Database Seeds

このディレクトリには、データベースの seed データを管理するためのツールが含まれています。

## 🔐 認証付きシードデータ (New!)

### 実行順序

1. **001_auth_users.ts** - 認証ユーザー作成
2. **002_chat_users.sql** - チャットユーザー作成（認証ユーザーにリンク）

### 001_auth_users.ts

20人の初期ユーザーに対して認証情報を作成し、チャットユーザーとリンクします。

**ログイン情報:**
- **ユーザー名**: alice, bob, carol, dave, eve, frank, grace, heidi, ivan, judy, kevin, laura, michael, nancy, oscar, peggy, quinn, rachel, steve, tina
- **パスワード**: Password

**実行方法:**
```bash
# ローカル開発環境
npm run db:seed
```

**機能:**
- `auth_user` テーブルにユーザーを作成
- BetterAuth の API を使用してパスワードを安全にハッシュ化
- 各認証ユーザーを対応するチャットユーザー（`users`テーブル）に `authUserId` でリンク
- 既に認証情報が設定されているユーザーはスキップ

---

## アーキテクチャ

### Seed データの管理

Seed データは `drizzle/seeds/` ディレクトリの SQL ファイルで管理されています：

#### Seed ファイルの種類

1. **`001_users.sql`** - ユーザーデータのみ（D1 環境用）
   - 10人のユーザー（Alice, Bob, Carol, Dave, Eve, Frank, Grace, Heidi, Ivan, Judy）
   - Cloudflare Workers / D1 環境で使用

2. **`001_initial_data.sql`** - 完全な初期データ（Local 環境用）
   - 10人のユーザー（`001_users.sql` と同じ）
   - サンプル会話、メッセージ、リアクション、既読管理、ブックマーク
   - ローカル開発環境で使用

#### 環境別の使い分け

- **Local 環境**: `runner.ts` が `001_initial_data.sql` を読み込んで実行（全データ）
- **D1 環境**: Wrangler CLI が `001_users.sql` を実行（ユーザーのみ）

この設計により、ローカル開発では豊富なサンプルデータでテストでき、D1 環境では必要最小限のデータのみを投入できます。

## 使用方法

### ローカル開発環境

#### 自動実行（推奨）

`npm run dev` でサーバーを起動すると、データベースが空の場合に自動的に seed が実行されます。

```bash
npm run dev
```

#### 手動実行

```bash
npm run db:seed
```

### D1 環境

#### ローカル D1

```bash
npm run d1:seed:local
```

#### リモート D1

```bash
npm run d1:seed:remote
```

## Seed ファイルの管理

### 新しい seed ファイルの追加

1. `drizzle/seeds/` ディレクトリに新しい SQL ファイルを作成（例：`002_additional_data.sql`）
2. `runner.ts` を更新して新しいファイルを読み込むように設定
3. D1 用の npm スクリプトを追加

### Seed データの更新

既存の SQL ファイル（`drizzle/seeds/001_initial_data.sql`）を編集します。

変更後、データベースをリセットして新しい seed を適用：

```bash
# ローカル開発環境
rm dev.db
npm run dev

# または手動で
npm run db:seed
```

## 実装の詳細

### runner.ts

- `drizzle/seeds/` の SQL ファイルを読み込み
- 開発モード（`NODE_ENV=development`）でのみ実行
- データが既に存在する場合はスキップ
- SQL 文を分割して順次実行

### 環境による違い

| 環境 | データベース | Seed ファイル | Seed 実行方法 | データ内容 |
|------|------------|--------------|--------------|----------|
| Local Dev | better-sqlite3 (dev.db) | `001_initial_data.sql` | runner.ts | ユーザー + 会話 + メッセージなど |
| Test | better-sqlite3 (:memory:) | - | テストコード内で必要に応じて | テストケースごとに作成 |
| D1 Local | D1 (local) | `001_users.sql` | Wrangler CLI | ユーザーのみ |
| D1 Remote | D1 (remote) | `001_users.sql` | Wrangler CLI | ユーザーのみ |

### ユーザーデータの一貫性

すべての環境で同じ10人のユーザー（Alice, Bob, Carol, Dave, Eve, Frank, Grace, Heidi, Ivan, Judy）を使用します。
ユーザー ID とアバター URL も統一されているため、環境間でのデータの互換性が保証されます。
