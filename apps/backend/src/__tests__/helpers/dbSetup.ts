import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db } from '../../infrastructure/db/client'
import path from 'node:path'

/**
 * Track whether migrations have been applied to the shared in-memory database
 * This prevents duplicate migration attempts when test files run in parallel
 */
let migrationsApplied = false

/**
 * Apply migrations to the test database
 * This should be called in test setup to ensure the database schema is up to date
 * Uses a flag to ensure migrations only run once on the shared in-memory database
 */
export async function applyMigrations() {
  // Skip if migrations have already been applied to this database instance
  if (migrationsApplied) {
    return
  }

  try {
    migrate(db, {
      migrationsFolder: path.join(__dirname, '../../../drizzle'),
    })
    migrationsApplied = true
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

/**
 * Initialize test database with schema
 * Call this in beforeAll or beforeEach in your test files
 */
export async function setupTestDatabase() {
  await applyMigrations()
}
