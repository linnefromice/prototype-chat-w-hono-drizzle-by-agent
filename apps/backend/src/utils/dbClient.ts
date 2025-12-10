import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

export type DbClient = DrizzleD1Database<any> | BetterSQLite3Database<any>

/**
 * Get DB client from context (Workers) or import default (Local environment)
 *
 * In Workers environment, DB is available from c.env.DB
 * In Local environment, we import the default db instance
 */
export async function getDbClient(c: any): Promise<DbClient> {
  // In Workers environment, DB is available from context bindings
  if (c.env?.DB) {
    const { createD1Client } = await import('../infrastructure/db/client.d1')
    return createD1Client(c.env.DB)
  }
  // In Local environment, use default db import
  const { db } = await import('../infrastructure/db/client')
  return db
}
