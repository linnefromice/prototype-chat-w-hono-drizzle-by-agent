import type { Item } from 'openapi'
import { db } from '../infrastructure/db/client'
import { items } from '../infrastructure/db/schema'
import type { ItemRepository } from './itemRepository'

export class DrizzleItemRepository implements ItemRepository {
  constructor(private readonly client = db) {}

  async findAll(): Promise<Item[]> {
    const rows = await this.client.select().from(items).orderBy(items.createdAt)
    return rows.map(row => ({
      ...row,
      createdAt: row.createdAt.toISOString()
    }))
  }

  async create(data: { name: string }): Promise<Item> {
    const [created] = await this.client
      .insert(items)
      .values({ name: data.name })
      .returning()

    return {
      ...created,
      createdAt: created.createdAt.toISOString()
    }
  }
}
