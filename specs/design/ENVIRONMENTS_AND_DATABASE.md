# 環境パターンとデータベース管理

このドキュメントでは、プロジェクトの環境パターン、データベース構築方法、シードデータ投入方法について説明します。

## 環境パターン

このプロジェクトには **3つの主要な開発・実行環境** があります。

### 1. Local 環境（通常のローカル開発）

**概要**: Node.js ベースの通常のローカル開発環境

**技術スタック**:
- ランタイム: Node.js
- サーバー: `@hono/node-server`
- データベース: `better-sqlite3` + ファイルベース SQLite (`dev.db`)
- エントリポイント: `src/server.ts`
- DB クライアント: `src/infrastructure/db/client.ts`

**用途**:
- 日常的な開発作業
- 機能開発・デバッグ
- 高速な開発サイクル
- Drizzle Studio によるデータベースの視覚的な確認

**起動コマンド**:
```bash
npm run dev
```

**特徴**:
- ホットリロード対応（`tsx watch`）
- ローカルファイルシステム上の SQLite データベース
- 完全なサンプルデータ（ユーザー、会話、メッセージなど）

---

### 2. Test 環境（テスト実行）

**概要**: Vitest によるユニット・統合テスト環境

**技術スタック**:
- テストフレームワーク: Vitest
- データベース: `better-sqlite3` + インメモリ SQLite (`:memory:`)
- DB クライアント: `src/infrastructure/db/client.ts`

**用途**:
- ユニットテスト
- 統合テスト
- API エンドポイントのテスト
- リグレッションテスト

**実行コマンド**:
```bash
npm run test           # テスト実行
npm run test:ui        # UI モードでテスト実行
npm run test:coverage  # カバレッジ付きテスト
```

**特徴**:
- テストごとに独立したインメモリデータベース
- `beforeEach` でデータベースをクリーンアップ
- テストケースごとに必要なデータを作成
- 事前シードデータは使用しない（テストの独立性を保つため）

---

### 3. D1 Local 環境（Wrangler ローカルシミュレーション）

**概要**: Cloudflare Workers 環境をローカルでシミュレート

**技術スタック**:
- ランタイム: Wrangler CLI（Cloudflare Workers シミュレータ）
- データベース: Cloudflare D1（ローカルコピー）
- データ保存場所: `.wrangler/state/v3/d1/`
- エントリポイント: `src/index.ts`
- DB クライアント: `src/infrastructure/db/client.d1.ts`

**用途**:
- Cloudflare Workers 特有の機能のテスト
- 本番環境に近い動作確認
- D1 固有の SQL 動作確認
- デプロイ前の最終検証

**起動コマンド**:
```bash
npm run wrangler:dev
```

**特徴**:
- 本番環境（Cloudflare Workers）と同じランタイム
- D1 のローカルシミュレーション
- オフライン開発可能
- コスト削減（リモート API コールなし）

---

### 4. D1 Remote 環境（本番・ステージング）

**概要**: Cloudflare Workers 上で実行される本番環境

**技術スタック**:
- ランタイム: Cloudflare Workers（実際のクラウド環境）
- データベース: Cloudflare D1（クラウド上のマネージド SQLite）
- エントリポイント: `src/index.ts`
- DB クライアント: `src/infrastructure/db/client.d1.ts`

**用途**:
- 本番環境での実行
- ステージング環境での検証
- エッジロケーションでの高速配信

**デプロイコマンド**:
```bash
npm run wrangler:deploy
```

**特徴**:
- グローバルなエッジネットワーク上で実行
- D1 の無料枠: 5M reads/day, 100K writes/day
- 低レイテンシ
- 自動スケーリング

---

## 環境比較表

| 項目 | Local | Test | D1 Local | D1 Remote |
|------|-------|------|----------|-----------|
| **ランタイム** | Node.js | Node.js | Wrangler | Cloudflare Workers |
| **データベース** | better-sqlite3<br>`dev.db` | better-sqlite3<br>`:memory:` | D1<br>(local) | D1<br>(remote) |
| **エントリポイント** | `src/server.ts` | テストファイル | `src/index.ts` | `src/index.ts` |
| **DB クライアント** | `client.ts` | `client.ts` | `client.d1.ts` | `client.d1.ts` |
| **起動コマンド** | `npm run dev` | `npm test` | `npm run wrangler:dev` | `npm run wrangler:deploy` |
| **ホットリロード** | ✅ | - | ✅ | ❌ |
| **オフライン開発** | ✅ | ✅ | ✅ | ❌ |
| **本番環境との互換性** | 部分的 | 部分的 | 完全 | 完全 |

---

## データベース構築方法

### スキーマ定義

すべての環境で共通のスキーマ定義を使用します：

**スキーマファイル**: `src/infrastructure/db/schema.ts`

主要なテーブル：
- `users`: ユーザー情報
- `conversations`: 会話（ダイレクト/グループ）
- `participants`: 会話の参加者
- `messages`: メッセージ
- `reactions`: メッセージへのリアクション
- `conversation_reads`: 既読管理
- `message_bookmarks`: メッセージのブックマーク

### マイグレーション

#### 1. Local 環境

**スキーマ生成**:
```bash
npm run db:generate
```
→ `drizzle/` ディレクトリにマイグレーションファイルを生成

**スキーマ適用**:
```bash
npm run db:push
```
→ `dev.db` にスキーマを適用

**データベースリセット**:
```bash
rm dev.db
npm run dev
```

#### 2. Test 環境

テスト実行時に自動的にスキーマが適用されます（インメモリデータベース）。

#### 3. D1 Local 環境

**マイグレーション適用**:
```bash
npm run d1:migrate:local
```

**データベースリセット**:
```bash
npm run d1:reset:local
```
→ クリーンアップ → マイグレーション → シード を順次実行

#### 4. D1 Remote 環境

**マイグレーション適用**:
```bash
npm run d1:migrate:remote
```

**データベースリセット**:
```bash
npm run d1:reset:remote
```

---

## シードデータ投入方法

### シードファイルの種類

#### 1. `drizzle/seeds/001_users.sql`（D1 環境用）

**対象環境**: D1 Local / D1 Remote

**内容**:
- 10人のユーザーデータのみ

**ユーザーリスト**:
| ID | 名前 | アバター |
|----|------|---------|
| `user-alice` | Alice | Bulbasaur (#1) |
| `user-bob` | Bob | Charmander (#4) |
| `user-carol` | Carol | Squirtle (#7) |
| `user-dave` | Dave | Pikachu (#25) |
| `user-eve` | Eve | Jigglypuff (#39) |
| `user-frank` | Frank | Meowth (#52) |
| `user-grace` | Grace | Eevee (#133) |
| `user-heidi` | Heidi | Snorlax (#143) |
| `user-ivan` | Ivan | Mewtwo (#150) |
| `user-judy` | Judy | Mew (#151) |

**設計思想**: D1 環境では必要最小限のデータのみを投入し、会話やメッセージなどは API 経由で作成する。

#### 2. `drizzle/seeds/001_initial_data.sql`（Local 環境用）

**対象環境**: Local 開発環境のみ

**内容**:
- 10人のユーザー（`001_users.sql` と同じ）
- 2つの会話（ダイレクト会話1つ、グループ会話1つ）
- 5人の参加者
- 4件のメッセージ
- 3件のリアクション
- 2件の既読管理
- 1件のブックマーク

**設計思想**: ローカル開発では豊富なサンプルデータを投入し、すぐに各機能をテストできるようにする。

### シード投入コマンド

#### Local 環境

**自動実行**（サーバー起動時）:
```bash
npm run dev
```
→ `NODE_ENV=development` かつデータが存在しない場合、自動的に `001_initial_data.sql` を実行

**手動実行**:
```bash
npm run db:seed
```

**実装**: `src/infrastructure/db/seeds/runner.ts` が SQL ファイルを読み込んで実行

#### Test 環境

シードは使用しません。各テストケース内で必要なデータを作成します。

**例**:
```typescript
beforeEach(async () => {
  // データベースをクリーンアップ
  await db.delete(users)
})

it('creates a user', async () => {
  // テスト用データを作成
  await app.request('/users', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test User' })
  })
})
```

#### D1 Local 環境

```bash
npm run d1:seed:local
```
→ Wrangler CLI が `001_users.sql` を実行

#### D1 Remote 環境

```bash
npm run d1:seed:remote
```
→ Wrangler CLI が `001_users.sql` を実行

### シード投入フロー

#### Local 環境のフロー

```
npm run dev
  ↓
server.ts 起動
  ↓
runSeeds() 実行
  ↓
NODE_ENV === 'development' をチェック
  ↓
ユーザー数をカウント（既存データチェック）
  ↓
データが存在しない場合のみ実行
  ↓
001_initial_data.sql を読み込み
  ↓
SQL 文を分割して順次実行
  ↓
実行結果をログ出力
```

#### D1 環境のフロー

```
npm run d1:seed:local (または :remote)
  ↓
Wrangler CLI が 001_users.sql を読み込み
  ↓
D1 データベースに対して SQL を実行
  ↓
完了
```

---

## 環境別データ内容まとめ

| 環境 | Seed ファイル | ユーザー | 会話 | メッセージ | その他 |
|------|--------------|---------|------|-----------|--------|
| **Local** | `001_initial_data.sql` | 10人 | 2件 | 4件 | リアクション、既読、ブックマーク |
| **Test** | なし | テストごとに作成 | - | - | - |
| **D1 Local** | `001_users.sql` | 10人 | 0件 | 0件 | なし |
| **D1 Remote** | `001_users.sql` | 10人 | 0件 | 0件 | なし |

### ユーザーデータの一貫性

すべての環境で同じ10人のユーザーを使用することで、以下のメリットがあります：

1. **環境間のデータ互換性**: ユーザー ID が統一されているため、環境を跨いだテストが可能
2. **予測可能な動作**: 常に同じユーザーが存在するため、API のテストが容易
3. **一貫したテスト**: ユーザー関連のテストで同じデータセットを使用できる

---

## 実用的なワークフロー

### 新機能開発の典型的なフロー

1. **Local 環境で開発**
   ```bash
   npm run dev
   ```
   - サンプルデータで機能を実装
   - Drizzle Studio でデータ確認

2. **テストを書く**
   ```bash
   npm run test
   ```
   - テストケースごとにデータを作成
   - テストの独立性を保つ

3. **D1 Local でテスト**
   ```bash
   npm run wrangler:dev
   ```
   - Cloudflare Workers 環境での動作確認
   - D1 固有の動作をテスト

4. **本番デプロイ**
   ```bash
   npm run wrangler:deploy
   ```

### データベースのリセット方法

#### Local 環境
```bash
rm dev.db
npm run dev
# または
rm dev.db
npm run db:seed
```

#### D1 Local 環境
```bash
npm run d1:reset:local
```

#### D1 Remote 環境
```bash
npm run d1:reset:remote
```

---

## トラブルシューティング

### Local 環境でシードが実行されない

**原因**: データが既に存在している

**解決策**:
```bash
rm dev.db
npm run dev
```

### D1 環境でマイグレーションエラー

**原因**: スキーマの不整合

**解決策**:
```bash
npm run d1:clean:local  # または :remote
npm run d1:migrate:local
npm run d1:seed:local
```

### テスト環境でデータが残る

**原因**: テストの `afterEach` / `beforeEach` が適切に設定されていない

**解決策**:
```typescript
beforeEach(async () => {
  // 外部キー制約の順序に注意してクリーンアップ
  await db.delete(messageBookmarks)
  await db.delete(reactions)
  await db.delete(conversationReads)
  await db.delete(messages)
  await db.delete(participants)
  await db.delete(conversations)
  await db.delete(users)
})
```

---

## 参考リソース

- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 ドキュメント](https://developers.cloudflare.com/d1/)
- [Drizzle ORM ドキュメント](https://orm.drizzle.team/)
- [Hono ドキュメント](https://hono.dev/)
- [Vitest ドキュメント](https://vitest.dev/)

---

## まとめ

このプロジェクトは、以下の4つの環境パターンで動作します：

1. **Local**: 高速な開発サイクル、完全なサンプルデータ
2. **Test**: 独立したテスト、インメモリデータベース
3. **D1 Local**: 本番環境のシミュレーション、最小限のデータ
4. **D1 Remote**: 本番環境、グローバル配信

各環境で適切なデータベース構築方法とシード投入方法を使い分けることで、効率的な開発とテストが可能になります。
