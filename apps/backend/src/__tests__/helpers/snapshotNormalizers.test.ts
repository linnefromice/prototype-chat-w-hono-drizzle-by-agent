import { describe, it, expect } from 'vitest'
import {
  createNormalizerContext,
  normalizeUUIDs,
  normalizeDatetimes,
  normalizeSnapshot,
} from './snapshotNormalizers'

describe('snapshotNormalizers', () => {
  describe('normalizeUUIDs', () => {
    it('normalizes UUID strings', () => {
      const context = createNormalizerContext()
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

      const result = normalizeUUIDs(uuid, context)

      expect(result).toBe('<UUID:1>')
    })

    it('preserves referential integrity - same UUID gets same placeholder', () => {
      const context = createNormalizerContext()
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      const data = {
        id: uuid,
        userId: uuid,
        otherId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      }

      const result = normalizeUUIDs(data, context)

      expect(result).toEqual({
        id: '<UUID:1>',
        userId: '<UUID:1>',
        otherId: '<UUID:2>',
      })
    })

    it('handles nested objects with UUIDs', () => {
      const context = createNormalizerContext()
      const data = {
        user: {
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          name: 'Test User',
        },
        conversationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      }

      const result = normalizeUUIDs(data, context)

      expect(result).toEqual({
        user: {
          id: '<UUID:1>',
          name: 'Test User',
        },
        conversationId: '<UUID:2>',
      })
    })

    it('handles arrays of objects with UUIDs', () => {
      const context = createNormalizerContext()
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      const data = [
        { id: uuid, name: 'User 1' },
        { id: uuid, name: 'User 2' },
        { id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', name: 'User 3' },
      ]

      const result = normalizeUUIDs(data, context)

      expect(result).toEqual([
        { id: '<UUID:1>', name: 'User 1' },
        { id: '<UUID:1>', name: 'User 2' },
        { id: '<UUID:2>', name: 'User 3' },
      ])
    })

    it('preserves non-UUID strings', () => {
      const context = createNormalizerContext()
      const data = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'Test User',
        status: 'active',
      }

      const result = normalizeUUIDs(data, context)

      expect(result).toEqual({
        id: '<UUID:1>',
        name: 'Test User',
        status: 'active',
      })
    })

    it('handles null and undefined values', () => {
      const context = createNormalizerContext()

      expect(normalizeUUIDs(null, context)).toBeNull()
      expect(normalizeUUIDs(undefined, context)).toBeUndefined()
      expect(normalizeUUIDs({ id: null }, context)).toEqual({ id: null })
    })

    it('handles case-insensitive UUIDs', () => {
      const context = createNormalizerContext()
      const lowerUUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      const upperUUID = 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890'

      expect(normalizeUUIDs(lowerUUID, context)).toBe('<UUID:1>')
      expect(normalizeUUIDs(upperUUID, context)).toBe('<UUID:2>')
    })
  })

  describe('normalizeDatetimes', () => {
    it('normalizes ISO 8601 datetime strings', () => {
      const context = createNormalizerContext()
      const datetime = '2025-12-09T12:34:56.789Z'

      const result = normalizeDatetimes(datetime, context)

      expect(result).toBe('<DATETIME:1>')
    })

    it('normalizes datetime strings without milliseconds', () => {
      const context = createNormalizerContext()
      const datetime = '2025-12-09T12:34:56Z'

      const result = normalizeDatetimes(datetime, context)

      expect(result).toBe('<DATETIME:1>')
    })

    it('normalizes datetime strings without Z suffix', () => {
      const context = createNormalizerContext()
      const datetime = '2025-12-09T12:34:56.789'

      const result = normalizeDatetimes(datetime, context)

      expect(result).toBe('<DATETIME:1>')
    })

    it('preserves referential integrity - same datetime gets same placeholder', () => {
      const context = createNormalizerContext()
      const datetime = '2025-12-09T12:34:56.789Z'
      const data = {
        createdAt: datetime,
        updatedAt: datetime,
        publishedAt: '2025-12-09T13:00:00.000Z',
      }

      const result = normalizeDatetimes(data, context)

      expect(result).toEqual({
        createdAt: '<DATETIME:1>',
        updatedAt: '<DATETIME:1>',
        publishedAt: '<DATETIME:2>',
      })
    })

    it('handles nested objects with datetimes', () => {
      const context = createNormalizerContext()
      const data = {
        user: {
          name: 'Test User',
          createdAt: '2025-12-09T12:34:56.789Z',
        },
        message: {
          text: 'Hello',
          sentAt: '2025-12-09T13:00:00.000Z',
        },
      }

      const result = normalizeDatetimes(data, context)

      expect(result).toEqual({
        user: {
          name: 'Test User',
          createdAt: '<DATETIME:1>',
        },
        message: {
          text: 'Hello',
          sentAt: '<DATETIME:2>',
        },
      })
    })

    it('handles arrays of objects with datetimes', () => {
      const context = createNormalizerContext()
      const datetime = '2025-12-09T12:34:56.789Z'
      const data = [
        { id: 1, createdAt: datetime },
        { id: 2, createdAt: datetime },
        { id: 3, createdAt: '2025-12-09T13:00:00.000Z' },
      ]

      const result = normalizeDatetimes(data, context)

      expect(result).toEqual([
        { id: 1, createdAt: '<DATETIME:1>' },
        { id: 2, createdAt: '<DATETIME:1>' },
        { id: 3, createdAt: '<DATETIME:2>' },
      ])
    })

    it('preserves non-datetime strings', () => {
      const context = createNormalizerContext()
      const data = {
        createdAt: '2025-12-09T12:34:56.789Z',
        name: 'Test User',
        status: 'active',
        date: '2025-12-09', // Not a datetime format
      }

      const result = normalizeDatetimes(data, context)

      expect(result).toEqual({
        createdAt: '<DATETIME:1>',
        name: 'Test User',
        status: 'active',
        date: '2025-12-09',
      })
    })

    it('handles null and undefined values', () => {
      const context = createNormalizerContext()

      expect(normalizeDatetimes(null, context)).toBeNull()
      expect(normalizeDatetimes(undefined, context)).toBeUndefined()
      expect(normalizeDatetimes({ createdAt: null }, context)).toEqual({ createdAt: null })
    })
  })

  describe('normalizeSnapshot', () => {
    it('normalizes both UUIDs and datetimes', () => {
      const data = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'Test User',
        createdAt: '2025-12-09T12:34:56.789Z',
        updatedAt: '2025-12-09T13:00:00.000Z',
      }

      const result = normalizeSnapshot(data)

      expect(result).toEqual({
        id: '<UUID:1>',
        name: 'Test User',
        createdAt: '<DATETIME:1>',
        updatedAt: '<DATETIME:2>',
      })
    })

    it('preserves referential integrity across both UUIDs and datetimes', () => {
      const userId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      const timestamp = '2025-12-09T12:34:56.789Z'
      const data = {
        conversation: {
          id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          createdAt: timestamp,
        },
        participants: [
          { userId: userId, joinedAt: timestamp },
          { userId: userId, joinedAt: '2025-12-09T13:00:00.000Z' },
        ],
      }

      const result = normalizeSnapshot(data)

      expect(result).toEqual({
        conversation: {
          id: '<UUID:1>',
          createdAt: '<DATETIME:1>',
        },
        participants: [
          { userId: '<UUID:2>', joinedAt: '<DATETIME:1>' },
          { userId: '<UUID:2>', joinedAt: '<DATETIME:2>' },
        ],
      })
    })

    it('handles complex nested structures', () => {
      const data = {
        conversation: {
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          name: 'Test Group',
          type: 'group',
          createdAt: '2025-12-09T12:34:56.789Z',
          participants: [
            {
              id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
              user: {
                id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                name: 'User 1',
                avatarUrl: null,
                createdAt: '2025-12-08T10:00:00.000Z',
              },
              joinedAt: '2025-12-09T12:34:56.789Z',
            },
            {
              id: 'd4e5f6a7-b8c9-0123-def1-234567890123',
              user: {
                id: 'e5f6a7b8-c9d0-1234-ef12-345678901234',
                name: 'User 2',
                avatarUrl: 'https://example.com/avatar.jpg',
                createdAt: '2025-12-08T11:00:00.000Z',
              },
              joinedAt: '2025-12-09T13:00:00.000Z',
            },
          ],
        },
      }

      const result = normalizeSnapshot(data)

      expect(result).toEqual({
        conversation: {
          id: '<UUID:1>',
          name: 'Test Group',
          type: 'group',
          createdAt: '<DATETIME:1>',
          participants: [
            {
              id: '<UUID:2>',
              user: {
                id: '<UUID:3>',
                name: 'User 1',
                avatarUrl: null,
                createdAt: '<DATETIME:2>',
              },
              joinedAt: '<DATETIME:1>',
            },
            {
              id: '<UUID:4>',
              user: {
                id: '<UUID:5>',
                name: 'User 2',
                avatarUrl: 'https://example.com/avatar.jpg',
                createdAt: '<DATETIME:3>',
              },
              joinedAt: '<DATETIME:4>',
            },
          ],
        },
      })
    })

    it('handles arrays at the top level', () => {
      const data = [
        {
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          createdAt: '2025-12-09T12:34:56.789Z',
        },
        {
          id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          createdAt: '2025-12-09T13:00:00.000Z',
        },
      ]

      const result = normalizeSnapshot(data)

      expect(result).toEqual([
        {
          id: '<UUID:1>',
          createdAt: '<DATETIME:1>',
        },
        {
          id: '<UUID:2>',
          createdAt: '<DATETIME:2>',
        },
      ])
    })

    it('preserves other data types', () => {
      const data = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'Test',
        count: 42,
        active: true,
        tags: ['tag1', 'tag2'],
        metadata: null,
        createdAt: '2025-12-09T12:34:56.789Z',
      }

      const result = normalizeSnapshot(data)

      expect(result).toEqual({
        id: '<UUID:1>',
        name: 'Test',
        count: 42,
        active: true,
        tags: ['tag1', 'tag2'],
        metadata: null,
        createdAt: '<DATETIME:1>',
      })
    })
  })
})
