/**
 * Example protected routes using Better Auth
 * This demonstrates how to use the authentication middleware
 */

import { Hono } from 'hono'
import type { Env } from '../infrastructure/db/client.d1'
import type { AuthVariables } from '../infrastructure/auth'
import { requireAuth, optionalAuth } from '../middleware/requireAuth'
import { createD1Client } from '../infrastructure/db/client.d1'
import { chatUsers } from '../infrastructure/db/schema'
import { eq } from 'drizzle-orm'

const router = new Hono<{
  Bindings: Env
  Variables: AuthVariables
}>()

/**
 * GET /me
 * Get current authenticated user's auth information
 * Requires authentication
 */
router.get('/me', requireAuth, (c) => {
  const authUser = c.get('authUser')
  const authSession = c.get('authSession')

  return c.json({
    user: {
      id: authUser!.id,
      username: authUser!.username,
      name: authUser!.name,
      email: authUser!.email,
      emailVerified: authUser!.emailVerified,
    },
    session: {
      id: authSession!.id,
      expiresAt: authSession!.expiresAt,
    },
  })
})

/**
 * GET /profile
 * Get current user's complete profile including chat information
 * Requires authentication
 */
router.get('/profile', requireAuth, async (c) => {
  const authUser = c.get('authUser')
  const db = createD1Client(c.env.DB)

  // Get chat profile linked to auth user
  const chatProfile = await db
    .select()
    .from(chatUsers)
    .where(eq(chatUsers.authUserId, authUser!.id))
    .get()

  return c.json({
    auth: {
      id: authUser!.id,
      username: authUser!.username,
      name: authUser!.name,
      email: authUser!.email,
    },
    chat: chatProfile
      ? {
          id: chatProfile.id,
          idAlias: chatProfile.idAlias,
          name: chatProfile.name,
          avatarUrl: chatProfile.avatarUrl,
        }
      : null,
  })
})

/**
 * GET /public
 * Example of a route that works for both authenticated and guest users
 * Uses optional authentication
 */
router.get('/public', optionalAuth, (c) => {
  const authUser = c.get('authUser')

  if (authUser) {
    return c.json({
      message: `Hello, ${authUser.username}!`,
      authenticated: true,
    })
  }

  return c.json({
    message: 'Hello, guest!',
    authenticated: false,
  })
})

/**
 * PUT /profile/name
 * Update user's name in chat profile
 * Requires authentication
 */
router.put('/profile/name', requireAuth, async (c) => {
  const authUser = c.get('authUser')
  const db = createD1Client(c.env.DB)

  const body = await c.req.json()
  const { name } = body

  if (!name || typeof name !== 'string') {
    return c.json({ error: 'Name is required' }, 400)
  }

  // Update chat user name
  const [updated] = await db
    .update(chatUsers)
    .set({ name })
    .where(eq(chatUsers.authUserId, authUser!.id))
    .returning()

  return c.json({
    success: true,
    chatUser: updated,
  })
})

export default router
