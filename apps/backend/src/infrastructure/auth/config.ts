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
 * @param baseUrl - Optional base URL override (from Hono context env.BASE_URL)
 * @returns Better Auth instance
 */
export const createAuth = (db: DrizzleD1Database<typeof schema>, secret?: string, baseUrl?: string) => {
  const baseURL = process.env.NODE_ENV === 'test'
    ? 'http://localhost:3000'  // Test environment
    : (baseUrl || process.env.BETTER_AUTH_URL || process.env.BASE_URL || 'https://prototype-hono-drizzle-backend.linnefromice.workers.dev')  // Production

  // Determine if we're in a secure context (HTTPS)
  const isSecureContext = baseURL.startsWith('https://')

  // Debug log (can be removed later)
  console.log('[Better Auth Config]', {
    baseURL,
    isSecureContext,
    useSecureCookies: isSecureContext,
    env: {
      baseUrlParam: baseUrl,
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
      BASE_URL: process.env.BASE_URL,
      NODE_ENV: process.env.NODE_ENV,
    }
  })

  return betterAuth({
    // Secret key for signing tokens
    secret: secret || process.env.BETTER_AUTH_SECRET,

    // Base URL and path configuration
    baseURL,
    basePath: '/api/auth',  // Required: tells BetterAuth it's mounted at this path

    // Trusted origins for CORS (prevents CSRF and open redirects)
    // In development, allow localhost and iOS simulator requests
    // In production, restrict to specific domains
    trustedOrigins: process.env.NODE_ENV === 'production'
      ? [
          'https://prototype-hono-drizzle-backend.linnefromice.workers.dev',
          // Add your production frontend domains here
        ]
      : [
          'http://localhost:*',      // Local development (all ports)
          'http://127.0.0.1:*',      // Local development via IP
          'capacitor://localhost',   // iOS app (Capacitor)
          'ionic://localhost',       // iOS app (Ionic)
          'http://localhost',        // iOS simulator
        ],

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

    // Advanced configuration for cookie security
    advanced: {
      // Only use Secure attribute for HTTPS connections
      // This allows HTTP connections in local development
      useSecureCookies: isSecureContext,
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
