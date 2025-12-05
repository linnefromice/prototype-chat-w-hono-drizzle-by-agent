import { z } from 'zod'
import { ConversationReadSchema } from './ConversationReadSchema'

export const UpdateConversationReadResponseSchema = z.object({
  status: z.literal('ok'),
  read: ConversationReadSchema,
})

export type UpdateConversationReadResponse = z.infer<typeof UpdateConversationReadResponseSchema>
