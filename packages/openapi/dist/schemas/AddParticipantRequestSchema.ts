import { z } from 'zod'

export const AddParticipantRequestSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['member', 'admin']).optional(),
})

export type AddParticipantRequest = z.infer<typeof AddParticipantRequestSchema>
