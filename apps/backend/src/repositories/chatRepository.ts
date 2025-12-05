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

export type MessageQueryOptions = {
  limit?: number
  before?: string
}

export interface ChatRepository {
  createConversation(data: CreateConversationRequest): Promise<ConversationDetail>
  getConversation(conversationId: string): Promise<ConversationDetail | null>
  listConversationsForUser(userId: string): Promise<ConversationDetail[]>

  addParticipant(conversationId: string, data: AddParticipantRequest): Promise<Participant>
  findParticipant(conversationId: string, userId: string): Promise<Participant | null>
  markParticipantLeft(conversationId: string, userId: string): Promise<Participant | null>

  createMessage(
    conversationId: string,
    payload: SendMessageRequest & { type: 'text' | 'system' },
  ): Promise<Message>
  listMessages(conversationId: string, options?: MessageQueryOptions): Promise<Message[]>
  findMessageById(messageId: string): Promise<Message | null>

  addReaction(messageId: string, data: ReactionRequest): Promise<Reaction>
  removeReaction(messageId: string, emoji: string, userId: string): Promise<Reaction | null>

  updateConversationRead(
    conversationId: string,
    data: UpdateConversationReadRequest,
  ): Promise<ConversationRead>
  countUnread(conversationId: string, userId: string): Promise<number>

  addBookmark(messageId: string, data: BookmarkRequest): Promise<Bookmark>
  removeBookmark(messageId: string, userId: string): Promise<Bookmark | null>
  listBookmarks(userId: string): Promise<BookmarkListItem[]>
}
