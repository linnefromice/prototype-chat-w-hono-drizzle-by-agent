/**
 * Snapshot normalization utilities for consistent test snapshots
 *
 * This module provides functions to normalize dynamic values (UUIDs, timestamps)
 * in API responses before snapshot comparison. This ensures that snapshots remain
 * stable across test runs while preserving referential integrity.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/

/**
 * Context object for tracking normalized values across a single test
 */
export interface NormalizerContext {
  uuidMap: Map<string, string>
  datetimeMap: Map<string, string>
}

/**
 * Create a new normalizer context
 */
export function createNormalizerContext(): NormalizerContext {
  return {
    uuidMap: new Map(),
    datetimeMap: new Map(),
  }
}

/**
 * Normalize UUIDs in data structure
 * Same UUID values get the same placeholder number (preserves referential integrity)
 *
 * @param data - Any data structure (object, array, primitive)
 * @param context - Normalizer context for tracking mappings
 * @returns Normalized data with UUIDs replaced by <UUID:N> placeholders
 *
 * @example
 * normalizeUUIDs({ id: "a1b2c3d4-...", userId: "a1b2c3d4-..." }, context)
 * // => { id: "<UUID:1>", userId: "<UUID:1>" }
 */
export function normalizeUUIDs(data: any, context: NormalizerContext): any {
  if (data === null || data === undefined) {
    return data
  }

  // Handle string UUIDs
  if (typeof data === 'string' && UUID_REGEX.test(data)) {
    if (!context.uuidMap.has(data)) {
      const index = context.uuidMap.size + 1
      context.uuidMap.set(data, `<UUID:${index}>`)
    }
    return context.uuidMap.get(data)
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => normalizeUUIDs(item, context))
  }

  // Handle objects
  if (typeof data === 'object') {
    const normalized: any = {}
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        normalized[key] = normalizeUUIDs(data[key], context)
      }
    }
    return normalized
  }

  return data
}

/**
 * Normalize datetime strings in data structure
 * Same datetime values get the same placeholder number
 *
 * @param data - Any data structure (object, array, primitive)
 * @param context - Normalizer context for tracking mappings
 * @returns Normalized data with datetimes replaced by <DATETIME:N> placeholders
 *
 * @example
 * normalizeDatetimes({ createdAt: "2025-12-09T12:34:56.789Z" }, context)
 * // => { createdAt: "<DATETIME:1>" }
 */
export function normalizeDatetimes(data: any, context: NormalizerContext): any {
  if (data === null || data === undefined) {
    return data
  }

  // Handle datetime strings
  if (typeof data === 'string' && DATETIME_REGEX.test(data)) {
    if (!context.datetimeMap.has(data)) {
      const index = context.datetimeMap.size + 1
      context.datetimeMap.set(data, `<DATETIME:${index}>`)
    }
    return context.datetimeMap.get(data)
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => normalizeDatetimes(item, context))
  }

  // Handle objects
  if (typeof data === 'object') {
    const normalized: any = {}
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        normalized[key] = normalizeDatetimes(data[key], context)
      }
    }
    return normalized
  }

  return data
}

/**
 * Normalize all dynamic values (UUIDs and datetimes) in data structure
 *
 * @param data - Any data structure to normalize
 * @returns Normalized data with all dynamic values replaced
 *
 * @example
 * normalizeSnapshot({
 *   id: "a1b2c3d4-...",
 *   createdAt: "2025-12-09T12:34:56.789Z",
 *   user: { id: "a1b2c3d4-..." }
 * })
 * // => {
 * //   id: "<UUID:1>",
 * //   createdAt: "<DATETIME:1>",
 * //   user: { id: "<UUID:1>" }
 * // }
 */
export function normalizeSnapshot(data: any): any {
  const context = createNormalizerContext()
  let normalized = normalizeUUIDs(data, context)
  normalized = normalizeDatetimes(normalized, context)
  return normalized
}
