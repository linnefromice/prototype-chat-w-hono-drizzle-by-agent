import { z } from 'zod'

export const UpdateConversationReadRequestSchema = z.object({
  userId: z.string().uuid(),
  lastReadMessageId: z.string().uuid(),
})

export type UpdateConversationReadRequest = z.infer<typeof UpdateConversationReadRequestSchema>
