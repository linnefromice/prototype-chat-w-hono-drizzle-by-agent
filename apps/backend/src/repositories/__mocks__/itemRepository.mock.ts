import { randomUUID } from 'node:crypto'
import type { Item } from 'openapi'
import type { ItemRepository } from '../itemRepository.js'

export class MockItemRepository implements ItemRepository {
  private items: Item[] = []

  async findAll(): Promise<Item[]> {
    return this.items
  }

  async create(data: { name: string }): Promise<Item> {
    const item: Item = { id: randomUUID(), name: data.name, createdAt: new Date().toISOString() }
    this.items.push(item)
    return item
  }
}
