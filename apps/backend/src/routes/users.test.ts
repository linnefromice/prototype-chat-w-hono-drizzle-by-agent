import { describe, expect, it, beforeAll } from 'vitest'
import app from '../app'

describe('Users API', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'development'
  })

  describe('GET /users', () => {
    it('returns list of users in development mode', async () => {
      // Create a user first to ensure there's at least one user
      await app.request('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User for List',
          avatarUrl: 'https://example.com/test.jpg',
        }),
      })

      const response = await app.request('/users')

      expect(response.status).toBe(200)

      const users = await response.json()
      expect(Array.isArray(users)).toBe(true)
      expect(users.length).toBeGreaterThan(0)

      // Verify user structure
      const user = users[0]
      expect(user).toHaveProperty('id')
      expect(user).toHaveProperty('name')
      expect(user).toHaveProperty('createdAt')
      expect(typeof user.id).toBe('string')
      expect(typeof user.name).toBe('string')
      expect(typeof user.createdAt).toBe('string')
    })

    it('returns 403 in production mode', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const response = await app.request('/users')

      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toEqual({
        message: 'This endpoint is only available in development mode',
      })

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('POST /users', () => {
    it('creates a user with name and avatarUrl in development mode', async () => {
      const response = await app.request('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
        }),
      })

      expect(response.status).toBe(201)

      const user = await response.json()
      expect(user).toHaveProperty('id')
      expect(user.name).toBe('Test User')
      expect(user.avatarUrl).toBe('https://example.com/avatar.jpg')
      expect(user).toHaveProperty('createdAt')
    })

    it('creates a user with only name', async () => {
      const response = await app.request('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User 2',
        }),
      })

      expect(response.status).toBe(201)

      const user = await response.json()
      expect(user.name).toBe('Test User 2')
      expect(user.avatarUrl).toBeNull()
    })

    it('returns 400 for empty name', async () => {
      const response = await app.request('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
        }),
      })

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json).toHaveProperty('message')
      expect(json.message).toContain('character')
    })

    it('returns 403 in production mode', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const response = await app.request('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
        }),
      })

      expect(response.status).toBe(403)

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('GET /users/:id', () => {
    it('returns user by id', async () => {
      // First create a user
      const createResponse = await app.request('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Findable User',
          avatarUrl: 'https://example.com/findable.jpg',
        }),
      })

      const createdUser = await createResponse.json()

      // Then find it
      const response = await app.request(`/users/${createdUser.id}`)

      expect(response.status).toBe(200)

      const user = await response.json()
      expect(user.id).toBe(createdUser.id)
      expect(user.name).toBe('Findable User')
      expect(user.avatarUrl).toBe('https://example.com/findable.jpg')
    })

    it('returns 404 for non-existent user', async () => {
      const response = await app.request('/users/00000000-0000-0000-0000-000000000000')

      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toMatchObject({
        message: 'User not found',
      })
    })
  })
})
