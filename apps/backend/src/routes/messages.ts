import { Hono } from 'hono'
import { BookmarkRequestSchema, ReactionRequestSchema } from 'openapi'
import { DrizzleChatRepository } from '../repositories/drizzleChatRepository'
import { ChatUsecase } from '../usecases/chatUsecase'
import { HttpError } from '../utils/errors'

const router = new Hono()
const chatUsecase = new ChatUsecase(new DrizzleChatRepository())

const handleError = (error: unknown, c: any) => {
  if (error instanceof HttpError) {
    return c.json({ message: error.message }, error.status)
  }

  throw error
}

router.post('/:id/reactions', async c => {
  const messageId = c.req.param('id')
  const payload = ReactionRequestSchema.parse(await c.req.json())

  try {
    const reaction = await chatUsecase.addReaction(messageId, payload)
    return c.json(reaction, 201)
  } catch (error) {
    return handleError(error, c)
  }
})

router.delete('/:id/reactions/:emoji', async c => {
  const messageId = c.req.param('id')
  const emoji = c.req.param('emoji')
  const userId = c.req.query('userId')

  if (!userId) {
    return c.json({ message: 'userId is required' }, 400)
  }

  try {
    const reaction = await chatUsecase.removeReaction(messageId, emoji, userId)
    return c.json(reaction)
  } catch (error) {
    return handleError(error, c)
  }
})

router.post('/:id/bookmarks', async c => {
  const messageId = c.req.param('id')
  const payload = BookmarkRequestSchema.parse(await c.req.json())

  try {
    const bookmark = await chatUsecase.addBookmark(messageId, payload)
    return c.json({ status: 'bookmarked', bookmark }, 201)
  } catch (error) {
    return handleError(error, c)
  }
})

router.delete('/:id/bookmarks', async c => {
  const messageId = c.req.param('id')
  const userId = c.req.query('userId')

  if (!userId) {
    return c.json({ message: 'userId is required' }, 400)
  }

  try {
    await chatUsecase.removeBookmark(messageId, userId)
    return c.json({ status: 'unbookmarked' })
  } catch (error) {
    return handleError(error, c)
  }
})

export default router
