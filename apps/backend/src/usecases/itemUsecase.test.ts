import { describe, expect, it } from 'vitest'
import { MockItemRepository } from '../repositories/__mocks__/itemRepository.mock'
import { ItemUsecase } from './itemUsecase'

describe('ItemUsecase', () => {
  it('creates an item successfully', async () => {
    const repo = new MockItemRepository()
    const usecase = new ItemUsecase(repo)

    const item = await usecase.createItem('Book')
    expect(item.name).toBe('Book')

    const list = await usecase.getAllItems()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(item.id)
  })

  it('throws an error when the item name is too short', async () => {
    const repo = new MockItemRepository()
    const usecase = new ItemUsecase(repo)

    await expect(usecase.createItem('A')).rejects.toThrow('Item name too short')
  })
})
