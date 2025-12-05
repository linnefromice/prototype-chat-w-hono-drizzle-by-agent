import { z } from 'zod'

export const ConversationReadSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  lastReadMessageId: z.string().uuid().nullable().optional(),
  updatedAt: z.string().datetime(),
})

export type ConversationRead = z.infer<typeof ConversationReadSchema>
