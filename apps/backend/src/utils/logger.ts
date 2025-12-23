/**
 * Structured logging utility for JSON-formatted logs
 * Provides consistent log format for production troubleshooting
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  [key: string]: unknown
}

interface BaseLogEntry {
  level: LogLevel
  timestamp: string
  message: string
}

interface ErrorLogEntry extends BaseLogEntry {
  level: 'error'
  error?: {
    name: string
    message: string
    stack?: string
  }
}

interface ActionLogEntry extends BaseLogEntry {
  level: 'info'
  action: string
  userId: string
  [key: string]: unknown
}

type LogEntry = BaseLogEntry | ErrorLogEntry | ActionLogEntry

/**
 * Get current log level from environment
 * Defaults to 'info' in production, 'debug' in development/test
 */
function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase()
  if (envLevel && ['debug', 'info', 'warn', 'error'].includes(envLevel)) {
    return envLevel as LogLevel
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLogLevel = getLogLevel()
const currentLogLevelValue = LOG_LEVELS[currentLogLevel]

/**
 * Check if a log level should be output based on current configuration
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= currentLogLevelValue
}

/**
 * Format and output a log entry
 */
function writeLog(entry: LogEntry): void {
  const output = JSON.stringify(entry)

  // Use appropriate console method based on level
  switch (entry.level) {
    case 'error':
      console.error(output)
      break
    case 'warn':
      console.warn(output)
      break
    case 'debug':
    case 'info':
    default:
      console.log(output)
  }
}

/**
 * Create a log entry with context
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext
): BaseLogEntry {
  return {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...context,
  }
}

/**
 * Structured logger instance
 */
export const logger = {
  /**
   * Log debug information (development/troubleshooting)
   */
  debug(message: string, context?: LogContext): void {
    if (!shouldLog('debug')) return
    writeLog(createLogEntry('debug', message, context))
  },

  /**
   * Log informational messages
   */
  info(message: string, context?: LogContext): void {
    if (!shouldLog('info')) return
    writeLog(createLogEntry('info', message, context))
  },

  /**
   * Log warning messages
   */
  warn(message: string, context?: LogContext): void {
    if (!shouldLog('warn')) return
    writeLog(createLogEntry('warn', message, context))
  },

  /**
   * Log error messages with optional Error object
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    if (!shouldLog('error')) return

    const entry: ErrorLogEntry = {
      level: 'error',
      timestamp: new Date().toISOString(),
      message,
      ...context,
    }

    if (error instanceof Error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } else if (error) {
      entry.error = {
        name: 'Unknown',
        message: String(error),
      }
    }

    writeLog(entry)
  },

  /**
   * Log user actions for audit trail
   */
  action(action: string, userId: string, details?: LogContext): void {
    if (!shouldLog('info')) return
    const entry: ActionLogEntry = {
      level: 'info',
      timestamp: new Date().toISOString(),
      message: action,
      action,
      userId,
      ...details,
    }
    writeLog(entry)
  },
}
