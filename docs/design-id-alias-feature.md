# User ID Alias Feature Design

## Overview

This document describes the design for adding an `idAlias` field to the User model. The `idAlias` is a unique, human-readable identifier that can be used for login and public display while maintaining the internal UUID-based `id` for system operations.

## Requirements

- Add `idAlias` column to the `users` table (String type)
- Ensure uniqueness at the database and repository layers
- Support login via `idAlias`
- Update OpenAPI specification
- Maintain backward compatibility with existing UUID-based operations

## Database Schema Changes

### Table: `users`

Add a new column to the existing `users` table:

```typescript
// apps/backend/src/infrastructure/db/schema.ts

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  idAlias: text('id_alias').notNull().unique(), // NEW COLUMN
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})
```

**Column Specifications:**
- **Name**: `id_alias` (snake_case for database column)
- **Type**: `text`
- **Constraints**:
  - `NOT NULL`: Must be provided on user creation
  - `UNIQUE`: Enforced at database level via unique constraint
- **Format**: Pattern `^[a-z0-9][a-z0-9._-]*[a-z0-9]$` (3-30 characters)
  - **Allowed characters (whitelist)**:
    - Lowercase letters: `a-z`
    - Numbers: `0-9`
    - Symbols: `.` (dot), `_` (underscore), `-` (hyphen)
  - **Restrictions**:
    - No spaces allowed
    - No uppercase letters (consistency and case-sensitivity issues)
    - Must start and end with alphanumeric character (not a symbol)
    - Symbols can only appear in the middle of the ID
  - **Length**: 3-30 characters

### Migration Strategy

Since this is a SQLite-based system and migrations are not currently tracked in the repository, the schema change will be applied by:

1. Updating the schema definition in `apps/backend/src/infrastructure/db/schema.ts`
2. Recreating the database (acceptable for development/prototype environments)
3. Updating seed data to include `idAlias` values

For production-ready implementation, consider adding:
- Drizzle Kit migrations
- ALTER TABLE migration script with default value strategy for existing records

## Repository Layer Changes

### Interface Update

**File**: `apps/backend/src/repositories/userRepository.ts`

```typescript
import type { User } from 'openapi'

export interface UserRepository {
  create(data: {
    idAlias: string  // NEW REQUIRED FIELD
    name: string
    avatarUrl?: string | null
  }): Promise<User>

  findById(id: string): Promise<User | null>
  findByIdAlias(idAlias: string): Promise<User | null>  // NEW METHOD

  listAll(): Promise<User[]>

  // Validation methods
  isIdAliasAvailable(idAlias: string): Promise<boolean>  // NEW METHOD
}
```

### Implementation Update

**File**: `apps/backend/src/repositories/drizzleUserRepository.ts`

```typescript
import { eq } from 'drizzle-orm'
import type { User } from 'openapi'
import { users } from '../infrastructure/db/schema'
import type { UserRepository } from './userRepository'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

type DbClient = DrizzleD1Database<any> | BetterSQLite3Database<any>

export class DrizzleUserRepository implements UserRepository {
  private readonly client: DbClient

  constructor(client?: DbClient) {
    if (!client) {
      throw new Error('Database client is required')
    }
    this.client = client
  }

  async create(data: {
    idAlias: string
    name: string
    avatarUrl?: string | null
  }): Promise<User> {
    // Validate idAlias availability before insertion
    const available = await this.isIdAliasAvailable(data.idAlias)
    if (!available) {
      throw new Error(`ID Alias "${data.idAlias}" is already in use`)
    }

    const [created] = await this.client
      .insert(users)
      .values({
        idAlias: data.idAlias,
        name: data.name,
        avatarUrl: data.avatarUrl || null,
      })
      .returning()

    return created
  }

  async findById(id: string): Promise<User | null> {
    const [found] = await this.client
      .select()
      .from(users)
      .where(eq(users.id, id))

    return found || null
  }

  async findByIdAlias(idAlias: string): Promise<User | null> {
    const [found] = await this.client
      .select()
      .from(users)
      .where(eq(users.idAlias, idAlias))

    return found || null
  }

  async listAll(): Promise<User[]> {
    const allUsers = await this.client.select().from(users)
    return allUsers
  }

  async isIdAliasAvailable(idAlias: string): Promise<boolean> {
    const existing = await this.findByIdAlias(idAlias)
    return existing === null
  }
}
```

**Key Implementation Details:**

1. **Pre-insert Validation**: The `create` method validates `idAlias` uniqueness before attempting insertion
2. **Error Handling**: Throws a descriptive error if `idAlias` is already taken
3. **Query Methods**: New `findByIdAlias` method for login functionality
4. **Availability Check**: `isIdAliasAvailable` provides explicit uniqueness validation

## API Layer Changes

### New Login Endpoint

**File**: `apps/backend/src/routes/users.ts`

Add a new POST endpoint for login by ID alias:

```typescript
router.post('/login', async c => {
  try {
    const db = await getDbClient(c)
    const userUsecase = new UserUsecase(new DrizzleUserRepository(db))
    const body = await c.req.json()
    const { idAlias } = body

    if (!idAlias || typeof idAlias !== 'string') {
      return c.json({ message: 'idAlias is required' }, 400)
    }

    const user = await userUsecase.getUserByIdAlias(idAlias)
    return c.json(user)
  } catch (error) {
    return handleError(error, c)
  }
})
```

### Update Create User Endpoint

Modify the existing POST `/users` endpoint to accept and validate `idAlias`:

```typescript
router.post('/', devOnly, async c => {
  try {
    const db = await getDbClient(c)
    const userUsecase = new UserUsecase(new DrizzleUserRepository(db))
    const body = await c.req.json()
    const payload = CreateUserRequestSchema.parse(body)

    const created = await userUsecase.createUser({
      idAlias: payload.idAlias,  // NEW FIELD
      name: payload.name,
      avatarUrl: payload.avatarUrl,
    })
    return c.json(created, 201)
  } catch (error) {
    return handleError(error, c)
  }
})
```

## Use Case Layer Changes

**File**: `apps/backend/src/usecases/userUsecase.ts`

Add new method for login:

```typescript
export class UserUsecase {
  constructor(private readonly userRepository: UserRepository) {}

  async getUserByIdAlias(idAlias: string): Promise<User> {
    const user = await this.userRepository.findByIdAlias(idAlias)
    if (!user) {
      throw new HttpError(404, `User with idAlias "${idAlias}" not found`)
    }
    return user
  }

  async createUser(data: {
    idAlias: string
    name: string
    avatarUrl?: string | null
  }): Promise<User> {
    // Validation logic could be added here
    return await this.userRepository.create(data)
  }

  // ... existing methods
}
```

## OpenAPI Specification Updates

**File**: `packages/openapi/openapi.yaml`

### 1. Update User Schema

```yaml
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        idAlias:
          type: string
          pattern: '^[a-z0-9][a-z0-9._-]*[a-z0-9]$'
          minLength: 3
          maxLength: 30
          description: 'Unique human-readable identifier for login and display. Must start and end with lowercase letter or number. Only lowercase letters, numbers, dots, underscores, and hyphens allowed. No spaces.'
        name:
          type: string
        avatarUrl:
          type: string
          nullable: true
        createdAt:
          type: string
          format: date-time
      required:
        - id
        - idAlias
        - name
        - createdAt
```

### 2. Update CreateUserRequest Schema

```yaml
components:
  schemas:
    CreateUserRequest:
      type: object
      properties:
        idAlias:
          type: string
          pattern: '^[a-z0-9][a-z0-9._-]*[a-z0-9]$'
          minLength: 3
          maxLength: 30
          description: 'Unique human-readable identifier. Only lowercase letters, numbers, dots, underscores, and hyphens allowed. No spaces.'
        name:
          type: string
          minLength: 1
        avatarUrl:
          type: string
          nullable: true
      required:
        - idAlias
        - name
```

### 3. Add Login Endpoint

```yaml
paths:
  /users/login:
    post:
      summary: Login user by ID alias
      description: Authenticate and retrieve user information by their unique ID alias
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: User found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          description: Bad request - invalid idAlias format
        '404':
          description: User not found

components:
  schemas:
    LoginRequest:
      type: object
      properties:
        idAlias:
          type: string
          pattern: '^[a-z0-9][a-z0-9._-]*[a-z0-9]$'
          minLength: 3
          maxLength: 30
      required:
        - idAlias
```

## Validation Rules

### Input Validation

Implement validation at multiple layers:

1. **OpenAPI Schema Validation** (via Zod)
   - Pattern: `^[a-z0-9][a-z0-9._-]*[a-z0-9]$`
   - Min length: 3
   - Max length: 30
   - **Character whitelist**:
     - Lowercase letters: `a-z`
     - Numbers: `0-9`
     - Symbols: `.` (dot), `_` (underscore), `-` (hyphen)
   - **Format rules**:
     - Must start with lowercase letter or number
     - Must end with lowercase letter or number
     - Symbols (`.`, `_`, `-`) can only appear in the middle
     - No spaces allowed
     - No uppercase letters allowed

2. **Repository Layer Validation**
   - Uniqueness check via `isIdAliasAvailable()`
   - Executed before database insertion
   - Throws error if duplicate detected

3. **Database Constraint**
   - UNIQUE constraint on `id_alias` column
   - Final line of defense against race conditions

### Error Handling

| Scenario | HTTP Status | Error Message |
|----------|-------------|---------------|
| Missing `idAlias` | 400 | "idAlias is required" |
| Invalid format (contains spaces) | 400 | Zod validation error: "String must match pattern" |
| Invalid format (uppercase letters) | 400 | Zod validation error: "String must match pattern" |
| Invalid format (invalid symbols) | 400 | Zod validation error: "String must match pattern" |
| Invalid format (starts/ends with symbol) | 400 | Zod validation error: "String must match pattern" |
| Duplicate `idAlias` | 409 or 400 | "ID Alias '{value}' is already in use" |
| User not found (login) | 404 | "User with idAlias '{value}' not found" |

## Testing Considerations

### Unit Tests

1. **Repository Tests**
   - `create()` with valid `idAlias`
   - `create()` with duplicate `idAlias` (should throw error)
   - `findByIdAlias()` with existing user
   - `findByIdAlias()` with non-existent user
   - `isIdAliasAvailable()` with available/unavailable aliases

2. **API Route Tests**
   - POST `/users/login` with valid `idAlias`
   - POST `/users/login` with invalid `idAlias`
   - POST `/users` with valid data including `idAlias`
   - POST `/users` with duplicate `idAlias`

3. **Validation Tests**
   - Valid formats: `"user123"`, `"test.user"`, `"my_id"`, `"my-id"`
   - Invalid formats with spaces: `"user name"`, `"test user"`
   - Invalid formats with uppercase: `"UserName"`, `"TEST"`
   - Invalid formats with symbols at start: `".user"`, `"_user"`, `"-user"`
   - Invalid formats with symbols at end: `"user."`, `"user_"`, `"user-"`
   - Invalid formats with disallowed symbols: `"user@test"`, `"user#123"`, `"user!"`
   - Edge cases: 2-char (too short), 31-char (too long)

### Integration Tests

1. Create user → Login with `idAlias` → Verify user data
2. Attempt to create two users with same `idAlias` → Verify second fails
3. Create user with `idAlias` → Query by `id` → Verify both work

## Migration Path

### Phase 1: Schema and Repository
1. Update database schema
2. Implement repository methods
3. Add validation logic

### Phase 2: API Layer
1. Update existing endpoints
2. Add login endpoint
3. Update error handling

### Phase 3: OpenAPI and Type Generation
1. Update OpenAPI specification
2. Run `npm run generate:api` to regenerate Zod schemas
3. Fix TypeScript compilation errors

### Phase 4: Testing
1. Write unit tests
2. Write integration tests
3. Update seed data

## Backward Compatibility

- Existing `id` field remains primary key
- All existing APIs continue to work with UUID-based `id`
- `idAlias` is additive - no breaking changes to current functionality
- Both `findById()` and `findByIdAlias()` are available

## Security Considerations

1. **Rate Limiting**: Login endpoint should have rate limiting to prevent brute force attacks
2. **Case Sensitivity**: Not applicable - only lowercase letters are allowed, eliminating case-sensitivity issues
3. **Reserved Words**: Maintain a blacklist of reserved `idAlias` values (e.g., "admin", "root", "system", "api", "login", "logout")
4. **Input Sanitization**:
   - Strict whitelist validation prevents SQL injection and XSS attacks
   - Only allowed characters: `a-z`, `0-9`, `.`, `_`, `-`
   - No spaces or special characters that could be exploited
5. **Character Restrictions**:
   - No spaces prevent URL encoding issues and improve UX
   - Lowercase-only prevents homograph attacks and confusion
   - Symbol restrictions (must be in middle) prevent edge cases in URL parsing

## Example Usage

### Create User (Valid Examples)
```bash
# Example 1: Using underscores
POST /users
{
  "idAlias": "john_doe_2024",
  "name": "John Doe",
  "avatarUrl": "https://example.com/avatar.jpg"
}

# Example 2: Using dots
POST /users
{
  "idAlias": "john.doe",
  "name": "John Doe"
}

# Example 3: Using hyphens
POST /users
{
  "idAlias": "user-123",
  "name": "User 123"
}

# Example 4: Alphanumeric only
POST /users
{
  "idAlias": "johndoe2024",
  "name": "John Doe"
}
```

### Create User (Invalid Examples)
```bash
# INVALID: Contains space
{
  "idAlias": "john doe",  # ❌ Rejected by validation
  "name": "John Doe"
}

# INVALID: Contains uppercase
{
  "idAlias": "JohnDoe",  # ❌ Rejected by validation
  "name": "John Doe"
}

# INVALID: Starts with symbol
{
  "idAlias": "_johndoe",  # ❌ Rejected by validation
  "name": "John Doe"
}

# INVALID: Contains disallowed symbol
{
  "idAlias": "john@doe",  # ❌ Rejected by validation
  "name": "John Doe"
}
```

### Login
```bash
POST /users/login
{
  "idAlias": "john_doe_2024"
}
```

### Response
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "idAlias": "john_doe_2024",
  "name": "John Doe",
  "avatarUrl": "https://example.com/avatar.jpg",
  "createdAt": "2025-12-16T10:30:00.000Z"
}
```

## References

- Drizzle ORM SQLite Documentation: https://orm.drizzle.team/docs/get-started-sqlite
- OpenAPI 3.1 Specification: https://spec.openapis.org/oas/v3.1.0
- Zod Validation Library: https://zod.dev/
