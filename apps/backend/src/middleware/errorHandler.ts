import type { Context } from 'hono'
import { ZodError } from 'zod'
import type { ErrorResponse, ValidationErrorResponse } from '../types/errors'
import { HttpError } from '../utils/errors'
import { logger } from '../utils/logger'

/**
 * Global error handler for the application
 * Handles HttpError, ZodError, and generic Error instances
 * Returns standardized error responses conforming to OpenAPI specification
 */
export const errorHandler = (err: Error, c: Context) => {
  // Handle HttpError (custom error class with status code)
  if (err instanceof HttpError) {
    const response: ErrorResponse = {
      message: err.message,
    }
    return c.json(response, err.status as any)
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const response: ValidationErrorResponse = {
      message: err.errors[0]?.message || 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    }
    return c.json(response, 400)
  }

  // Log unexpected errors
  logger.error('Unhandled error', err)

  // Return a generic error response for unknown errors
  const response: ErrorResponse = {
    message: err instanceof Error ? err.message : 'Internal Server Error',
    code: 'INTERNAL_ERROR',
  }
  return c.json(response, 500)
}
