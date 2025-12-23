import { Hono } from 'hono'
import { BookmarkRequestSchema, ReactionRequestSchema } from 'openapi'
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

router.delete('/:id', requireAuth, async c => {
  const messageId = c.req.param('id')
  const authUser = c.get('authUser')
  const db = await getDbClient(c)
  const userId = await getChatUserId(db, authUser!)
  const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
  await chatUsecase.deleteMessage(messageId, userId)
  return c.body(null, 204)
})

router.get('/:id/reactions', requireAuth, async c => {
  const messageId = c.req.param('id')
  const db = await getDbClient(c)
  const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
  const reactions = await chatUsecase.listReactions(messageId)
  return c.json(reactions)
})

router.post('/:id/reactions', requireAuth, async c => {
  const messageId = c.req.param('id')
  const authUser = c.get('authUser')
  const body = await c.req.json()
  const db = await getDbClient(c)
  const userId = await getChatUserId(db, authUser!)

  // Parse request body (userId is automatically added from session)
  const payload = ReactionRequestSchema.parse(body)

  const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
  const reaction = await chatUsecase.addReaction(messageId, userId, payload.emoji)
  return c.json(reaction, 201)
})

router.delete('/:id/reactions/:emoji', requireAuth, async c => {
  const messageId = c.req.param('id')
  const emoji = c.req.param('emoji')
  const authUser = c.get('authUser')
  const db = await getDbClient(c)
  const userId = await getChatUserId(db, authUser!)
  const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
  const reaction = await chatUsecase.removeReaction(messageId, emoji, userId)
  return c.json(reaction)
})

router.post('/:id/bookmarks', requireAuth, async c => {
  const messageId = c.req.param('id')
  const authUser = c.get('authUser')
  const db = await getDbClient(c)
  const userId = await getChatUserId(db, authUser!)
  const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
  const bookmark = await chatUsecase.addBookmark(messageId, userId)
  return c.json({ status: 'bookmarked', bookmark }, 201)
})

router.delete('/:id/bookmarks', requireAuth, async c => {
  const messageId = c.req.param('id')
  const authUser = c.get('authUser')
  const db = await getDbClient(c)
  const userId = await getChatUserId(db, authUser!)
  const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
  await chatUsecase.removeBookmark(messageId, userId)
  return c.json({ status: 'unbookmarked' })
})

export default router
