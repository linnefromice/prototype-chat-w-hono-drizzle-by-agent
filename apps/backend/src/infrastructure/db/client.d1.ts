import { drizzle } from 'drizzle-orm/d1'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from './schema'

// Type for Cloudflare D1 database binding
export type Env = {
  DB: D1Database
  ENVIRONMENT?: 'development' | 'staging' | 'production'
  BETTER_AUTH_SECRET?: string
  BASE_URL?: string
}

/**
 * Creates a Drizzle client for Cloudflare D1
 * This is used in production when running on Cloudflare Workers
 */
export function createD1Client(d1Database: D1Database): DrizzleD1Database<typeof schema> {
  return drizzle(d1Database, { schema })
}

/**
 * No-op function for D1 since connections are managed by Workers runtime
 */
export const closeDbConnection = () => {
  // D1 connections are automatically managed by Cloudflare Workers
}
