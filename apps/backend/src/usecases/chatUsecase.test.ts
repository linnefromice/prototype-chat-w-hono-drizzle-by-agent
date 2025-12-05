import { describe, it, expect, beforeEach } from 'vitest'
import type {
  AddParticipantRequest,
  Bookmark,
  BookmarkListItem,
  BookmarkRequest,
  ConversationDetail,
  ConversationRead,
  CreateConversationRequest,
  Message,
  Reaction,
  ReactionRequest,
  SendMessageRequest,
  UpdateConversationReadRequest,
} from 'openapi'
import type { Participant } from 'openapi/dist/schemas/ParticipantSchema'
import { ChatUsecase } from './chatUsecase'
import type { ChatRepository, MessageQueryOptions } from '../repositories/chatRepository'
import { HttpError } from '../utils/errors'

const uuid = (seed: number) => `00000000-0000-0000-0000-${(seed + '').padStart(12, '0')}`

class FakeChatRepository implements ChatRepository {
  private conversations = new Map<string, ConversationDetail>()
  private participants = new Map<string, Participant[]>()
  private messages = new Map<string, Message>()
  private reactions = new Map<string, Reaction[]>()
  private bookmarks = new Map<string, Bookmark[]>()
  private readState = new Map<string, ConversationRead>()
  private counter = 1

  constructor() {
    const conversationId = uuid(this.counter++)
    const createdAt = new Date().toISOString()
    const participants: Participant[] = [
      { id: uuid(this.counter++), conversationId, userId: uuid(100), role: 'admin', joinedAt: createdAt },
      { id: uuid(this.counter++), conversationId, userId: uuid(200), role: 'member', joinedAt: createdAt },
    ]

    this.conversations.set(conversationId, {
      id: conversationId,
      type: 'group',
      name: 'Test Conversation',
      createdAt,
      participants,
    })
    this.participants.set(conversationId, participants)
  }

  private nextId() {
    return uuid(this.counter++)
  }

  async createConversation(data: CreateConversationRequest): Promise<ConversationDetail> {
    const id = this.nextId()
    const createdAt = new Date().toISOString()
    const participants: Participant[] = data.participantIds.map((userId, index) => ({
      id: this.nextId(),
      conversationId: id,
      userId,
      role: index === 0 ? 'admin' : 'member',
      joinedAt: createdAt,
    }))

    const conversation: ConversationDetail = { id, type: data.type, name: data.name, createdAt, participants }
    this.conversations.set(id, conversation)
    this.participants.set(id, participants)
    return conversation
  }

  async getConversation(conversationId: string): Promise<ConversationDetail | null> {
    return this.conversations.get(conversationId) ?? null
  }

  async listConversationsForUser(userId: string): Promise<ConversationDetail[]> {
    return Array.from(this.conversations.values()).filter((conversation) =>
      conversation.participants.some((participant) => participant.userId === userId),
    )
  }

  async addParticipant(conversationId: string, data: AddParticipantRequest): Promise<Participant> {
    const participant: Participant = {
      id: this.nextId(),
      conversationId,
      userId: data.userId,
      role: 'member',
      joinedAt: new Date().toISOString(),
    }

    const list = this.participants.get(conversationId) ?? []
    list.push(participant)
    this.participants.set(conversationId, list)
    return participant
  }

  async findParticipant(conversationId: string, userId: string): Promise<Participant | null> {
    const list = this.participants.get(conversationId) ?? []
    return list.find((participant) => participant.userId === userId) ?? null
  }

  async markParticipantLeft(conversationId: string, userId: string): Promise<Participant | null> {
    const participant = await this.findParticipant(conversationId, userId)
    if (!participant) return null

    participant.leftAt = new Date().toISOString()
    return participant
  }

  async createMessage(
    conversationId: string,
    payload: SendMessageRequest & { type: 'text' | 'system' },
  ): Promise<Message> {
    const message: Message = {
      id: this.nextId(),
      conversationId,
      senderUserId: payload.senderUserId ?? null,
      type: payload.type,
      text: payload.text,
      replyToMessageId: payload.replyToMessageId,
      systemEvent: payload.systemEvent,
      createdAt: new Date().toISOString(),
    }

    this.messages.set(message.id, message)
    return message
  }

  async listMessages(conversationId: string, _options: MessageQueryOptions = {}): Promise<Message[]> {
    return Array.from(this.messages.values()).filter((message) => message.conversationId === conversationId)
  }

  async findMessageById(messageId: string): Promise<Message | null> {
    return this.messages.get(messageId) ?? null
  }

  async addReaction(messageId: string, data: ReactionRequest): Promise<Reaction> {
    const reaction: Reaction = {
      id: this.nextId(),
      messageId,
      userId: data.userId,
      emoji: data.emoji,
      createdAt: new Date().toISOString(),
    }

    const list = this.reactions.get(messageId) ?? []
    list.push(reaction)
    this.reactions.set(messageId, list)
    return reaction
  }

  async removeReaction(messageId: string, emoji: string, userId: string): Promise<Reaction | null> {
    const list = this.reactions.get(messageId) ?? []
    const index = list.findIndex((reaction) => reaction.emoji === emoji && reaction.userId === userId)
    if (index === -1) return null

    const [removed] = list.splice(index, 1)
    this.reactions.set(messageId, list)
    return removed
  }

  async updateConversationRead(
    conversationId: string,
    data: UpdateConversationReadRequest,
  ): Promise<ConversationRead> {
    const state: ConversationRead = {
      id: this.nextId(),
      conversationId,
      userId: data.userId,
      lastReadMessageId: data.lastReadMessageId,
      updatedAt: new Date().toISOString(),
    }

    this.readState.set(`${conversationId}:${data.userId}`, state)
    return state
  }

  async countUnread(conversationId: string, userId: string): Promise<number> {
    const read = this.readState.get(`${conversationId}:${userId}`)
    if (!read) return this.messages.size

    return Array.from(this.messages.values()).filter(
      (message) => message.conversationId === conversationId && message.id > (read.lastReadMessageId ?? ''),
    ).length
  }

  async addBookmark(messageId: string, data: BookmarkRequest): Promise<Bookmark> {
    const bookmark: Bookmark = {
      id: this.nextId(),
      messageId,
      userId: data.userId,
      createdAt: new Date().toISOString(),
    }

    const list = this.bookmarks.get(data.userId) ?? []
    list.push(bookmark)
    this.bookmarks.set(data.userId, list)
    return bookmark
  }

  async removeBookmark(messageId: string, userId: string): Promise<Bookmark | null> {
    const list = this.bookmarks.get(userId) ?? []
    const index = list.findIndex((bookmark) => bookmark.messageId === messageId)
    if (index === -1) return null

    const [removed] = list.splice(index, 1)
    this.bookmarks.set(userId, list)
    return removed
  }

  async listBookmarks(userId: string): Promise<BookmarkListItem[]> {
    return (this.bookmarks.get(userId) ?? []).map((bookmark) => {
      const message = this.messages.get(bookmark.messageId)
      return {
        messageId: bookmark.messageId,
        conversationId: message?.conversationId ?? uuid(0),
        text: message?.text,
        createdAt: bookmark.createdAt,
        messageCreatedAt: message?.createdAt ?? bookmark.createdAt,
      }
    })
  }
}

const ACTIVE_USER = uuid(100)
const CONVERSATION_ID = uuid(1)

describe('ChatUsecase', () => {
  let repo: FakeChatRepository
  let usecase: ChatUsecase

  beforeEach(() => {
    repo = new FakeChatRepository()
    usecase = new ChatUsecase(repo)
  })

  it('validates group conversation name', async () => {
    await expect(
      usecase.createConversation({ type: 'group', name: null, participantIds: [ACTIVE_USER] }),
    ).rejects.toThrow(new HttpError(400, 'Group conversations require a name'))
  })

  it('requires at least one participant', async () => {
    await expect(usecase.createConversation({ type: 'direct', name: null, participantIds: [] })).rejects.toThrow(
      new HttpError(400, 'At least one participant is required'),
    )
  })

  it('throws when conversation is missing', async () => {
    await expect(usecase.getConversation(uuid(999))).rejects.toThrow(new HttpError(404, 'Conversation not found'))
  })

  it('prevents left participants from reading messages', async () => {
    await repo.markParticipantLeft(CONVERSATION_ID, ACTIVE_USER)

    await expect(usecase.listMessages(CONVERSATION_ID, ACTIVE_USER)).rejects.toThrow(
      new HttpError(403, 'User is not an active participant in this conversation'),
    )
  })

  it('requires senderUserId when sending messages', async () => {
    await expect(usecase.sendMessage(CONVERSATION_ID, { text: 'Hello', senderUserId: undefined })).rejects.toThrow(
      new HttpError(400, 'senderUserId is required for messages'),
    )
  })

  it('rejects replies to messages in other conversations', async () => {
    const otherConversation = await repo.createConversation({ type: 'group', name: 'Other', participantIds: [ACTIVE_USER] })
    const foreignMessage = await repo.createMessage(otherConversation.id, { senderUserId: ACTIVE_USER, text: 'Hi', type: 'text' })

    await expect(
      usecase.sendMessage(CONVERSATION_ID, {
        senderUserId: ACTIVE_USER,
        text: 'reply',
        replyToMessageId: foreignMessage.id,
      }),
    ).rejects.toThrow(new HttpError(400, 'Referenced message must belong to the same conversation'))
  })

  it('rejects reactions for unknown messages', async () => {
    await expect(
      usecase.addReaction(uuid(555), { emoji: '👍', userId: ACTIVE_USER }),
    ).rejects.toThrow(new HttpError(404, 'Message not found'))
  })

  it('requires reactions to exist before removal', async () => {
    const message = await repo.createMessage(CONVERSATION_ID, { senderUserId: ACTIVE_USER, text: 'Hello', type: 'text' })

    await expect(usecase.removeReaction(message.id, '👍', ACTIVE_USER)).rejects.toThrow(
      new HttpError(404, 'Reaction not found'),
    )
  })

  it('validates last read message belongs to conversation', async () => {
    const otherConversation = await repo.createConversation({ type: 'direct', name: null, participantIds: [ACTIVE_USER] })
    const foreignMessage = await repo.createMessage(otherConversation.id, { senderUserId: ACTIVE_USER, text: 'Hi', type: 'text' })

    await expect(
      usecase.markConversationRead(CONVERSATION_ID, { userId: ACTIVE_USER, lastReadMessageId: foreignMessage.id }),
    ).rejects.toThrow(new HttpError(400, 'lastReadMessageId must belong to the conversation'))
  })

  it('requires bookmarked messages to exist and belong to active users', async () => {
    await expect(usecase.addBookmark(uuid(777), { userId: ACTIVE_USER })).rejects.toThrow(
      new HttpError(404, 'Message not found'),
    )

    const message = await repo.createMessage(CONVERSATION_ID, { senderUserId: ACTIVE_USER, text: 'Hello', type: 'text' })
    await expect(usecase.removeBookmark(message.id, uuid(201))).rejects.toThrow(new HttpError(404, 'Bookmark not found'))
  })
})
