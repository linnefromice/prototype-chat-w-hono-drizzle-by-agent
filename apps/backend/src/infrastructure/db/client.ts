import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'

// Note: This file is only used in Local/Test environments
// Workers environment uses client.d1.ts instead

// Determine the database file path
// Use in-memory database for tests, file-based for development
const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : 'dev.db'

const sqlite = new Database(dbPath)

// Enable foreign key constraints (important for SQLite)
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

export const closeDbConnection = () => {
  sqlite.close()
}

// Export the raw sqlite instance for direct SQL operations if needed
export { sqlite }
