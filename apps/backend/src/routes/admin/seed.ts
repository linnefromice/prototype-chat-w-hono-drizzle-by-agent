import type { Context } from 'hono'
import { createAuth } from '../../infrastructure/auth/config'
import { eq, isNull } from 'drizzle-orm'
import { chatUsers } from '../../infrastructure/db/schema'
import { getDbClient } from '../../utils/dbClient'
import type { Env } from '../../infrastructure/db/client.d1'
import type { AuthVariables } from '../../infrastructure/auth'

const DEFAULT_PASSWORD = 'Password'

type SeedResult = {
  chatUserId: string
  username: string
  status: 'created' | 'skipped' | 'failed' | 'sync_error'
  authUserId?: string
  reason?: string
  error?: string
}

type SeedSummary = {
  total: number
  created: number
  skipped: number
  failed: number
  syncErrors: number
}

export async function seedAuthUsersByAppUsers(c: Context<{ Bindings: Env; Variables: AuthVariables }>) {
  // 環境チェック
  const environment = c.env?.ENVIRONMENT || 'development'
  if (environment === 'production') {
    return c.json({
      success: false,
      error: 'Forbidden - only available in non-production environments',
      environment
    }, 403)
  }

  try {
    // Step 1: auth_user_id が NULL の users を取得
    const db = await getDbClient(c)

    // バッチサイズ制限（Cloudflare Workersのタイムアウト対策）
    const batchSizeParam = c.req.query('batchSize')
    const batchSize = batchSizeParam ? parseInt(batchSizeParam, 10) : 5
    const limitedBatchSize = Math.min(Math.max(batchSize, 1), 10) // 1-10の範囲に制限

    const usersWithoutAuth = await db
      .select()
      .from(chatUsers)
      .where(isNull(chatUsers.authUserId))
      .limit(limitedBatchSize) // バッチサイズで制限
      .all()

    if (usersWithoutAuth.length === 0) {
      return c.json({
        success: true,
        summary: { total: 0, created: 0, skipped: 0, failed: 0, syncErrors: 0 },
        results: [],
        message: 'No users without auth_user_id found'
      })
    }

    // Step 2: Better Auth で auth_user を作成
    // Note: getDbClient returns either D1 or BetterSQLite3 database
    // BetterAuth works with both, so we cast to any to satisfy TypeScript
    const secret = c.env?.BETTER_AUTH_SECRET
    const auth = createAuth(db as any, secret)
    const results: SeedResult[] = []
    let createdCount = 0
    let skippedCount = 0
    let failedCount = 0
    let syncErrorCount = 0

    for (const user of usersWithoutAuth) {
      try {
        // Better Auth で auth_user 作成
        const result = await auth.api.signUpEmail({
          body: {
            username: user.idAlias,
            email: `${user.idAlias}@example.com`,
            password: DEFAULT_PASSWORD,
            name: user.name
          }
        })

        if (!result || !result.user) {
          results.push({
            chatUserId: user.id,
            username: user.idAlias,
            status: 'failed',
            error: 'Failed to create auth user'
          })
          failedCount++
          continue
        }

        // Step 3: users.auth_user_id を更新
        try {
          await db
            .update(chatUsers)
            .set({ authUserId: result.user.id })
            .where(eq(chatUsers.id, user.id))

          results.push({
            chatUserId: user.id,
            username: user.idAlias,
            status: 'created',
            authUserId: result.user.id
          })
          createdCount++
        } catch (updateError: any) {
          // auth_user は作成されたが users 更新に失敗
          results.push({
            chatUserId: user.id,
            username: user.idAlias,
            status: 'sync_error',
            authUserId: result.user.id,
            error: 'auth_user created but failed to update users.auth_user_id'
          })
          syncErrorCount++
          console.error(`Sync error for user ${user.idAlias}:`, updateError)
        }

      } catch (error: any) {
        // 既存ユーザーエラーはスキップ扱い
        if (error.message?.includes('already exists')) {
          results.push({
            chatUserId: user.id,
            username: user.idAlias,
            status: 'skipped',
            reason: error.message
          })
          skippedCount++
        } else {
          results.push({
            chatUserId: user.id,
            username: user.idAlias,
            status: 'failed',
            error: error.message || 'Unknown error'
          })
          failedCount++
        }
      }
    }

    // 残りのユーザー数を確認
    const remainingUsers = await db
      .select()
      .from(chatUsers)
      .where(isNull(chatUsers.authUserId))
      .all()

    return c.json({
      success: true,
      summary: {
        total: usersWithoutAuth.length,
        created: createdCount,
        skipped: skippedCount,
        failed: failedCount,
        syncErrors: syncErrorCount
      },
      remaining: remainingUsers.length,
      message: remainingUsers.length > 0
        ? `${remainingUsers.length} users still need auth setup. Run again to continue.`
        : 'All users have auth setup complete!',
      results
    })

  } catch (error: any) {
    console.error('Seed operation failed:', error)
    return c.json({
      success: false,
      error: 'Failed to process seed operation',
      details: error.message
    }, 500)
  }
}
