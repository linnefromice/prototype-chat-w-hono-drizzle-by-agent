import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { errorHandler } from './middleware/errorHandler'
import healthRouter from './routes/health'
import conversationsRouter from './routes/conversations'
import messagesRouter from './routes/messages'
import usersRouter from './routes/users'

const app = new Hono()

// Security headers middleware
// Adds: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, etc.
app.use('*', secureHeaders({
  // Content Security Policy
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  },
  // Strict-Transport-Security (HSTS)
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  // X-Frame-Options
  xFrameOptions: 'DENY',
  // X-Content-Type-Options
  xContentTypeOptions: 'nosniff',
  // Referrer-Policy
  referrerPolicy: 'strict-origin-when-cross-origin',
}))

// CORS middleware with environment-based origins
app.use('*', cors({
  origin: (origin) => {
    // In development, allow localhost and common dev origins
    if (process.env.NODE_ENV !== 'production') {
      const allowedPatterns = [
        /^http:\/\/localhost(:\d+)?$/,
        /^http:\/\/127\.0\.0\.1(:\d+)?$/,
        /^capacitor:\/\/localhost$/,
        /^ionic:\/\/localhost$/,
      ]
      if (allowedPatterns.some(pattern => pattern.test(origin))) {
        return origin
      }
    }

    // In production, allow specific domains
    const allowedOrigins = [
      'https://prototype-hono-drizzle-backend.linnefromice.workers.dev',
      // Add your production frontend domains here
    ]

    if (allowedOrigins.includes(origin)) {
      return origin
    }

    // Reject other origins
    return null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400, // 24 hours
  credentials: true,
}))

// Global error handler
app.onError(errorHandler)

app.route('/health', healthRouter)
app.route('/conversations', conversationsRouter)
app.route('/messages', messagesRouter)
app.route('/users', usersRouter)

export default app
