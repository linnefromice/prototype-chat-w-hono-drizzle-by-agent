import { z } from 'zod'

export const UnbookmarkResponseSchema = z.object({
  status: z.literal('unbookmarked'),
})

export type UnbookmarkResponse = z.infer<typeof UnbookmarkResponseSchema>
