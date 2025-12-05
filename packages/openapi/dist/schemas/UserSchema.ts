import { z } from 'zod'

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
})

export type User = z.infer<typeof UserSchema>
