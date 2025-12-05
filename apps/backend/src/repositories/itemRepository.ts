import type { Item } from '@openapi'

export interface ItemRepository {
  findAll(): Promise<Item[]>
  create(data: { name: string }): Promise<Item>
}
