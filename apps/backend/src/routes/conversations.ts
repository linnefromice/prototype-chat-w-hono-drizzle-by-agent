import { Hono } from 'hono'
import {
  AddParticipantRequestSchema,
  CreateConversationRequestSchema,
  SendMessageRequestSchema,
  UpdateConversationReadRequestSchema,
} from 'openapi'
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
  const conversations = await chatUsecase.listConversationsForUser(userId)
  return c.json(conversations)
})

router.post('/', requireAuth, async c => {
  const db = await getDbClient(c)
  const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
  const payload = CreateConversationRequestSchema.parse(await c.req.json())
  const created = await chatUsecase.createConversation(payload)
  return c.json(created, 201)
})

router.get('/:id', requireAuth, async c => {
  const id = c.req.param('id')
  const db = await getDbClient(c)
  const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
  const conversation = await chatUsecase.getConversation(id)
  return c.json(conversation)
})

router.post('/:id/participants', requireAuth, async c => {
  const conversationId = c.req.param('id')
  const db = await getDbClient(c)
  const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
  const payload = AddParticipantRequestSchema.parse(await c.req.json())
  const participant = await chatUsecase.addParticipant(conversationId, payload)
  await chatUsecase.createSystemMessage(conversationId, {
    senderUserId: null,
    systemEvent: 'join',
    text: `${payload.userId} joined`,
  })
  return c.json(participant, 201)
})

router.post('/:id/leave', requireAuth, async c => {
  const conversationId = c.req.param('id')
  const authUser = c.get('authUser')
  const db = await getDbClient(c)
  const userId = await getChatUserId(db, authUser!)
  const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
  const participant = await chatUsecase.markParticipantLeft(conversationId, userId)
  return c.json(participant)
})

router.get('/:id/messages', requireAuth, async c => {
  const conversationId = c.req.param('id')
  const authUser = c.get('authUser')
  const before = c.req.query('before')
  const limitParam = c.req.query('limit')
  const parsedLimit = limitParam ? Number(limitParam) : undefined
  const limit = parsedLimit && !Number.isNaN(parsedLimit) ? parsedLimit : undefined
  const db = await getDbClient(c)
  const userId = await getChatUserId(db, authUser!)
  const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
  const messages = await chatUsecase.listMessages(conversationId, userId, { before, limit })
  return c.json(messages)
})

router.post('/:id/messages', requireAuth, async c => {
  const conversationId = c.req.param('id')
  const authUser = c.get('authUser')
  const db = await getDbClient(c)
  const userId = await getChatUserId(db, authUser!)
  const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
  const body = await c.req.json()

  // Parse request body (userId is automatically added from session)
  const payload = SendMessageRequestSchema.parse(body)
  const created = await chatUsecase.sendMessage(conversationId, userId, payload)
  return c.json(created, 201)
})

router.post('/:id/read', requireAuth, async c => {
  const conversationId = c.req.param('id')
  const authUser = c.get('authUser')
  const db = await getDbClient(c)
  const userId = await getChatUserId(db, authUser!)
  const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
  const body = await c.req.json()

  // Parse request body (userId is automatically added from session)
  const payload = UpdateConversationReadRequestSchema.parse(body)
  const read = await chatUsecase.markConversationRead(conversationId, userId, payload.lastReadMessageId)
  return c.json({ status: 'ok', read })
})

router.get('/:id/unread-count', requireAuth, async c => {
  const conversationId = c.req.param('id')
  const authUser = c.get('authUser')
  const db = await getDbClient(c)
  const userId = await getChatUserId(db, authUser!)
  const chatUsecase = new ChatUsecase(new DrizzleChatRepository(db))
  const unreadCount = await chatUsecase.countUnread(conversationId, userId)
  return c.json({ unreadCount })
})

export default router
