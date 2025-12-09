import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import app from '../app'
import { expectValidZodSchema, expectValidZodSchemaArray } from '../__tests__/helpers/zodValidation'
import { expectMatchesSnapshot } from '../__tests__/helpers/snapshotHelpers'
import { getUsersResponseItem, getUsersUserIdResponse } from 'openapi'
import { db, closeDbConnection, sqlite } from '../infrastructure/db/client'

describe('Users API', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'development'
  })

  beforeEach(() => {
    // Clean up database between tests (foreign key order matters)
    sqlite.exec('DELETE FROM message_bookmarks')
    sqlite.exec('DELETE FROM reactions')
    sqlite.exec('DELETE FROM conversation_reads')
    sqlite.exec('DELETE FROM messages')
    sqlite.exec('DELETE FROM participants')
    sqlite.exec('DELETE FROM conversations')
    sqlite.exec('DELETE FROM users')
  })

  afterAll(async () => {
    await closeDbConnection()
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

      // Zod schema validation for all users in the array
      expectValidZodSchemaArray(getUsersResponseItem, users, 'users')
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

      // Zod schema validation
      expectValidZodSchema(getUsersUserIdResponse, user, 'user')

      // Snapshot testing - captures complete response structure
      expectMatchesSnapshot(user, 'POST /users - with name and avatarUrl')

      // Business logic assertions
      expect(user.name).toBe('Test User')
      expect(user.avatarUrl).toBe('https://example.com/avatar.jpg')
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

      // Zod schema validation
      expectValidZodSchema(getUsersUserIdResponse, user, 'user')

      // Snapshot testing - captures complete response structure
      expectMatchesSnapshot(user, 'POST /users - with only name')

      // Business logic assertions
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

      // Zod schema validation
      expectValidZodSchema(getUsersUserIdResponse, user, 'user')

      // Snapshot testing - captures complete response structure
      expectMatchesSnapshot(user, 'GET /users/:id - found user')

      // Business logic assertions
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
