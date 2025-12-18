import { sqliteTable, text, index, uniqueIndex, type SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Enum types as const arrays for type safety
const conversationTypes = ['direct', 'group'] as const
const participantRoles = ['member', 'admin'] as const
const messageTypes = ['text', 'system'] as const
const systemEvents = ['join', 'leave'] as const
const messageStatuses = ['active', 'deleted'] as const

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  idAlias: text('id_alias').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type', { enum: conversationTypes }).notNull(),
  name: text('name'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const participants = sqliteTable(
  'participants',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: participantRoles }).notNull().default('member'),
    joinedAt: text('joined_at').notNull().$defaultFn(() => new Date().toISOString()),
    leftAt: text('left_at'),
  },
  table => ({
    conversationUserUnique: uniqueIndex('participants_conversation_user_unique').on(
      table.conversationId,
      table.userId,
    ),
  }),
)

export const messages: SQLiteTableWithColumns<any> = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderUserId: text('sender_user_id').references(() => users.id, { onDelete: 'set null' }),
    type: text('type', { enum: messageTypes }).notNull().default('text'),
    text: text('text'),
    replyToMessageId: text('reply_to_message_id').references((): any => messages.id, {
      onDelete: 'set null',
    }),
    systemEvent: text('system_event', { enum: systemEvents }),
    status: text('status', { enum: messageStatuses }).notNull().default('active'),
    deletedAt: text('deleted_at'),
    deletedByUserId: text('deleted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  },
  table => ({}),
)

export const reactions = sqliteTable(
  'reactions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    reactionUnique: uniqueIndex('reaction_unique').on(table.messageId, table.userId, table.emoji),
  }),
)

export const conversationReads = sqliteTable(
  'conversation_reads',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastReadMessageId: text('last_read_message_id').references(() => messages.id, {
      onDelete: 'set null',
    }),
    updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    conversationUserUnique: uniqueIndex('conversation_reads_conversation_user_unique').on(
      table.conversationId,
      table.userId,
    ),
    lastReadMessageIndex: index('conversation_reads_last_read_message_idx').on(
      table.lastReadMessageId,
    ),
  }),
)

export const messageBookmarks = sqliteTable(
  'message_bookmarks',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    messageUserUnique: uniqueIndex('message_bookmarks_message_user_unique').on(
      table.messageId,
      table.userId,
    ),
  }),
)
