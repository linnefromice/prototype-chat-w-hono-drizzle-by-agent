import type { Item } from 'openapi'
import { db } from '../infrastructure/db/client.js'
import { items } from '../infrastructure/db/schema.js'
import type { ItemRepository } from './itemRepository.js'

export class DrizzleItemRepository implements ItemRepository {
  constructor(private readonly client = db) {}

  async findAll(): Promise<Item[]> {
    return this.client.select().from(items).orderBy(items.createdAt)
  }

  async create(data: { name: string }): Promise<Item> {
    const [created] = await this.client
      .insert(items)
      .values({ name: data.name })
      .returning()

    return created as Item
  }
}
