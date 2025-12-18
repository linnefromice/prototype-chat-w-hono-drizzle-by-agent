import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { ZodError } from 'zod'
import app from '../index'
import { expectValidZodSchema, expectValidZodSchemaArray } from '../__tests__/helpers/zodValidation'
import { expectMatchesSnapshot, expectNestedSnapshot } from '../__tests__/helpers/snapshotHelpers'
import {
  getConversationsIdResponse,
  getConversationsResponseItem,
  getConversationsIdMessagesResponseItem,
  deleteConversationsIdParticipantsUserIdResponse,
  postConversationsIdReadResponse,
  getConversationsIdUnreadCountResponse,
  getUsersUserIdResponse,
} from 'openapi'
import { db, closeDbConnection, sqlite } from '../infrastructure/db/client'
import { users, conversations as conversationsTable, participants, messages, reactions, conversationReads, messageBookmarks, authUser, authSession } from '../infrastructure/db/schema'
import { setupTestDatabase } from '../__tests__/helpers/dbSetup'
import { createAuthenticatedUser, createAuthHeaders } from '../__tests__/helpers/authHelper'

describe('Conversations API', () => {
  beforeAll(async () => {
    await setupTestDatabase()
    // Use fake timers for deterministic timestamps
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'))
  })

  beforeEach(async () => {
    // Clean up database between tests (foreign key order matters)
    await db.delete(messageBookmarks)
    await db.delete(reactions)
    await db.delete(conversationReads)
    await db.delete(messages)
    await db.delete(participants)
    await db.delete(conversationsTable)
    await db.delete(authSession)
    await db.delete(users)
    await db.delete(authUser)
  })

  afterAll(async () => {
    vi.useRealTimers()
    await closeDbConnection()
  })

  // Helper function to create test users (dev-only endpoint, no auth required)
  async function createUser(name: string, idAlias: string, avatarUrl?: string) {
    const response = await app.request('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, idAlias, avatarUrl }),
    })
    return response.json()
  }

  // Helper function to create authenticated user with chat user
  async function createAuthUserWithChatUser(username: string, email: string) {
    const { user, sessionToken } = await createAuthenticatedUser(username, email)

    // Create a chat user linked to the auth user via authUserId
    const [chatUser] = await db.insert(users).values({
      authUserId: user.id, // Link to auth user
      name: username,
      idAlias: username,
      createdAt: new Date().toISOString(),
    }).returning()

    return { authUser: user, chatUser, sessionToken, headers: createAuthHeaders(sessionToken) }
  }

  describe('POST /conversations', () => {
    it('creates a direct conversation with 2 participants', async () => {
      // Create test users
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const user2 = await createUser('User 2', 'user2')

      const response = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      expect(response.status).toBe(201)

      const conversation = await response.json()

      // Zod schema validation ensures complete response structure
      expectValidZodSchema(getConversationsIdResponse, conversation, 'conversation')

      // Snapshot testing - captures complete nested structure
      expectNestedSnapshot(conversation, 'POST /conversations - direct conversation')

      // Additional business logic assertions
      expect(conversation.type).toBe('direct')
      expect(conversation.name == null).toBe(true)
      expect(conversation.participants).toHaveLength(2)
      expect(conversation.participants[0].role).toBe('member')
    })

    it('creates a group conversation with name and 3+ participants', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const user2 = await createUser('User 2', 'user2')
      const user3 = await createUser('User 3', 'user3')

      const response = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'group',
          name: 'Test Group',
          participantIds: [user1.id, user2.id, user3.id],
        }),
      })

      expect(response.status).toBe(201)

      const conversation = await response.json()

      // Zod schema validation
      expectValidZodSchema(getConversationsIdResponse, conversation, 'conversation')

      // Snapshot testing - captures complete nested structure
      expectNestedSnapshot(conversation, 'POST /conversations - group conversation')

      // Business logic assertions
      expect(conversation.type).toBe('group')
      expect(conversation.name).toBe('Test Group')
      expect(conversation.participants).toHaveLength(3)
    })

    it('creates a group conversation with a name', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const user2 = await createUser('User 2', 'user2')
      const user3 = await createUser('User 3', 'user3')

      const response = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'group',
          name: 'My Group Chat',
          participantIds: [user1.id, user2.id, user3.id],
        }),
      })

      expect(response.status).toBe(201)

      const conversation = await response.json()

      // Zod schema validation
      expectValidZodSchema(getConversationsIdResponse, conversation, 'conversation')

      // Business logic assertions
      expect(conversation.type).toBe('group')
      expect(conversation.name).toBe('My Group Chat')
      expect(conversation.participants).toHaveLength(3)
    })

    it('returns 400 when participantIds is empty', async () => {
      const { headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')

      const response = await app.request('/conversations', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [],
        }),
      })

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json).toHaveProperty('message')
    })
  })

  describe('GET /conversations', () => {
    it('returns list of conversations for a user', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const user2 = await createUser('User 2', 'user2')

      // Create a conversation first
      await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const response = await app.request('/conversations', {
        headers: user1Headers
      })

      expect(response.status).toBe(200)

      const conversations = await response.json()
      expect(Array.isArray(conversations)).toBe(true)
      expect(conversations.length).toBeGreaterThan(0)

      // Zod schema validation for all conversations in the array
      expectValidZodSchemaArray(getConversationsResponseItem, conversations, 'conversations')
    })

    it('returns 401 when not authenticated', async () => {
      const response = await app.request('/conversations')

      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json).toHaveProperty('error')
    })

    it('returns empty array when user has no conversations', async () => {
      const { headers } = await createAuthUserWithChatUser('lonely', 'lonely@test.com')

      const response = await app.request('/conversations', {
        headers
      })

      expect(response.status).toBe(200)

      const conversations = await response.json()
      expect(Array.isArray(conversations)).toBe(true)
      expect(conversations.length).toBe(0)
    })
  })

  describe('GET /conversations/:id', () => {
    it('returns conversation detail with participants', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const user2 = await createUser('User 2', 'user2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const createdConversation = await createResponse.json()

      // Get conversation detail
      const response = await app.request(`/conversations/${createdConversation.id}`, {
        headers: user1Headers
      })

      expect(response.status).toBe(200)

      const conversation = await response.json()

      // Zod schema validation
      expectValidZodSchema(getConversationsIdResponse, conversation, 'conversation')

      // Business logic assertions
      expect(conversation.id).toBe(createdConversation.id)
      expect(conversation.type).toBe('direct')
      expect(conversation.participants).toHaveLength(2)
    })

    it('returns 404 for non-existent conversation', async () => {
      const { headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')

      const response = await app.request('/conversations/00000000-0000-0000-0000-000000000000', {
        headers
      })

      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toMatchObject({
        message: 'Conversation not found',
      })
    })
  })

  describe('POST /conversations/:id/participants', () => {
    it('adds a new participant to a conversation', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const user2 = await createUser('User 2', 'user2')
      const user3 = await createUser('User 3', 'user3')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'group',
          name: 'Test Group',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Add participant
      const response = await app.request(`/conversations/${conversation.id}/participants`, {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user3.id,
          role: 'member',
        }),
      })

      expect(response.status).toBe(201)

      const participant = await response.json()

      // Zod schema validation
      expectValidZodSchema(deleteConversationsIdParticipantsUserIdResponse, participant, 'participant')

      // Business logic assertions
      expect(participant.conversationId).toBe(conversation.id)
      expect(participant.userId).toBe(user3.id)
      expect(participant.role).toBe('member')
    })

    it('creates a system message when participant is added', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const user2 = await createUser('User 2', 'user2')
      const user3 = await createUser('User 3', 'user3')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'group',
          name: 'Test Group',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Add participant
      await app.request(`/conversations/${conversation.id}/participants`, {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user3.id,
          role: 'member',
        }),
      })

      // Get messages
      const messagesResponse = await app.request(
        `/conversations/${conversation.id}/messages`,
        { headers: user1Headers }
      )

      const messages = await messagesResponse.json()

      // Verify system message exists
      const systemMessage = messages.find(
        (m: any) => m.type === 'system' && m.systemEvent === 'join'
      )
      expect(systemMessage).toBeDefined()
      expect(systemMessage.text).toContain(user3.id)
    })

    it('returns 404 for non-existent conversation', async () => {
      const { chatUser: user, headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')

      const response = await app.request(
        '/conversations/00000000-0000-0000-0000-000000000000/participants',
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            role: 'member',
          }),
        }
      )

      expect(response.status).toBe(404)
    })
  })

  describe('DELETE /conversations/:id/participants/:userId', () => {
    it('removes a participant from conversation', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const user2 = await createUser('User 2', 'user2')
      const user3 = await createUser('User 3', 'user3')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'group',
          name: 'Test Group',
          participantIds: [user1.id, user2.id, user3.id],
        }),
      })

      const conversation = await createResponse.json()

      // Remove participant
      const response = await app.request(
        `/conversations/${conversation.id}/participants/${user3.id}`,
        {
          method: 'DELETE',
          headers: user1Headers
        }
      )

      expect(response.status).toBe(200)

      const participant = await response.json()
      expect(participant.userId).toBe(user3.id)
      expect(participant.conversationId).toBe(conversation.id)
      expect(participant).toHaveProperty('leftAt')
      expect(participant.leftAt).not.toBeNull()
    })

    it('returns 404 for non-existent participant', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const user2 = await createUser('User 2', 'user2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Try to remove non-existent participant
      const response = await app.request(
        `/conversations/${conversation.id}/participants/00000000-0000-0000-0000-000000000000`,
        {
          method: 'DELETE',
          headers: user1Headers
        }
      )

      expect(response.status).toBe(404)
    })
  })

  describe('GET /conversations/:id/messages', () => {
    it('returns list of messages in a conversation', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const { chatUser: user2, headers: user2Headers } = await createAuthUserWithChatUser('user2', 'user2@test.com')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Send messages
      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Hello',
        }),
      })

      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { ...user2Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Hi there',
        }),
      })

      // Get messages
      const response = await app.request(
        `/conversations/${conversation.id}/messages`,
        { headers: user1Headers }
      )

      expect(response.status).toBe(200)

      const messages = await response.json()
      expect(Array.isArray(messages)).toBe(true)
      expect(messages.length).toBeGreaterThanOrEqual(2)

      // Zod schema validation for all messages in the array
      expectValidZodSchemaArray(getConversationsIdMessagesResponseItem, messages, 'messages')

      // Verify reactions field exists and is an array
      messages.forEach((message: any) => {
        expect(message).toHaveProperty('reactions')
        expect(Array.isArray(message.reactions)).toBe(true)
      })
    })

    it('respects limit parameter for pagination', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const user2 = await createUser('User 2', 'user2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Send multiple messages
      for (let i = 0; i < 5; i++) {
        await app.request(`/conversations/${conversation.id}/messages`, {
          method: 'POST',
          headers: { ...user1Headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `Message ${i + 1}`,
          }),
        })
      }

      // Get messages with limit
      const response = await app.request(
        `/conversations/${conversation.id}/messages?limit=2`,
        { headers: user1Headers }
      )

      expect(response.status).toBe(200)

      const messages = await response.json()
      expect(messages.length).toBeLessThanOrEqual(2)
    })

    it('supports pagination with before parameter', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const { chatUser: user2, headers: user2Headers } = await createAuthUserWithChatUser('user2', 'user2@test.com')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Send messages
      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'First message',
        }),
      })

      // Get first set of messages
      const firstResponse = await app.request(
        `/conversations/${conversation.id}/messages`,
        { headers: user1Headers }
      )

      const firstMessages = await firstResponse.json()
      const firstMessageTime = firstMessages[0]?.createdAt

      // Send another message
      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { ...user2Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Second message',
        }),
      })

      // Get messages before first message time
      const response = await app.request(
        `/conversations/${conversation.id}/messages?before=${firstMessageTime}`,
        { headers: user1Headers }
      )

      expect(response.status).toBe(200)
      const messages = await response.json()
      expect(Array.isArray(messages)).toBe(true)
    })

    it('includes reactions in message list', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const { chatUser: user2, headers: user2Headers } = await createAuthUserWithChatUser('user2', 'user2@test.com')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Send a message
      const messageResponse = await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user1.id,
          text: 'Hello with reactions',
        }),
      })

      const message = await messageResponse.json()

      // Add reactions to the message (user2 adds reaction)
      await app.request(`/messages/${message.id}/reactions`, {
        method: 'POST',
        headers: { ...user2Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji: '👍',
        }),
      })

      // Add reactions to the message (user1 adds reaction)
      await app.request(`/messages/${message.id}/reactions`, {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji: '❤️',
        }),
      })

      // Get messages
      const response = await app.request(
        `/conversations/${conversation.id}/messages?userId=${user1.id}`,
        { headers: user1Headers }
      )

      expect(response.status).toBe(200)

      const messages = await response.json()
      const messageWithReactions = messages.find((m: any) => m.id === message.id)

      expect(messageWithReactions).toBeDefined()
      expect(messageWithReactions.reactions).toHaveLength(2)
      expect(messageWithReactions.reactions.some((r: any) => r.emoji === '👍' && r.userId === user2.id)).toBe(true)
      expect(messageWithReactions.reactions.some((r: any) => r.emoji === '❤️' && r.userId === user1.id)).toBe(true)
    })

    it('returns 403 when user is not a participant', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const user2 = await createUser('User 2', 'user2')
      const { chatUser: user3, headers: user3Headers } = await createAuthUserWithChatUser('user3', 'user3@test.com')

      // Create a conversation between user1 and user2
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Try to get messages as user3
      const response = await app.request(
        `/conversations/${conversation.id}/messages?userId=${user3.id}`,
        { headers: user3Headers }
      )

      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toMatchObject({
        message: 'User is not an active participant in this conversation',
      })
    })
  })

  describe('POST /conversations/:id/messages', () => {
    it('sends a text message to a conversation', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const user2 = await createUser('User 2', 'user2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Send message
      const response = await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user1.id,
          text: 'Hello, world!',
        }),
      })

      expect(response.status).toBe(201)

      const message = await response.json()

      // Zod schema validation
      expectValidZodSchema(getConversationsIdMessagesResponseItem, message, 'message')

      // Snapshot testing - captures complete message structure
      expectMatchesSnapshot(message, 'POST /conversations/:id/messages - text message')

      // Business logic assertions
      expect(message.conversationId).toBe(conversation.id)
      expect(message.senderUserId).toBe(user1.id)
      expect(message.type).toBe('text')
      expect(message.text).toBe('Hello, world!')
    })

    it('sends a reply message with replyToMessageId', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const { chatUser: user2, headers: user2Headers } = await createAuthUserWithChatUser('user2', 'user2@test.com')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Send first message
      const firstMessageResponse = await app.request(
        `/conversations/${conversation.id}/messages`,
        {
          method: 'POST',
          headers: { ...user1Headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderUserId: user1.id,
            text: 'Original message',
          }),
        }
      )

      const firstMessage = await firstMessageResponse.json()

      // Send reply
      const response = await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { ...user2Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user2.id,
          text: 'Reply to original',
          replyToMessageId: firstMessage.id,
        }),
      })

      expect(response.status).toBe(201)

      const replyMessage = await response.json()
      expect(replyMessage.replyToMessageId).toBe(firstMessage.id)
      expect(replyMessage.text).toBe('Reply to original')
    })

    it('returns 403 when user is not a participant', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const user2 = await createUser('User 2', 'user2')
      const { chatUser: user3, headers: user3Headers } = await createAuthUserWithChatUser('user3', 'user3@test.com')

      // Create a conversation between user1 and user2
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Try to send message as user3
      const response = await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { ...user3Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user3.id,
          text: 'Should not work',
        }),
      })

      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toMatchObject({
        message: 'User is not an active participant in this conversation',
      })
    })
  })

  describe('POST /conversations/:id/read', () => {
    it('updates the last read message position', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const { chatUser: user2, headers: user2Headers } = await createAuthUserWithChatUser('user2', 'user2@test.com')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Send a message
      const messageResponse = await app.request(
        `/conversations/${conversation.id}/messages`,
        {
          method: 'POST',
          headers: { ...user2Headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderUserId: user2.id,
            text: 'Test message',
          }),
        }
      )

      const message = await messageResponse.json()

      // Update read position
      const response = await app.request(`/conversations/${conversation.id}/read`, {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user1.id,
          lastReadMessageId: message.id,
        }),
      })

      expect(response.status).toBe(200)

      const result = await response.json()

      // Zod schema validation
      expectValidZodSchema(postConversationsIdReadResponse, result, 'read response')

      // Business logic assertions
      expect(result.status).toBe('ok')
      expect(result.read.conversationId).toBe(conversation.id)
      expect(result.read.userId).toBe(user1.id)
      expect(result.read.lastReadMessageId).toBe(message.id)
    })

    it('returns 400 for non-existent message', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const user2 = await createUser('User 2', 'user2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Try to update read position with non-existent message
      const response = await app.request(`/conversations/${conversation.id}/read`, {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user1.id,
          lastReadMessageId: '00000000-0000-0000-0000-000000000000',
        }),
      })

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({
        message: 'lastReadMessageId must belong to the conversation',
      })
    })
  })

  describe('GET /conversations/:id/unread-count', () => {
    it('returns the unread message count', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const { chatUser: user2, headers: user2Headers } = await createAuthUserWithChatUser('user2', 'user2@test.com')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Send messages
      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { ...user2Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user2.id,
          text: 'Message 1',
        }),
      })

      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { ...user2Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user2.id,
          text: 'Message 2',
        }),
      })

      // Get unread count
      const response = await app.request(
        `/conversations/${conversation.id}/unread-count?userId=${user1.id}`,
        { headers: user1Headers }
      )

      expect(response.status).toBe(200)

      const result = await response.json()

      // Zod schema validation
      expectValidZodSchema(getConversationsIdUnreadCountResponse, result, 'unread count response')

      // Business logic assertions
      expect(result.unreadCount).toBeGreaterThanOrEqual(0)
    })

    it('returns total message count when no read position is set', async () => {
      const { chatUser: user1, headers: user1Headers } = await createAuthUserWithChatUser('user1', 'user1@test.com')
      const { chatUser: user2, headers: user2Headers } = await createAuthUserWithChatUser('user2', 'user2@test.com')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { ...user1Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Send messages
      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { ...user2Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user2.id,
          text: 'Message 1',
        }),
      })

      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { ...user2Headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user2.id,
          text: 'Message 2',
        }),
      })

      // Get unread count without setting read position
      const response = await app.request(
        `/conversations/${conversation.id}/unread-count?userId=${user1.id}`,
        { headers: user1Headers }
      )

      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result.unreadCount).toBeGreaterThanOrEqual(2)
    })
  })
})
