import { Hono } from 'hono'
import {
  AddParticipantRequestSchema,
  CreateConversationRequestSchema,
  SendMessageRequestSchema,
} from 'openapi'
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

router.get('/', async c => {
  const userId = c.req.query('userId')
  try {
    const conversations = await chatUsecase.listConversationsForUser(userId ?? '')
    return c.json(conversations)
  } catch (error) {
    return handleError(error, c)
  }
})

router.post('/', async c => {
  const payload = CreateConversationRequestSchema.parse(await c.req.json())

  try {
    const created = await chatUsecase.createConversation(payload)
    return c.json(created, 201)
  } catch (error) {
    return handleError(error, c)
  }
})

router.get('/:id', async c => {
  const id = c.req.param('id')
  try {
    const conversation = await chatUsecase.getConversation(id)
    return c.json(conversation)
  } catch (error) {
    return handleError(error, c)
  }
})

router.post('/:id/participants', async c => {
  const conversationId = c.req.param('id')
  const payload = AddParticipantRequestSchema.parse(await c.req.json())

  try {
    const participant = await chatUsecase.addParticipant(conversationId, payload)
    await chatUsecase.createSystemMessage(conversationId, {
      senderUserId: null,
      systemEvent: 'join',
      text: `${payload.userId} joined`,
    })
    return c.json(participant, 201)
  } catch (error) {
    return handleError(error, c)
  }
})

router.delete('/:id/participants/:userId', async c => {
  const conversationId = c.req.param('id')
  const userId = c.req.param('userId')
  try {
    const participant = await chatUsecase.markParticipantLeft(conversationId, userId)
    return c.json(participant)
  } catch (error) {
    return handleError(error, c)
  }
})

router.get('/:id/messages', async c => {
  const conversationId = c.req.param('id')
  const userId = c.req.query('userId')
  const before = c.req.query('before')
  const limitParam = c.req.query('limit')
  const parsedLimit = limitParam ? Number(limitParam) : undefined
  const limit = parsedLimit && !Number.isNaN(parsedLimit) ? parsedLimit : undefined

  try {
    const messages = await chatUsecase.listMessages(conversationId, userId ?? '', { before, limit })
    return c.json(messages)
  } catch (error) {
    return handleError(error, c)
  }
})

router.post('/:id/messages', async c => {
  const conversationId = c.req.param('id')
  const payload = SendMessageRequestSchema.parse(await c.req.json())

  try {
    const created = await chatUsecase.sendMessage(conversationId, payload)
    return c.json(created, 201)
  } catch (error) {
    return handleError(error, c)
  }
})

export default router
