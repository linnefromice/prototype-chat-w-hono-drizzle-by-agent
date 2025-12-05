import { z } from 'zod'

export const SendMessageRequestSchema = z.object({
  senderUserId: z.string().uuid().nullable(),
  text: z.string().nullable().optional(),
  replyToMessageId: z.string().uuid().nullable().optional(),
  systemEvent: z.enum(['join', 'leave']).nullable().optional(),
})

export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>
