import { db } from '../client'
import { users } from '../schema'
import { loadEnvConfig } from '../../../utils/env'

// Alice and Bob characters from cryptography and security protocols
// Reference: https://en.wikipedia.org/wiki/Alice_and_Bob
// Avatar images from PokeAPI sprites
const seedUsers = [
  {
    name: 'Alice',
    avatarUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png',
  },
  {
    name: 'Bob',
    avatarUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png',
  },
  {
    name: 'Carol',
    avatarUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png',
  },
  {
    name: 'Dave',
    avatarUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png',
  },
  {
    name: 'Eve',
    avatarUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/39.png',
  },
  {
    name: 'Frank',
    avatarUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/52.png',
  },
  {
    name: 'Grace',
    avatarUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png',
  },
  {
    name: 'Heidi',
    avatarUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/143.png',
  },
  {
    name: 'Ivan',
    avatarUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/150.png',
  },
  {
    name: 'Judy',
    avatarUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/151.png',
  },
]

export async function seedDevelopmentUsers() {
  const env = loadEnvConfig()

  // Only run in development mode
  if (env.NODE_ENV !== 'development') {
    console.log('⏭️  Skipping user seeding (not in development mode)')
    return
  }

  try {
    // Check if users already exist
    const existingUsers = await db.select().from(users)
    if (existingUsers.length > 0) {
      console.log('ℹ️  Users already exist, skipping seed')
      return
    }

    // Insert seed users
    const inserted = await db.insert(users).values(seedUsers).returning()

    console.log(`✅ Seeded ${inserted.length} development users:`)
    inserted.forEach(user => {
      console.log(`   - ${user.name} (${user.id})`)
    })
  } catch (error) {
    console.error('❌ Failed to seed users:', error)
    throw error
  }
}
