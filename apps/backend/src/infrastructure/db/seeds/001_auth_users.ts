/**
 * Seed script to create auth users and link them to existing chat users
 *
 * This script creates authentication credentials for the initial 20 users
 * and links them to the existing chat users via the authUserId field.
 *
 * All users have the password: "Password"
 *
 * Execution order:
 *   1. This script (001_auth_users.ts) - Creates auth users
 *   2. SQL seed (002_chat_users.sql) - Creates chat users and links to auth users
 *
 * Usage:
 *   npm run db:seed
 *   or
 *   NODE_ENV=development tsx -r tsconfig-paths/register src/infrastructure/db/seeds/001_auth_users.ts
 */

import { db } from '../client'
import { users as chatUsers } from '../schema'
import { eq } from 'drizzle-orm'
import { createAuth } from '../../auth/config'

// User data matching the existing chat users from 001_users.sql
const initialUsers = [
  { chatUserId: '550e8400-e29b-41d4-a716-446655440001', username: 'alice', name: 'Alice' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440002', username: 'bob', name: 'Bob' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440003', username: 'carol', name: 'Carol' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440004', username: 'dave', name: 'Dave' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440005', username: 'eve', name: 'Eve' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440006', username: 'frank', name: 'Frank' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440007', username: 'grace', name: 'Grace' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440008', username: 'heidi', name: 'Heidi' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440009', username: 'ivan', name: 'Ivan' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440010', username: 'judy', name: 'Judy' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440011', username: 'kevin', name: 'Kevin' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440012', username: 'laura', name: 'Laura' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440013', username: 'michael', name: 'Michael' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440014', username: 'nancy', name: 'Nancy' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440015', username: 'oscar', name: 'Oscar' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440016', username: 'peggy', name: 'Peggy' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440017', username: 'quinn', name: 'Quinn' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440018', username: 'rachel', name: 'Rachel' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440019', username: 'steve', name: 'Steve' },
  { chatUserId: '550e8400-e29b-41d4-a716-446655440020', username: 'tina', name: 'Tina' },
]

const PASSWORD = 'Password'

async function seed() {
  console.log('🌱 Starting auth users seed...')
  console.log(`Creating ${initialUsers.length} auth users with password: "${PASSWORD}"`)

  const auth = createAuth(db as any)
  let successCount = 0
  let skipCount = 0

  for (const user of initialUsers) {
    try {
      console.log(`\nProcessing: ${user.username}`)

      // Check if chat user exists
      const chatUser = await db
        .select()
        .from(chatUsers)
        .where(eq(chatUsers.id, user.chatUserId))
        .get()

      if (!chatUser) {
        console.log(`⚠️  Chat user not found: ${user.chatUserId}, skipping...`)
        skipCount++
        continue
      }

      // Check if already linked to auth user
      if (chatUser.authUserId) {
        console.log(`⏭️  Already has auth user linked, skipping...`)
        skipCount++
        continue
      }

      // Create auth user using Better Auth's API
      const result = await auth.api.signUpEmail({
        body: {
          username: user.username,
          email: `${user.username}@example.com`,
          password: PASSWORD,
          name: user.name,
        },
      })

      if (!result || !result.user) {
        console.error(`❌ Failed to create auth user: ${user.username}`)
        continue
      }

      // Link the chat user to the auth user
      await db
        .update(chatUsers)
        .set({ authUserId: result.user.id })
        .where(eq(chatUsers.id, user.chatUserId))

      console.log(`✅ Created and linked: ${user.username} (auth_user.id: ${result.user.id})`)
      successCount++
    } catch (error: any) {
      if (error.message?.includes('Username already exists')) {
        console.log(`⏭️  Username already exists, skipping...`)
        skipCount++
      } else if (error.message?.includes('Email already exists')) {
        console.log(`⏭️  Email already exists, skipping...`)
        skipCount++
      } else {
        console.error(`❌ Error creating user ${user.username}:`, error.message || error)
      }
    }
  }

  console.log('\n✨ Auth users seed completed!')
  console.log(`   ✅ Created: ${successCount}`)
  console.log(`   ⏭️  Skipped: ${skipCount}`)
  console.log(`   📝 Total: ${initialUsers.length}`)
  console.log(`\n🔑 Login credentials:`)
  console.log(`   Username: alice, bob, carol, ... (any of the 20 users)`)
  console.log(`   Password: ${PASSWORD}`)
}

// Run the seed function if this file is executed directly
// In ESM, we check if import.meta.url matches the main module
const isMainModule = import.meta.url === `file://${process.argv[1]}`

if (isMainModule) {
  seed()
    .then(() => {
      console.log('\n✅ Seed script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Seed script failed:', error)
      process.exit(1)
    })
}

export { seed }
