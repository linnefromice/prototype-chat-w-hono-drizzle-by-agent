import { z } from 'zod'

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderUserId: z.string().uuid().nullable().optional(),
  type: z.enum(['text', 'system']),
  text: z.string().nullable().optional(),
  replyToMessageId: z.string().uuid().nullable().optional(),
  systemEvent: z.enum(['join', 'leave']).nullable().optional(),
  createdAt: z.string().datetime(),
})

export type Message = z.infer<typeof MessageSchema>
