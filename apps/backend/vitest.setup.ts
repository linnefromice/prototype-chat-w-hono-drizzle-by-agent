// Set NODE_ENV for all tests before any modules are loaded
process.env.NODE_ENV = 'test'

// Note: Database setup is handled in individual test files using setupTestDatabase()
// from src/__tests__/helpers/dbSetup.ts because each test uses an in-memory database
