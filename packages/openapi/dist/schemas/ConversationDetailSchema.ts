import { z } from 'zod'
import { ConversationSchema } from './ConversationSchema'
import { ParticipantSchema } from './ParticipantSchema'

export const ConversationDetailSchema = ConversationSchema.extend({
  participants: z.array(ParticipantSchema),
})

export type ConversationDetail = z.infer<typeof ConversationDetailSchema>
