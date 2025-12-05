import { z } from 'zod'

export const ItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
})

export type Item = z.infer<typeof ItemSchema>
