import type { ItemRepository } from '../repositories/itemRepository'

export class ItemUsecase {
  constructor(private readonly repo: ItemRepository) {}

  async getAllItems() {
    return this.repo.findAll()
  }

  async createItem(name: string) {
    if (name.length < 2) {
      throw new Error('Item name too short')
    }

    return this.repo.create({ name })
  }
}
