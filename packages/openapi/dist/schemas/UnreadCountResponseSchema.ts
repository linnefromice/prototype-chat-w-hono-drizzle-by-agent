import { z } from 'zod'

export const UnreadCountResponseSchema = z.object({
  unreadCount: z.number().int().nonnegative(),
})

export type UnreadCountResponse = z.infer<typeof UnreadCountResponseSchema>
