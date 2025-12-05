import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import app from '../app'
import { closeDbConnection, db } from '../infrastructure/db/client'

const ensureTestTable = async () => {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "items" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `)
}

beforeAll(async () => {
  await ensureTestTable()
})

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE "items";`)
})

afterAll(async () => {
  await closeDbConnection()
})

describe('GET /items', () => {
  it('returns an empty list when no items exist', async () => {
    const response = await app.request('/items')

    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body).toEqual([])
  })
})

describe('POST /items', () => {
  it('creates an item and returns it from the list', async () => {
    const createResponse = await app.request('/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Item' }),
    })

    expect(createResponse.status).toBe(201)

    const created = await createResponse.json()
    expect(created.name).toBe('Test Item')
    expect(created.id).toBeDefined()

    const listResponse = await app.request('/items')
    const list = await listResponse.json()

    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Test Item')
  })
})
