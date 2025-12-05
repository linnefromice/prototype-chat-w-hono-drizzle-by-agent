import { z } from 'zod'
import { BookmarkSchema } from './BookmarkSchema'

export const BookmarkResponseSchema = z.object({
  status: z.literal('bookmarked'),
  bookmark: BookmarkSchema,
})

export type BookmarkResponse = z.infer<typeof BookmarkResponseSchema>
