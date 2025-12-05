import { z } from 'zod'

export const ParticipantSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['member', 'admin']),
  joinedAt: z.string().datetime(),
  leftAt: z.string().datetime().nullable().optional(),
})

export type Participant = z.infer<typeof ParticipantSchema>
