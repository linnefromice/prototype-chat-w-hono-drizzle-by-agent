import { z } from 'zod'

export const ReactionSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  userId: z.string().uuid(),
  emoji: z.string(),
  createdAt: z.string().datetime(),
})

export type Reaction = z.infer<typeof ReactionSchema>
