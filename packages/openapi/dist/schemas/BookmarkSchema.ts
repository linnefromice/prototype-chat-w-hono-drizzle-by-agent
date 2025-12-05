import { z } from 'zod'

export const BookmarkSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
})

export type Bookmark = z.infer<typeof BookmarkSchema>
