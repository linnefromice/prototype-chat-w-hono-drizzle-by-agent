import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { username } from "better-auth/plugins"
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema'

/**
 * Create Better Auth instance with username authentication
 *
 * Features:
 * - Username/password authentication
 * - Session management (7 days expiry)
 * - Future-ready for TOTP, OAuth, email verification
 *
 * @param db - Drizzle database instance
 * @param secret - Secret key for signing tokens (from env.BETTER_AUTH_SECRET or process.env.BETTER_AUTH_SECRET)
 * @returns Better Auth instance
 */
export const createAuth = (db: DrizzleD1Database<typeof schema>, secret?: string) => {
  return betterAuth({
    // Secret key for signing tokens
    secret: secret || process.env.BETTER_AUTH_SECRET,

    // Base URL and path configuration
    baseURL: process.env.NODE_ENV === 'test'
      ? 'http://localhost:3000'  // Test environment
      : (process.env.BASE_URL || 'https://prototype-hono-drizzle-backend.linnefromice.workers.dev'),  // Production
    basePath: '/api/auth',  // Required: tells BetterAuth it's mounted at this path

    // Database configuration
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.authUser,
        session: schema.authSession,
        account: schema.authAccount,
        verification: schema.authVerification,
      }
    }),

    // Email/Password authentication (required for username plugin)
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Will be enabled later
    },

    // Username plugin for username-based authentication
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 20,
      })
    ],

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 7,  // 7 days
      updateAge: 60 * 60 * 24,      // Update session every 24 hours
    },

    // Optionally disable username availability check to prevent enumeration attacks
    // disablePaths: ["/is-username-available"],

    // Future expansion options (commented out for now)
    // socialProviders: {
    //   github: {
    //     clientId: process.env.GITHUB_CLIENT_ID!,
    //     clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    //   },
    //   google: {
    //     clientId: process.env.GOOGLE_CLIENT_ID!,
    //     clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    //   }
    // },

    // Two-factor authentication (to be added later)
    // plugins: [
    //   username(...),
    //   twoFactor({
    //     issuer: "YourAppName",
    //   })
    // ]
  })
}

export type Auth = ReturnType<typeof createAuth>
