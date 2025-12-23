import { Hono } from 'hono'
import { DrizzleChatRepository } from '../repositories/drizzleChatRepository'
import { ChatUsecase } from '../usecases/chatUsecase'
import { getDbClient } from '../utils/dbClient'
import { getChatUserId } from '../utils/getChatUserId'
import { requireAuth } from '../middleware/requireAuth'
import type { Env } from '../infrastructure/db/client.d1'
import type { AuthVariables } from '../infrastructure/auth'

const router = new Hono<{
  Bindings: Env
  Variables: AuthVariables
}>()

// Note: Error handling is now managed by the global error handler in index.ts
// All errors are automatically caught and handled by app.onError(errorHandler)

router.get('/', requireAuth, async c => {
  const authUser = c.get('authUser')
  const db = await getDbClient(c)
  const userId = await getChatUserId(db, authUser!)
  const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
  const bookmarks = await chatUsecase.listBookmarks(userId)
  return c.json(bookmarks)
})

export default router
