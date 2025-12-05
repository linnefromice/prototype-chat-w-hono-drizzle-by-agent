import { z } from 'zod'

export const CreateConversationRequestSchema = z.object({
  type: z.enum(['direct', 'group']),
  name: z.string().nullable().optional(),
  participantIds: z.array(z.string().uuid()).min(1),
})

export type CreateConversationRequest = z.infer<typeof CreateConversationRequestSchema>
