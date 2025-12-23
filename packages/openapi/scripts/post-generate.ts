#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const distPath = resolve(process.cwd(), 'dist/index.ts')
const content = readFileSync(distPath, 'utf-8')

// Type exports to append
const typeExports = `
// Re-export Zod schemas for request validation
export { postItemsBody as CreateItemRequestSchema };
export { postConversationsBody as CreateConversationRequestSchema };
export { postConversationsIdParticipantsBody as AddParticipantRequestSchema };
export { postConversationsIdMessagesBody as SendMessageRequestSchema };
export { postMessagesIdReactionsBody as ReactionRequestSchema };
export { postConversationsIdReadBody as UpdateConversationReadRequestSchema };
export { postMessagesIdBookmarksBody as BookmarkRequestSchema };
export { postUsersBody as CreateUserRequestSchema };

// Re-export types from schemas
export type { Participant } from './schemas/ParticipantSchema';
export type { BookmarkListItem } from './schemas/BookmarkListItemSchema';

// Re-export TypeScript types for use in repositories and usecases
export type HealthResponse = zod.infer<typeof getHealthResponse>;
export type Item = zod.infer<typeof getItemsResponseItem>;
export type User = zod.infer<typeof postUsersBody> & { id: string; createdAt: string };
export type ConversationDetail = zod.infer<typeof getConversationsIdResponse>;
export type Message = zod.infer<typeof getConversationsIdMessagesResponseItem>;
export type Reaction = zod.infer<typeof deleteMessagesIdReactionsEmojiResponse>;
export type ConversationRead = zod.infer<typeof postConversationsIdReadResponse>['read'];
// Bookmark type is manually defined since Orval doesn't generate POST /messages/{id}/bookmarks response
export type Bookmark = {
  id: string;
  messageId: string;
  userId: string;
  createdAt: string;
};
export type CreateConversationRequest = zod.infer<typeof postConversationsBody>;
export type AddParticipantRequest = zod.infer<typeof postConversationsIdParticipantsBody>;
export type SendMessageRequest = zod.infer<typeof postConversationsIdMessagesBody>;
export type ReactionRequest = zod.infer<typeof postMessagesIdReactionsBody>;
export type UpdateConversationReadRequest = zod.infer<typeof postConversationsIdReadBody>;
export type BookmarkRequest = zod.infer<typeof postMessagesIdBookmarksBody>;
`

// Append the exports if they don't already exist
if (!content.includes('// Re-export Zod schemas for request validation')) {
  writeFileSync(distPath, content + typeExports)
  console.log('✅ Added type exports to dist/index.ts')
} else {
  console.log('ℹ️  Type exports already present in dist/index.ts')
}
