import { describe, it, expect, beforeEach } from 'vitest'
import app from '../index'
import { setupTestDatabase } from '../__tests__/helpers/dbSetup'
import { db } from '../infrastructure/db/client'
import { authUser, authSession, chatUsers } from '../infrastructure/db/schema'

describe('Authentication Endpoints', () => {
  beforeEach(async () => {
    await setupTestDatabase()

    // Clean up auth tables before each test
    await db.delete(authSession)
    await db.delete(chatUsers)
    await db.delete(authUser)
  })

  describe('POST /api/auth/sign-up', () => {
    it('should create a new user with username', async () => {
      const res = await app.request('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'SecurePassword123!',
          name: 'Test User',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.user).toBeDefined()
      expect(data.user.username).toBe('testuser')
      expect(data.user.name).toBe('Test User')
      expect(data.user.email).toBeUndefined() // Email is optional
    })

    it('should create a new user with username and email', async () => {
      const res = await app.request('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser2',
          password: 'SecurePassword123!',
          name: 'Test User 2',
          email: 'test2@example.com',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.user).toBeDefined()
      expect(data.user.username).toBe('testuser2')
      expect(data.user.email).toBe('test2@example.com')
    })

    it('should reject duplicate username', async () => {
      // First registration
      await app.request('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'duplicate',
          password: 'Pass123!',
          name: 'User 1',
        }),
      })

      // Second registration with same username
      const res = await app.request('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'duplicate',
          password: 'Pass456!',
          name: 'User 2',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('should reject invalid username characters', async () => {
      const res = await app.request('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'test user!', // Contains space and special char
          password: 'Pass123!',
          name: 'Test User',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('should reject username that is too short', async () => {
      const res = await app.request('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'ab', // Only 2 characters (min is 3)
          password: 'Pass123!',
          name: 'Test User',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('should reject username that is too long', async () => {
      const res = await app.request('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'a'.repeat(21), // 21 characters (max is 20)
          password: 'Pass123!',
          name: 'Test User',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('should reject weak password', async () => {
      const res = await app.request('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: '123', // Too weak
          name: 'Test User',
        }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/auth/sign-in/username', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await app.request('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'loginuser',
          password: 'MyPassword123!',
          name: 'Login User',
        }),
      })
    })

    it('should login with correct username and password', async () => {
      const res = await app.request('/api/auth/sign-in/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'loginuser',
          password: 'MyPassword123!',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.user).toBeDefined()
      expect(data.user.username).toBe('loginuser')

      // Check that session cookie is set
      const cookies = res.headers.get('Set-Cookie')
      expect(cookies).toBeTruthy()
      expect(cookies).toContain('better-auth.session_token')
    })

    it('should reject incorrect password', async () => {
      const res = await app.request('/api/auth/sign-in/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'loginuser',
          password: 'WrongPassword123!',
        }),
      })

      expect(res.status).toBe(401)
    })

    it('should reject non-existent username', async () => {
      const res = await app.request('/api/auth/sign-in/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'nonexistent',
          password: 'Password123!',
        }),
      })

      expect(res.status).toBe(401)
    })

    it('should be case-sensitive for username', async () => {
      const res = await app.request('/api/auth/sign-in/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'LOGINUSER', // Different case
          password: 'MyPassword123!',
        }),
      })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/auth/session', () => {
    let sessionCookie: string

    beforeEach(async () => {
      // Create and login user
      await app.request('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'sessionuser',
          password: 'Password123!',
          name: 'Session User',
        }),
      })

      const loginRes = await app.request('/api/auth/sign-in/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'sessionuser',
          password: 'Password123!',
        }),
      })

      sessionCookie = loginRes.headers.get('Set-Cookie') || ''
    })

    it('should return session info when logged in', async () => {
      const res = await app.request('/api/auth/session', {
        headers: { Cookie: sessionCookie },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.session).toBeDefined()
      expect(data.user).toBeDefined()
      expect(data.user.username).toBe('sessionuser')
    })

    it('should return null when not logged in', async () => {
      const res = await app.request('/api/auth/session')

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.session).toBeNull()
      expect(data.user).toBeNull()
    })

    it('should return null with invalid session cookie', async () => {
      const res = await app.request('/api/auth/session', {
        headers: { Cookie: 'better-auth.session_token=invalid' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.session).toBeNull()
      expect(data.user).toBeNull()
    })
  })

  describe('POST /api/auth/sign-out', () => {
    let sessionCookie: string

    beforeEach(async () => {
      // Create and login user
      await app.request('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'logoutuser',
          password: 'Password123!',
          name: 'Logout User',
        }),
      })

      const loginRes = await app.request('/api/auth/sign-in/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'logoutuser',
          password: 'Password123!',
        }),
      })

      sessionCookie = loginRes.headers.get('Set-Cookie') || ''
    })

    it('should logout user and invalidate session', async () => {
      // Logout
      const logoutRes = await app.request('/api/auth/sign-out', {
        method: 'POST',
        headers: { Cookie: sessionCookie },
      })

      expect(logoutRes.status).toBe(200)

      // Verify session is invalidated
      const sessionRes = await app.request('/api/auth/session', {
        headers: { Cookie: sessionCookie },
      })

      const data = await sessionRes.json()
      expect(data.session).toBeNull()
      expect(data.user).toBeNull()
    })

    it('should work even when not logged in', async () => {
      const res = await app.request('/api/auth/sign-out', {
        method: 'POST',
      })

      expect(res.status).toBe(200)
    })
  })

  describe('Username validation rules', () => {
    it('should accept valid username with alphanumeric and underscore', async () => {
      const res = await app.request('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'valid_user123',
          password: 'Password123!',
          name: 'Valid User',
        }),
      })

      expect(res.status).toBe(200)
    })

    it('should accept valid username with hyphen', async () => {
      const res = await app.request('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'valid-user',
          password: 'Password123!',
          name: 'Valid User',
        }),
      })

      expect(res.status).toBe(200)
    })

    it('should accept username at minimum length (3 chars)', async () => {
      const res = await app.request('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'abc',
          password: 'Password123!',
          name: 'ABC User',
        }),
      })

      expect(res.status).toBe(200)
    })

    it('should accept username at maximum length (20 chars)', async () => {
      const res = await app.request('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'a'.repeat(20),
          password: 'Password123!',
          name: 'Long User',
        }),
      })

      expect(res.status).toBe(200)
    })
  })
})
