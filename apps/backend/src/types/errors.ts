/**
 * Standardized error response format
 * Matches the OpenAPI specification
 */
export interface ErrorResponse {
  /** Human-readable error message */
  message: string
  /** Optional error code for programmatic handling */
  code?: string
  /** Optional additional error details */
  details?: unknown
}

/**
 * Validation error detail for a single field
 */
export interface ValidationErrorDetail {
  /** Field path that failed validation */
  path: string
  /** Validation error message for this field */
  message: string
}

/**
 * Validation error response with field-level details
 */
export interface ValidationErrorResponse {
  /** Human-readable error message */
  message: string
  /** Error code */
  code?: string
  /** Field-level validation errors */
  details: ValidationErrorDetail[]
}
