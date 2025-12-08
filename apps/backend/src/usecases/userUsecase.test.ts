import { describe, expect, it, beforeEach } from 'vitest'
import { MockUserRepository } from '../repositories/__mocks__/userRepository.mock'
import { UserUsecase } from './userUsecase'

describe('UserUsecase', () => {
  let repo: MockUserRepository
  let usecase: UserUsecase

  beforeEach(() => {
    repo = new MockUserRepository()
    usecase = new UserUsecase(repo)
  })

  describe('createUser', () => {
    it('creates a user with name and avatarUrl successfully', async () => {
      const user = await usecase.createUser({
        name: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
      })

      expect(user.name).toBe('John Doe')
      expect(user.avatarUrl).toBe('https://example.com/avatar.jpg')
      expect(user.id).toBeDefined()
      expect(user.createdAt).toBeDefined()

      const allUsers = repo.getAll()
      expect(allUsers).toHaveLength(1)
      expect(allUsers[0].id).toBe(user.id)
    })

    it('creates a user with only name (no avatarUrl)', async () => {
      const user = await usecase.createUser({
        name: 'Jane Smith',
      })

      expect(user.name).toBe('Jane Smith')
      expect(user.avatarUrl).toBeNull()
      expect(user.id).toBeDefined()
    })

    it('trims whitespace from user name', async () => {
      const user = await usecase.createUser({
        name: '  Trimmed Name  ',
      })

      expect(user.name).toBe('Trimmed Name')
    })

    it('throws an error when name is empty string', async () => {
      await expect(
        usecase.createUser({
          name: '',
        })
      ).rejects.toThrow('User name is required')
    })

    it('throws an error when name is only whitespace', async () => {
      await expect(
        usecase.createUser({
          name: '   ',
        })
      ).rejects.toThrow('User name is required')
    })

    it('handles null avatarUrl', async () => {
      const user = await usecase.createUser({
        name: 'User Without Avatar',
        avatarUrl: null,
      })

      expect(user.name).toBe('User Without Avatar')
      expect(user.avatarUrl).toBeNull()
    })
  })

  describe('getUserById', () => {
    it('returns user when found', async () => {
      const created = await usecase.createUser({
        name: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
      })

      const found = await usecase.getUserById(created.id)

      expect(found.id).toBe(created.id)
      expect(found.name).toBe('John Doe')
      expect(found.avatarUrl).toBe('https://example.com/avatar.jpg')
    })

    it('throws 404 error when user not found', async () => {
      await expect(
        usecase.getUserById('non-existent-id')
      ).rejects.toThrow('User not found')
    })
  })

  describe('listAllUsers', () => {
    it('returns empty array when no users exist', async () => {
      const users = await usecase.listAllUsers()

      expect(users).toEqual([])
      expect(users).toHaveLength(0)
    })

    it('returns all users when users exist', async () => {
      const user1 = await usecase.createUser({ name: 'Alice' })
      const user2 = await usecase.createUser({ name: 'Bob' })
      const user3 = await usecase.createUser({ name: 'Carol' })

      const users = await usecase.listAllUsers()

      expect(users).toHaveLength(3)
      expect(users[0].id).toBe(user1.id)
      expect(users[0].name).toBe('Alice')
      expect(users[1].id).toBe(user2.id)
      expect(users[1].name).toBe('Bob')
      expect(users[2].id).toBe(user3.id)
      expect(users[2].name).toBe('Carol')
    })

    it('returns users with all fields populated', async () => {
      await usecase.createUser({
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
      })

      const users = await usecase.listAllUsers()

      expect(users).toHaveLength(1)
      expect(users[0]).toMatchObject({
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
      })
      expect(users[0].id).toBeDefined()
      expect(users[0].createdAt).toBeDefined()
    })
  })
})
