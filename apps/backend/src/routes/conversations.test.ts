import { describe, expect, it, beforeAll } from 'vitest'
import { ZodError } from 'zod'
import app from '../app'

describe('Conversations API', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'development'
  })

  // Helper function to create test users
  async function createUser(name: string, avatarUrl?: string) {
    const response = await app.request('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, avatarUrl }),
    })
    return response.json()
  }

  describe('POST /conversations', () => {
    it('creates a direct conversation with 2 participants', async () => {
      // Create test users
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')

      const response = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      expect(response.status).toBe(201)

      const conversation = await response.json()
      expect(conversation).toHaveProperty('id')
      expect(conversation.type).toBe('direct')
      // Name is undefined for direct conversations (not explicitly set)
      expect(conversation.name == null).toBe(true)
      expect(conversation).toHaveProperty('createdAt')
      expect(conversation.participants).toHaveLength(2)
      expect(conversation.participants[0]).toHaveProperty('id')
      expect(conversation.participants[0]).toHaveProperty('userId')
      expect(conversation.participants[0].role).toBe('member')
    })

    it('creates a group conversation with name and 3+ participants', async () => {
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')
      const user3 = await createUser('User 3')

      const response = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'group',
          name: 'Test Group',
          participantIds: [user1.id, user2.id, user3.id],
        }),
      })

      expect(response.status).toBe(201)

      const conversation = await response.json()
      expect(conversation.type).toBe('group')
      expect(conversation.name).toBe('Test Group')
      expect(conversation.participants).toHaveLength(3)
    })

    it('creates a group conversation with a name', async () => {
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')
      const user3 = await createUser('User 3')

      const response = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'group',
          name: 'My Group Chat',
          participantIds: [user1.id, user2.id, user3.id],
        }),
      })

      expect(response.status).toBe(201)

      const conversation = await response.json()
      expect(conversation.type).toBe('group')
      expect(conversation.name).toBe('My Group Chat')
      expect(conversation.participants).toHaveLength(3)
    })

    it('returns 400 when participantIds is empty', async () => {
      const response = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')

      // Create a conversation first
      await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const response = await app.request(`/conversations?userId=${user1.id}`)

      expect(response.status).toBe(200)

      const conversations = await response.json()
      expect(Array.isArray(conversations)).toBe(true)
      expect(conversations.length).toBeGreaterThan(0)

      const conversation = conversations[0]
      expect(conversation).toHaveProperty('id')
      expect(conversation).toHaveProperty('type')
      expect(conversation).toHaveProperty('createdAt')
      expect(conversation).toHaveProperty('participants')
      expect(Array.isArray(conversation.participants)).toBe(true)
    })

    it('returns 400 when userId is not provided', async () => {
      const response = await app.request('/conversations')

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json).toHaveProperty('message')
    })

    it('returns empty array when user has no conversations', async () => {
      const user = await createUser('Lonely User')

      const response = await app.request(`/conversations?userId=${user.id}`)

      expect(response.status).toBe(200)

      const conversations = await response.json()
      expect(Array.isArray(conversations)).toBe(true)
      expect(conversations.length).toBe(0)
    })
  })

  describe('GET /conversations/:id', () => {
    it('returns conversation detail with participants', async () => {
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const createdConversation = await createResponse.json()

      // Get conversation detail
      const response = await app.request(`/conversations/${createdConversation.id}`)

      expect(response.status).toBe(200)

      const conversation = await response.json()
      expect(conversation.id).toBe(createdConversation.id)
      expect(conversation.type).toBe('direct')
      expect(conversation).toHaveProperty('participants')
      expect(conversation.participants).toHaveLength(2)
    })

    it('returns 404 for non-existent conversation', async () => {
      const response = await app.request('/conversations/00000000-0000-0000-0000-000000000000')

      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toMatchObject({
        message: 'Conversation not found',
      })
    })
  })

  describe('POST /conversations/:id/participants', () => {
    it('adds a new participant to a conversation', async () => {
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')
      const user3 = await createUser('User 3')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user3.id,
          role: 'member',
        }),
      })

      expect(response.status).toBe(201)

      const participant = await response.json()
      expect(participant).toHaveProperty('id')
      expect(participant.conversationId).toBe(conversation.id)
      expect(participant.userId).toBe(user3.id)
      expect(participant.role).toBe('member')
      expect(participant).toHaveProperty('joinedAt')
    })

    it('creates a system message when participant is added', async () => {
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')
      const user3 = await createUser('User 3')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user3.id,
          role: 'member',
        }),
      })

      // Get messages
      const messagesResponse = await app.request(
        `/conversations/${conversation.id}/messages?userId=${user1.id}`
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
      const user = await createUser('User 1')

      const response = await app.request(
        '/conversations/00000000-0000-0000-0000-000000000000/participants',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')
      const user3 = await createUser('User 3')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        }
      )

      expect(response.status).toBe(404)
    })
  })

  describe('GET /conversations/:id/messages', () => {
    it('returns list of messages in a conversation', async () => {
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Send messages
      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user1.id,
          text: 'Hello',
        }),
      })

      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user2.id,
          text: 'Hi there',
        }),
      })

      // Get messages
      const response = await app.request(
        `/conversations/${conversation.id}/messages?userId=${user1.id}`
      )

      expect(response.status).toBe(200)

      const messages = await response.json()
      expect(Array.isArray(messages)).toBe(true)
      expect(messages.length).toBeGreaterThanOrEqual(2)

      const message = messages[0]
      expect(message).toHaveProperty('id')
      expect(message).toHaveProperty('conversationId')
      expect(message).toHaveProperty('senderUserId')
      expect(message).toHaveProperty('type')
      expect(message).toHaveProperty('text')
      expect(message).toHaveProperty('createdAt')
    })

    it('respects limit parameter for pagination', async () => {
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderUserId: user1.id,
            text: `Message ${i + 1}`,
          }),
        })
      }

      // Get messages with limit
      const response = await app.request(
        `/conversations/${conversation.id}/messages?userId=${user1.id}&limit=2`
      )

      expect(response.status).toBe(200)

      const messages = await response.json()
      expect(messages.length).toBeLessThanOrEqual(2)
    })

    it('supports pagination with before parameter', async () => {
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Send messages
      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user1.id,
          text: 'First message',
        }),
      })

      // Get first set of messages
      const firstResponse = await app.request(
        `/conversations/${conversation.id}/messages?userId=${user1.id}`
      )

      const firstMessages = await firstResponse.json()
      const firstMessageTime = firstMessages[0]?.createdAt

      // Send another message
      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user2.id,
          text: 'Second message',
        }),
      })

      // Get messages before first message time
      const response = await app.request(
        `/conversations/${conversation.id}/messages?userId=${user1.id}&before=${firstMessageTime}`
      )

      expect(response.status).toBe(200)
      const messages = await response.json()
      expect(Array.isArray(messages)).toBe(true)
    })

    it('returns 403 when user is not a participant', async () => {
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')
      const user3 = await createUser('User 3')

      // Create a conversation between user1 and user2
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Try to get messages as user3
      const response = await app.request(
        `/conversations/${conversation.id}/messages?userId=${user3.id}`
      )

      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toMatchObject({
        message: 'User is not an active participant in this conversation',
      })
    })
  })

  describe('POST /conversations/:id/messages', () => {
    it('sends a text message to a conversation', async () => {
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Send message
      const response = await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user1.id,
          text: 'Hello, world!',
        }),
      })

      expect(response.status).toBe(201)

      const message = await response.json()
      expect(message).toHaveProperty('id')
      expect(message.conversationId).toBe(conversation.id)
      expect(message.senderUserId).toBe(user1.id)
      expect(message.type).toBe('text')
      expect(message.text).toBe('Hello, world!')
      expect(message).toHaveProperty('createdAt')
    })

    it('sends a reply message with replyToMessageId', async () => {
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')
      const user3 = await createUser('User 3')

      // Create a conversation between user1 and user2
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Try to send message as user3
      const response = await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user1.id,
          lastReadMessageId: message.id,
        }),
      })

      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result.status).toBe('ok')
      expect(result.read).toHaveProperty('id')
      expect(result.read.conversationId).toBe(conversation.id)
      expect(result.read.userId).toBe(user1.id)
      expect(result.read.lastReadMessageId).toBe(message.id)
      expect(result.read).toHaveProperty('updatedAt')
    })

    it('returns 400 for non-existent message', async () => {
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Try to update read position with non-existent message
      const response = await app.request(`/conversations/${conversation.id}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Send messages
      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user2.id,
          text: 'Message 1',
        }),
      })

      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user2.id,
          text: 'Message 2',
        }),
      })

      // Get unread count
      const response = await app.request(
        `/conversations/${conversation.id}/unread-count?userId=${user1.id}`
      )

      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result).toHaveProperty('unreadCount')
      expect(typeof result.unreadCount).toBe('number')
      expect(result.unreadCount).toBeGreaterThanOrEqual(0)
    })

    it('returns total message count when no read position is set', async () => {
      const user1 = await createUser('User 1')
      const user2 = await createUser('User 2')

      // Create a conversation
      const createResponse = await app.request('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participantIds: [user1.id, user2.id],
        }),
      })

      const conversation = await createResponse.json()

      // Send messages
      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user2.id,
          text: 'Message 1',
        }),
      })

      await app.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId: user2.id,
          text: 'Message 2',
        }),
      })

      // Get unread count without setting read position
      const response = await app.request(
        `/conversations/${conversation.id}/unread-count?userId=${user1.id}`
      )

      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result.unreadCount).toBeGreaterThanOrEqual(2)
    })
  })
})
