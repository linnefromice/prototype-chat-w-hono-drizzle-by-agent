import { createMiddleware } from 'hono/factory'
import { createD1Client } from '../infrastructure/db/client.d1'
import { createAuth } from '../infrastructure/auth'
import type { Env } from '../infrastructure/db/client.d1'
import type { AuthVariables } from '../infrastructure/auth'

/**
 * Authentication middleware
 * Requires a valid session to proceed
 * Sets authUser and authSession in context for use in route handlers
 *
 * Usage:
 * ```typescript
 * app.get('/protected', requireAuth, (c) => {
 *   const user = c.get('authUser')
 *   return c.json({ user })
 * })
 * ```
 */
export const requireAuth = createMiddleware<{
  Bindings: Env
  Variables: AuthVariables
}>(async (c, next) => {
  // In test/development mode, use the local BetterSQLite3 database
  // In production, use Cloudflare D1
  // Both database types work with createAuth thanks to generics
  const db = (process.env.NODE_ENV === 'test' || !c.env?.DB)
    ? (await import('../infrastructure/db/client')).db
    : createD1Client(c.env.DB)

  const secret = c.env?.BETTER_AUTH_SECRET
  const baseUrl = c.env?.BASE_URL
  const auth = createAuth(db, secret, baseUrl)

  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })

  if (!session || !session.user) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Valid authentication is required to access this resource'
      },
      401
    )
  }

  c.set('authUser', session.user)
  c.set('authSession', session.session)

  await next()
})

/**
 * Optional authentication middleware
 * Does not block unauthenticated requests
 * Sets authUser and authSession in context if session exists, otherwise null
 *
 * Usage:
 * ```typescript
 * app.get('/optional', optionalAuth, (c) => {
 *   const user = c.get('authUser')
 *   if (user) {
 *     return c.json({ message: `Hello ${user.username}` })
 *   }
 *   return c.json({ message: 'Hello guest' })
 * })
 * ```
 */
export const optionalAuth = createMiddleware<{
  Bindings: Env
  Variables: AuthVariables
}>(async (c, next) => {
  // In test/development mode, use the local BetterSQLite3 database
  // In production, use Cloudflare D1
  // Both database types work with createAuth thanks to generics
  const db = (process.env.NODE_ENV === 'test' || !c.env?.DB)
    ? (await import('../infrastructure/db/client')).db
    : createD1Client(c.env.DB)

  const secret = c.env?.BETTER_AUTH_SECRET
  const baseUrl = c.env?.BASE_URL
  const auth = createAuth(db, secret, baseUrl)

  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })

  if (session && session.user) {
    c.set('authUser', session.user)
    c.set('authSession', session.session)
  } else {
    c.set('authUser', null)
    c.set('authSession', null)
  }

  await next()
})
