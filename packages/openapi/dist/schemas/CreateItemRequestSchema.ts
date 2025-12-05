import { z } from 'zod'

export const CreateItemRequestSchema = z.object({
  name: z.string(),
})

export type CreateItemRequest = z.infer<typeof CreateItemRequestSchema>
