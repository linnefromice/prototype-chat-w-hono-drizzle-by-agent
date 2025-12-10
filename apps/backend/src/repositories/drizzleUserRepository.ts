import { eq } from 'drizzle-orm'
import type { User } from 'openapi'
import { users } from '../infrastructure/db/schema'
import type { UserRepository } from './userRepository'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

type DbClient = DrizzleD1Database<any> | BetterSQLite3Database<any>

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly client?: DbClient) {
    // Client will be injected from context in Workers environment
  }

  async create(data: { name: string; avatarUrl?: string | null }): Promise<User> {
    const [created] = await this.client
      .insert(users)
      .values({
        name: data.name,
        avatarUrl: data.avatarUrl || null,
      })
      .returning()

    // SQLite stores createdAt as ISO 8601 string, no need to convert
    return created
  }

  async findById(id: string): Promise<User | null> {
    const [found] = await this.client.select().from(users).where(eq(users.id, id))

    if (!found) {
      return null
    }

    // SQLite stores createdAt as ISO 8601 string, no need to convert
    return found
  }

  async listAll(): Promise<User[]> {
    const allUsers = await this.client.select().from(users)

    // SQLite stores createdAt as ISO 8601 string, no need to convert
    return allUsers
  }
}
