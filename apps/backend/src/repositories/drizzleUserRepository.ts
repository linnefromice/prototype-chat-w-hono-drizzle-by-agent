import { eq } from 'drizzle-orm'
import type { User } from 'openapi'
import { db } from '../infrastructure/db/client'
import { users } from '../infrastructure/db/schema'
import type { UserRepository } from './userRepository'

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly client = db) {}

  async create(data: { name: string; avatarUrl?: string | null }): Promise<User> {
    const [created] = await this.client
      .insert(users)
      .values({
        name: data.name,
        avatarUrl: data.avatarUrl || null,
      })
      .returning()

    return {
      ...created,
      createdAt: created.createdAt.toISOString(),
    }
  }

  async findById(id: string): Promise<User | null> {
    const [found] = await this.client.select().from(users).where(eq(users.id, id))

    if (!found) {
      return null
    }

    return {
      ...found,
      createdAt: found.createdAt.toISOString(),
    }
  }
}
