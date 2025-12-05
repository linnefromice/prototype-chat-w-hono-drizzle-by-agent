import { z } from 'zod'

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['direct', 'group']),
  name: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
})

export type Conversation = z.infer<typeof ConversationSchema>
