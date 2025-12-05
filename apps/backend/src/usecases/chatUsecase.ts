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
import type { ChatRepository, MessageQueryOptions } from '../repositories/chatRepository'
import { HttpError } from '../utils/errors'

export class ChatUsecase {
  constructor(private readonly repo: ChatRepository) {}

  async createConversation(data: CreateConversationRequest): Promise<ConversationDetail> {
    if (data.type === 'group' && !data.name) {
      throw new HttpError(400, 'Group conversations require a name')
    }

    if (data.participantIds.length === 0) {
      throw new HttpError(400, 'At least one participant is required')
    }

    return this.repo.createConversation(data)
  }

  async listConversationsForUser(userId: string): Promise<ConversationDetail[]> {
    if (!userId) {
      throw new HttpError(400, 'userId is required')
    }

    return this.repo.listConversationsForUser(userId)
  }

  async getConversation(conversationId: string): Promise<ConversationDetail> {
    const conversation = await this.repo.getConversation(conversationId)
    if (!conversation) {
      throw new HttpError(404, 'Conversation not found')
    }

    return conversation
  }

  async addParticipant(conversationId: string, data: AddParticipantRequest) {
    await this.getConversation(conversationId)
    return this.repo.addParticipant(conversationId, data)
  }

  async markParticipantLeft(conversationId: string, userId: string) {
    await this.getConversation(conversationId)
    const participant = await this.repo.markParticipantLeft(conversationId, userId)
    if (!participant) {
      throw new HttpError(404, 'Participant not found')
    }
    await this.createSystemMessage(conversationId, { systemEvent: 'leave', senderUserId: null })
    return participant
  }

  async listMessages(
    conversationId: string,
    userId: string,
    options: MessageQueryOptions = {},
  ): Promise<Message[]> {
    const participant = await this.ensureActiveParticipant(conversationId, userId)
    if (!participant) {
      throw new HttpError(403, 'You are not a participant in this conversation')
    }

    return this.repo.listMessages(conversationId, options)
  }

  async sendMessage(conversationId: string, payload: SendMessageRequest) {
    if (!payload.senderUserId) {
      throw new HttpError(400, 'senderUserId is required for messages')
    }

    await this.ensureActiveParticipant(conversationId, payload.senderUserId)

    if (payload.replyToMessageId) {
      const referenced = await this.repo.findMessageById(payload.replyToMessageId)
      if (!referenced || referenced.conversationId !== conversationId) {
        throw new HttpError(400, 'Referenced message must belong to the same conversation')
      }
    }

    return this.repo.createMessage(conversationId, { ...payload, type: 'text' })
  }

  async addReaction(messageId: string, data: ReactionRequest): Promise<Reaction> {
    const message = await this.repo.findMessageById(messageId)
    if (!message) {
      throw new HttpError(404, 'Message not found')
    }

    await this.ensureActiveParticipant(message.conversationId, data.userId)

    return this.repo.addReaction(messageId, data)
  }

  async removeReaction(messageId: string, emoji: string, userId: string) {
    const message = await this.repo.findMessageById(messageId)
    if (!message) {
      throw new HttpError(404, 'Message not found')
    }

    await this.ensureActiveParticipant(message.conversationId, userId)

    const removed = await this.repo.removeReaction(messageId, emoji, userId)
    if (!removed) {
      throw new HttpError(404, 'Reaction not found')
    }

    return removed
  }

  async createSystemMessage(
    conversationId: string,
    payload: Pick<SendMessageRequest, 'systemEvent' | 'senderUserId' | 'text'>,
  ) {
    return this.repo.createMessage(conversationId, { ...payload, type: 'system' })
  }

  private async ensureActiveParticipant(
    conversationId: string,
    userId: string,
  ): Promise<Participant | null> {
    const participant = await this.repo.findParticipant(conversationId, userId)
    if (!participant || participant.leftAt) {
      throw new HttpError(403, 'User is not an active participant in this conversation')
    }

    return participant
  }
}
