import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import type {
  AddParticipantRequest,
  ConversationDetail,
  CreateConversationRequest,
  Message,
  Reaction,
  ReactionRequest,
  SendMessageRequest,
} from 'openapi'
import type { Participant } from 'openapi/dist/schemas/ParticipantSchema'
import { db } from '../infrastructure/db/client'
import { conversations, messages, participants, reactions } from '../infrastructure/db/schema'
import type { ChatRepository, MessageQueryOptions } from './chatRepository'

const mapParticipant = (row: typeof participants.$inferSelect): Participant => ({
  id: row.id,
  conversationId: row.conversationId,
  userId: row.userId,
  role: row.role,
  joinedAt: row.joinedAt.toISOString(),
  leftAt: row.leftAt ? row.leftAt.toISOString() : undefined,
})

const mapConversation = (
  row: typeof conversations.$inferSelect,
  participantList: Participant[] = [],
): ConversationDetail => ({
  id: row.id,
  type: row.type,
  name: row.name ?? undefined,
  createdAt: row.createdAt.toISOString(),
  participants: participantList,
})

const mapMessage = (row: typeof messages.$inferSelect): Message => ({
  id: row.id,
  conversationId: row.conversationId,
  senderUserId: row.senderUserId ?? undefined,
  type: row.type,
  text: row.text ?? undefined,
  replyToMessageId: row.replyToMessageId ?? undefined,
  systemEvent: row.systemEvent ?? undefined,
  createdAt: row.createdAt.toISOString(),
})

const mapReaction = (row: typeof reactions.$inferSelect): Reaction => ({
  id: row.id,
  messageId: row.messageId,
  userId: row.userId,
  emoji: row.emoji,
  createdAt: row.createdAt.toISOString(),
})

export class DrizzleChatRepository implements ChatRepository {
  constructor(private readonly client = db) {}

  async createConversation(data: CreateConversationRequest): Promise<ConversationDetail> {
    const [conversationRow] = await this.client
      .insert(conversations)
      .values({
        type: data.type,
        name: data.name ?? null,
      })
      .returning()

    const participantsPayload = data.participantIds.map(participantId => ({
      conversationId: conversationRow.id,
      userId: participantId,
      role: 'member' as const,
    }))

    const participantRows = participantsPayload.length
      ? await this.client.insert(participants).values(participantsPayload).returning()
      : []

    return mapConversation(conversationRow, participantRows.map(mapParticipant))
  }

  async getConversation(conversationId: string): Promise<ConversationDetail | null> {
    const [conversationRow] = await this.client
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1)

    if (!conversationRow) return null

    const participantRows = await this.client
      .select()
      .from(participants)
      .where(eq(participants.conversationId, conversationId))

    return mapConversation(conversationRow, participantRows.map(mapParticipant))
  }

  async listConversationsForUser(userId: string): Promise<ConversationDetail[]> {
    const membershipRows = await this.client
      .select({ conversation: conversations })
      .from(participants)
      .innerJoin(conversations, eq(participants.conversationId, conversations.id))
      .where(eq(participants.userId, userId))
      .orderBy(desc(conversations.createdAt))

    const conversationIds = membershipRows.map(row => row.conversation.id)

    if (conversationIds.length === 0) {
      return []
    }

    const participantRows = await this.client
      .select()
      .from(participants)
      .where(inArray(participants.conversationId, conversationIds))

    const participantMap = participantRows.reduce<Map<string, Participant[]>>((acc, row) => {
      const list = acc.get(row.conversationId) ?? []
      list.push(mapParticipant(row))
      acc.set(row.conversationId, list)
      return acc
    }, new Map())

    return membershipRows.map(row =>
      mapConversation(row.conversation, participantMap.get(row.conversation.id) ?? []),
    )
  }

  async addParticipant(conversationId: string, data: AddParticipantRequest): Promise<Participant> {
    const [participantRow] = await this.client
      .insert(participants)
      .values({
        conversationId,
        userId: data.userId,
        role: data.role ?? 'member',
      })
      .onConflictDoUpdate({
        target: [participants.conversationId, participants.userId],
        set: { leftAt: null, role: data.role ?? 'member' },
      })
      .returning()

    return mapParticipant(participantRow)
  }

  async findParticipant(conversationId: string, userId: string): Promise<Participant | null> {
    const [participantRow] = await this.client
      .select()
      .from(participants)
      .where(and(eq(participants.conversationId, conversationId), eq(participants.userId, userId)))
      .limit(1)

    return participantRow ? mapParticipant(participantRow) : null
  }

  async markParticipantLeft(conversationId: string, userId: string): Promise<Participant | null> {
    const [participantRow] = await this.client
      .update(participants)
      .set({ leftAt: new Date() })
      .where(and(eq(participants.conversationId, conversationId), eq(participants.userId, userId)))
      .returning()

    return participantRow ? mapParticipant(participantRow) : null
  }

  async createMessage(
    conversationId: string,
    payload: SendMessageRequest & { type: 'text' | 'system' },
  ): Promise<Message> {
    const [messageRow] = await this.client
      .insert(messages)
      .values({
        conversationId,
        senderUserId: payload.senderUserId ?? null,
        text: payload.text ?? null,
        type: payload.type,
        replyToMessageId: payload.replyToMessageId ?? null,
        systemEvent: payload.systemEvent ?? null,
      })
      .returning()

    return mapMessage(messageRow)
  }

  async listMessages(conversationId: string, options: MessageQueryOptions = {}): Promise<Message[]> {
    const { before, limit = 50 } = options

    const messageRows = await this.client
      .select()
      .from(messages)
      .where(
        before
          ? and(eq(messages.conversationId, conversationId), lt(messages.createdAt, new Date(before)))
          : eq(messages.conversationId, conversationId),
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit)

    return messageRows.map(mapMessage)
  }

  async findMessageById(messageId: string): Promise<Message | null> {
    const [messageRow] = await this.client.select().from(messages).where(eq(messages.id, messageId)).limit(1)
    return messageRow ? mapMessage(messageRow) : null
  }

  async addReaction(messageId: string, data: ReactionRequest): Promise<Reaction> {
    const [reactionRow] = await this.client
      .insert(reactions)
      .values({
        messageId,
        userId: data.userId,
        emoji: data.emoji,
      })
      .onConflictDoNothing({ target: [reactions.messageId, reactions.userId, reactions.emoji] })
      .returning()

    if (reactionRow) {
      return mapReaction(reactionRow)
    }

    const [existing] = await this.client
      .select()
      .from(reactions)
      .where(and(eq(reactions.messageId, messageId), eq(reactions.userId, data.userId), eq(reactions.emoji, data.emoji)))
      .limit(1)

    if (!existing) {
      throw new Error('Failed to upsert reaction')
    }

    return mapReaction(existing)
  }

  async removeReaction(messageId: string, emoji: string, userId: string): Promise<Reaction | null> {
    const [reactionRow] = await this.client
      .delete(reactions)
      .where(and(eq(reactions.messageId, messageId), eq(reactions.userId, userId), eq(reactions.emoji, emoji)))
      .returning()

    return reactionRow ? mapReaction(reactionRow) : null
  }
}
