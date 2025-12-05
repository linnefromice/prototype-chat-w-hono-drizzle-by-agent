import { z } from 'zod'

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
})

export type HealthResponse = z.infer<typeof HealthResponseSchema>
