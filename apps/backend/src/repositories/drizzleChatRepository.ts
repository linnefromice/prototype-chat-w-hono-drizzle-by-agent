import { and, count, desc, eq, gt, inArray, lt } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type {
  AddParticipantRequest,
  Bookmark,
  BookmarkListItem,
  BookmarkRequest,
  ConversationDetail,
  ConversationRead,
  CreateConversationRequest,
  Message,
  Participant,
  Reaction,
  ReactionRequest,
  SendMessageRequest,
  UpdateConversationReadRequest,
} from 'openapi'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import {
  conversationReads,
  conversations,
  messageBookmarks,
  messages,
  participants,
  reactions,
  users,
} from '../infrastructure/db/schema'
import type { ChatRepository, MessageQueryOptions } from './chatRepository'

const mapParticipant = (
  participantRow: typeof participants.$inferSelect,
  userRow: typeof users.$inferSelect,
): Participant => ({
  id: participantRow.id,
  conversationId: participantRow.conversationId,
  userId: participantRow.userId,
  role: participantRow.role,
  // SQLite stores dates as ISO 8601 strings
  joinedAt: participantRow.joinedAt,
  leftAt: participantRow.leftAt ?? undefined,
  user: {
    id: userRow.id,
    idAlias: userRow.idAlias,
    name: userRow.name,
    avatarUrl: userRow.avatarUrl ?? undefined,
    createdAt: userRow.createdAt,
  },
})

const mapConversation = (
  row: typeof conversations.$inferSelect,
  participantList: Participant[] = [],
): ConversationDetail => ({
  id: row.id,
  type: row.type,
  name: row.name ?? undefined,
  // SQLite stores dates as ISO 8601 strings
  createdAt: row.createdAt,
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
  // SQLite stores dates as ISO 8601 strings
  createdAt: row.createdAt,
})

const mapReaction = (row: typeof reactions.$inferSelect): Reaction => ({
  id: row.id,
  messageId: row.messageId,
  userId: row.userId,
  emoji: row.emoji,
  // SQLite stores dates as ISO 8601 strings
  createdAt: row.createdAt,
})

const mapConversationRead = (row: typeof conversationReads.$inferSelect): ConversationRead => ({
  id: row.id,
  conversationId: row.conversationId,
  userId: row.userId,
  lastReadMessageId: row.lastReadMessageId ?? undefined,
  // SQLite stores dates as ISO 8601 strings
  updatedAt: row.updatedAt,
})

const mapBookmark = (row: typeof messageBookmarks.$inferSelect): Bookmark => ({
  id: row.id,
  messageId: row.messageId,
  userId: row.userId,
  // SQLite stores dates as ISO 8601 strings
  createdAt: row.createdAt,
})

type DbClient = DrizzleD1Database<any> | BetterSQLite3Database<any>

export class DrizzleChatRepository implements ChatRepository {
  private readonly client: DbClient

  constructor(client?: DbClient) {
    // Client must be provided (will be injected from context)
    if (!client) {
      throw new Error('Database client is required')
    }
    this.client = client
  }

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

    if (!participantsPayload.length) {
      return mapConversation(conversationRow, [])
    }

    await this.client.insert(participants).values(participantsPayload)

    const participantWithUserRows = await this.client
      .select()
      .from(participants)
      .innerJoin(users, eq(participants.userId, users.id))
      .where(eq(participants.conversationId, conversationRow.id))

    // Order participants by the original participantIds array order
    const participantMap = new Map(
      participantWithUserRows.map(row => [row.participants.userId, row])
    )
    const participantList = data.participantIds
      .map(userId => participantMap.get(userId))
      .filter((row): row is NonNullable<typeof row> => row !== undefined)
      .map(row => mapParticipant(row.participants, row.users))

    return mapConversation(conversationRow, participantList)
  }

  async getConversation(conversationId: string): Promise<ConversationDetail | null> {
    const [conversationRow] = await this.client
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1)

    if (!conversationRow) return null

    const participantWithUserRows = await this.client
      .select()
      .from(participants)
      .innerJoin(users, eq(participants.userId, users.id))
      .where(eq(participants.conversationId, conversationId))
      .orderBy(participants.id)

    const participantList = participantWithUserRows.map(row =>
      mapParticipant(row.participants, row.users),
    )

    return mapConversation(conversationRow, participantList)
  }

  async listConversationsForUser(userId: string): Promise<ConversationDetail[]> {
    const membershipRows = await this.client
      .select()
      .from(participants)
      .innerJoin(conversations, eq(participants.conversationId, conversations.id))
      .where(eq(participants.userId, userId))
      .orderBy(desc(conversations.createdAt))

    const conversationIds = membershipRows.map(row => row.conversations.id)

    if (conversationIds.length === 0) {
      return []
    }

    const participantWithUserRows = await this.client
      .select()
      .from(participants)
      .innerJoin(users, eq(participants.userId, users.id))
      .where(inArray(participants.conversationId, conversationIds))
      .orderBy(participants.id)

    const participantMap = participantWithUserRows.reduce<Map<string, Participant[]>>(
      (acc, row) => {
        const list = acc.get(row.participants.conversationId) ?? []
        list.push(mapParticipant(row.participants, row.users))
        acc.set(row.participants.conversationId, list)
        return acc
      },
      new Map(),
    )

    return membershipRows.map(row =>
      mapConversation(row.conversations, participantMap.get(row.conversations.id) ?? []),
    )
  }

  async addParticipant(conversationId: string, data: AddParticipantRequest): Promise<Participant> {
    await this.client
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

    const [result] = await this.client
      .select()
      .from(participants)
      .innerJoin(users, eq(participants.userId, users.id))
      .where(and(eq(participants.conversationId, conversationId), eq(participants.userId, data.userId)))
      .limit(1)

    if (!result) {
      throw new Error('Failed to add participant')
    }

    return mapParticipant(result.participants, result.users)
  }

  async findParticipant(conversationId: string, userId: string): Promise<Participant | null> {
    const [result] = await this.client
      .select()
      .from(participants)
      .innerJoin(users, eq(participants.userId, users.id))
      .where(and(eq(participants.conversationId, conversationId), eq(participants.userId, userId)))
      .limit(1)

    return result ? mapParticipant(result.participants, result.users) : null
  }

  async markParticipantLeft(conversationId: string, userId: string): Promise<Participant | null> {
    await this.client
      .update(participants)
      .set({ leftAt: new Date().toISOString() })
      .where(and(eq(participants.conversationId, conversationId), eq(participants.userId, userId)))

    const [result] = await this.client
      .select()
      .from(participants)
      .innerJoin(users, eq(participants.userId, users.id))
      .where(and(eq(participants.conversationId, conversationId), eq(participants.userId, userId)))
      .limit(1)

    return result ? mapParticipant(result.participants, result.users) : null
  }

  async createMessage(
    conversationId: string,
    payload: SendMessageRequest & { type: 'text' | 'system' },
  ): Promise<Message> {
    const result = await this.client
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

    const [messageRow] = result as Array<typeof messages.$inferSelect>
    return mapMessage(messageRow)
  }

  async listMessages(conversationId: string, options: MessageQueryOptions = {}): Promise<Message[]> {
    const { before, limit = 50 } = options

    const messageRows = await this.client
      .select()
      .from(messages)
      .where(
        before
          ? and(eq(messages.conversationId, conversationId), lt(messages.createdAt, before))
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

  async listReactions(messageId: string): Promise<Reaction[]> {
    const reactionRows = await this.client
      .select()
      .from(reactions)
      .where(eq(reactions.messageId, messageId))

    return reactionRows.map(mapReaction)
  }

  async updateConversationRead(
    conversationId: string,
    data: UpdateConversationReadRequest,
  ): Promise<ConversationRead> {
    const [readRow] = await this.client
      .insert(conversationReads)
      .values({
        conversationId,
        userId: data.userId,
        lastReadMessageId: data.lastReadMessageId,
      })
      .onConflictDoUpdate({
        target: [conversationReads.conversationId, conversationReads.userId],
        set: { lastReadMessageId: data.lastReadMessageId, updatedAt: new Date().toISOString() },
      })
      .returning()

    return mapConversationRead(readRow)
  }

  async countUnread(conversationId: string, userId: string): Promise<number> {
    const [readRow] = await this.client
      .select()
      .from(conversationReads)
      .where(and(eq(conversationReads.conversationId, conversationId), eq(conversationReads.userId, userId)))
      .limit(1)

    let predicate: SQL<unknown> = eq(messages.conversationId, conversationId)

    if (readRow?.lastReadMessageId) {
      const [lastReadMessage] = await this.client
        .select()
        .from(messages)
        .where(eq(messages.id, readRow.lastReadMessageId))
        .limit(1)

        if (lastReadMessage?.createdAt) {
          const updatedPredicate = and(predicate, gt(messages.createdAt, lastReadMessage.createdAt))
          predicate = updatedPredicate ?? predicate
        }
    }

    const results = await this.client
      .select()
      .from(messages)
      .where(predicate)

    return results.length
  }

  async addBookmark(messageId: string, data: BookmarkRequest): Promise<Bookmark> {
    const [bookmarkRow] = await this.client
      .insert(messageBookmarks)
      .values({
        messageId,
        userId: data.userId,
      })
      .onConflictDoNothing({ target: [messageBookmarks.messageId, messageBookmarks.userId] })
      .returning()

    if (bookmarkRow) {
      return mapBookmark(bookmarkRow)
    }

    const [existing] = await this.client
      .select()
      .from(messageBookmarks)
      .where(and(eq(messageBookmarks.messageId, messageId), eq(messageBookmarks.userId, data.userId)))
      .limit(1)

    if (!existing) {
      throw new Error('Failed to upsert bookmark')
    }

    return mapBookmark(existing)
  }

  async removeBookmark(messageId: string, userId: string): Promise<Bookmark | null> {
    const [bookmarkRow] = await this.client
      .delete(messageBookmarks)
      .where(and(eq(messageBookmarks.messageId, messageId), eq(messageBookmarks.userId, userId)))
      .returning()

    return bookmarkRow ? mapBookmark(bookmarkRow) : null
  }

  async listBookmarks(userId: string): Promise<BookmarkListItem[]> {
    const rows = await this.client
      .select()
      .from(messageBookmarks)
      .innerJoin(messages, eq(messageBookmarks.messageId, messages.id))
      .where(eq(messageBookmarks.userId, userId))
      .orderBy(desc(messageBookmarks.createdAt))

    return rows
      .filter(row => row.messages !== null)
      .map(row => ({
        messageId: row.messages!.id,
        conversationId: row.messages!.conversationId,
        text: row.messages!.text ?? undefined,
        // SQLite stores dates as ISO 8601 strings
        createdAt: row.message_bookmarks.createdAt,
        messageCreatedAt: row.messages!.createdAt,
      }))
  }
}
