/**
 * Snapshot testing helpers with automatic normalization
 *
 * This module provides wrapper functions around Vitest's snapshot testing
 * that automatically normalize dynamic values (UUIDs, timestamps) before
 * comparison.
 */

import { expect } from 'vitest'
import { normalizeSnapshot } from './snapshotNormalizers'

/**
 * Assert that data matches a snapshot after normalization
 *
 * This function normalizes UUIDs and datetime strings before performing
 * snapshot comparison. Use this for single objects or complete responses.
 *
 * @param data - Response data to snapshot
 * @param snapshotName - Optional name for the snapshot (for clarity in snapshot files)
 *
 * @example
 * const response = await app.request('/users')
 * const user = await response.json()
 * expectMatchesSnapshot(user, 'created user response')
 */
export function expectMatchesSnapshot(data: any, snapshotName?: string): void {
  const normalized = normalizeSnapshot(data)

  if (snapshotName) {
    expect(normalized).toMatchSnapshot(snapshotName)
  } else {
    expect(normalized).toMatchSnapshot()
  }
}

/**
 * Assert that array items match snapshots after normalization
 *
 * This function is optimized for array responses. It normalizes each item
 * and creates a snapshot of the entire array.
 *
 * @param items - Array of items to snapshot
 * @param snapshotName - Optional name for the snapshot
 *
 * @example
 * const response = await app.request('/users')
 * const users = await response.json()
 * expectArrayItemsMatchSnapshot(users, 'users list')
 */
export function expectArrayItemsMatchSnapshot(items: any[], snapshotName?: string): void {
  if (!Array.isArray(items)) {
    throw new Error(`Expected array but got ${typeof items}`)
  }

  const normalized = normalizeSnapshot(items)

  if (snapshotName) {
    expect(normalized).toMatchSnapshot(snapshotName)
  } else {
    expect(normalized).toMatchSnapshot()
  }
}

/**
 * Assert that nested response data matches snapshot
 *
 * Alias for expectMatchesSnapshot with clearer naming for nested structures.
 * Use this when dealing with complex nested objects like conversation responses
 * with participants.
 *
 * @param data - Nested response data to snapshot
 * @param snapshotName - Optional name for the snapshot
 *
 * @example
 * const conversation = await response.json()
 * expectNestedSnapshot(conversation, 'conversation with participants')
 */
export function expectNestedSnapshot(data: any, snapshotName?: string): void {
  expectMatchesSnapshot(data, snapshotName)
}
