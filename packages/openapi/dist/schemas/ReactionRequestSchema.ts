import { z } from 'zod'

export const ReactionRequestSchema = z.object({
  userId: z.string().uuid(),
  emoji: z.string(),
})

export type ReactionRequest = z.infer<typeof ReactionRequestSchema>
