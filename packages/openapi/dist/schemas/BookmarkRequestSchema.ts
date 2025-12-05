import { z } from 'zod'

export const BookmarkRequestSchema = z.object({
  userId: z.string().uuid(),
})

export type BookmarkRequest = z.infer<typeof BookmarkRequestSchema>
