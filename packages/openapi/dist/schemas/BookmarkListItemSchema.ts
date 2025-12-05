import { z } from 'zod'

export const BookmarkListItemSchema = z.object({
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  text: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  messageCreatedAt: z.string().datetime(),
})

export type BookmarkListItem = z.infer<typeof BookmarkListItemSchema>
