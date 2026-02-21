# Global Engineering Standards

**Project:** WMM2026 (Tournament Bracket Application)  
**Created:** February 21, 2026  
**Last Updated:** February 21, 2026 (Refactoring Phase 1 Complete)  
**Purpose:** Living document defining engineering standards for this project

---

## How to Use This Document

- **The Standards** is our single source of truth for engineering decisions
- Update this document when establishing new standards or modifying existing ones
- All code changes should align with these standards
- When in doubt, discuss before deviating

### Rating Legend

| Category | Meaning |
|----------|---------|
| **(A)** | Good standard, consistently applied |
| **(B)** | Good standard, inconsistently applied - needs improvement |
| **(C)** | Standard applied but architecture could be improved |

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Security](#2-security)
3. [Database](#3-database)
4. [API Design](#4-api-design)
5. [Error Handling](#5-error-handling)
6. [Testing](#6-testing)
7. [Code Quality](#7-code-quality)
8. [Email & Notifications](#8-email--notifications)
9. [Configuration](#9-configuration)
10. [Performance](#10-performance)

---

## 1. Architecture

### 1.1 Framework & Technology Stack (A)

Use Next.js App Router with TypeScript for all application code.

- All pages use the `/app` directory structure
- API routes live under `/app/api/`
- TypeScript is required for all `.ts` and `.tsx` files
- Tailwind CSS for styling

---

### 1.2 Directory Structure (A)

```
src/
├── app/              # Next.js pages and API routes
├── components/       # React UI components
├── lib/              # Business logic and utilities
│   ├── api/          # API response helpers
│   ├── database/     # Database migrations
│   ├── repositories/ # Data access layer
│   ├── services/     # Business logic services
│   ├── types/        # Shared type definitions
│   └── validation/   # Input validation utilities
├── types/            # Global TypeScript definitions
├── contexts/         # React context providers
├── hooks/            # Custom React hooks
├── config/           # Configuration files
└── emails/           # Email templates
```

---

### 1.3 Component Organization (B)

Group related components into subdirectories by feature:

```
components/
├── bracket/       # Bracket-specific components
├── admin/         # Admin panel components
└── [shared]/      # Shared components at root
```

**Status:** Partially applied. Feature directories exist but shared components lack clear organization.

---

### 1.4 Single Responsibility for Library Modules (A) ✅

Each library module should have a single, focused responsibility.

**Implemented Structure:**

| Module | Responsibility |
|--------|----------------|
| `lib/repositories/userRepository.ts` | User CRUD operations |
| `lib/repositories/bracketRepository.ts` | Bracket CRUD operations |
| `lib/repositories/teamDataRepository.ts` | Team reference data |
| `lib/services/tokenService.ts` | Token operations (confirm, reset) |
| `lib/services/authService.ts` | Password verification |
| `lib/database/migrations.ts` | Database schema management |
| `lib/api/responses.ts` | Standardized API responses |
| `lib/validation/validators.ts` | Input validation utilities |
| `lib/constants.ts` | Application constants |

**Note:** `secureDatabase.ts` remains as a backward-compatibility re-export layer. New code should import from specific modules directly.

---

## 2. Security

### 2.1 Password Hashing (A)

Hash passwords using bcrypt with cost factor 12:

```typescript
const hashedPassword = await bcrypt.hash(password, 12);
```

**Rationale:** Cost factor 12 provides strong protection while maintaining acceptable performance.

---

### 2.2 Email Confirmation Required (A)

All new accounts require email confirmation before authentication:

1. Generate cryptographic token on registration
2. Send confirmation email with tokenized link
3. Token expires after 24 hours
4. Validate token before allowing sign-in

---

### 2.3 Admin Authorization (A)

Admin routes must verify admin status before processing:

```typescript
const isAdminUser = await isUserAdmin();
if (!isAdminUser) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

**Location:** `src/lib/adminAuth.ts`

---

### 2.4 Rate Limiting (B)

Apply rate limiting to prevent abuse on sensitive endpoints:

```typescript
const rateLimitResponse = rateLimitMiddleware(request, 'auth:register', RATE_LIMITS.AUTH_REGISTER);
if (rateLimitResponse) return rateLimitResponse;
```

**Current Coverage:**
- ✅ Registration endpoint
- ❌ Password reset (needs implementation)
- ❌ Bracket submission (needs implementation)
- ❌ Login attempts (needs implementation)

---

### 2.5 Input Validation (A) ✅

Use validation utilities from `lib/validation/validators.ts`:

```typescript
import { 
  validateRegistration, 
  validateBracketInput,
  validateTieBreaker,
  required, 
  email, 
  password 
} from '@/lib/validation/validators';

// Composite validators
const result = validateRegistration({ email, name, password });
if (!result.valid) {
  return ApiErrors.validationError(result.error!);
}

// Individual validators
const emailResult = email('Email')(userEmail);
const passwordResult = password(6)(userPassword);
```

**Note:** Existing endpoints should be migrated to use these validators.

---

### 2.6 Test Environment Headers (A)

Honor test suppression headers only in non-production:

```typescript
const isProduction = process.env.VERCEL_ENV === 'production';
const suppressTestEmails = !isProduction && request.headers.get('X-Suppress-Test-Emails') === 'true';
```

**Critical:** Never honor test headers in production.

---

### 2.7 No Secrets in Code (A)

Never hardcode secrets; always use environment variables:

```typescript
const secret = process.env.NEXTAUTH_SECRET;
const adminEmail = process.env.ADMIN_EMAIL;
```

---

## 3. Database

### 3.1 Parameterized Queries (A)

Use template literals with `@vercel/postgres` to prevent SQL injection:

```typescript
const result = await sql`
  SELECT * FROM users WHERE email = ${email} AND environment = ${environment}
`;
```

**Never** concatenate user input into SQL strings.

---

### 3.2 Environment Isolation (A)

All database operations must be scoped to the current environment:

```typescript
const environment = getCurrentEnvironment();
// Include environment in ALL queries
WHERE environment = ${environment}
```

**Environments:** `development`, `preview`, `production`

**Rationale:** Ensures test data never affects production and vice versa.

---

### 3.3 Foreign Key Constraints (A)

Enforce referential integrity:

```sql
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
```

---

### 3.4 Database Indexes (A)

Create indexes for frequently queried columns:

```sql
CREATE INDEX IF NOT EXISTS idx_users_email_env ON users(email, environment);
CREATE INDEX IF NOT EXISTS idx_brackets_user_id_env ON brackets(user_id, environment);
```

---

### 3.5 Migration Management (A) ✅

All schema operations are centralized in `lib/database/migrations.ts`:

```typescript
import { initializeDatabase, initializeTeamDataTable } from '@/lib/database/migrations';

// Initialize all tables (safe to call multiple times)
await initializeDatabase();
```

**Features:**
- All `CREATE TABLE` statements in one file
- Column additions handled with existence checks
- Index creation centralized
- Environment constraints defined once

**Future Enhancement:** Consider adding versioned migrations for complex schema changes.

---

### 3.6 Repository Pattern (A) ✅

Database operations are abstracted behind repository modules:

```typescript
// User operations
import { createUser, getUserByEmail, getUserById } from '@/lib/repositories/userRepository';

// Bracket operations
import { createBracket, getBracketById, updateBracket } from '@/lib/repositories/bracketRepository';

// Team data operations
import { getAllTeamReferenceData } from '@/lib/repositories/teamDataRepository';
```

**Benefits:**
- Easier testing (can mock repositories)
- Cleaner separation of concerns
- Consistent data access patterns
- Environment isolation built-in

---

## 4. API Design

### 4.1 RESTful Conventions (A)

| Method | Purpose |
|--------|---------|
| `GET` | Read data |
| `POST` | Create resource |
| `PUT` | Update resource |
| `PATCH` | Partial update |
| `DELETE` | Remove resource |

---

### 4.2 Response Format (A) ✅

Use standardized response helpers from `lib/api/responses.ts`:

```typescript
import { successResponse, errorResponse, ApiErrors } from '@/lib/api/responses';

// Success response
return successResponse(data, 'Operation completed');
// → { success: true, data: {...}, message: 'Operation completed' }

// Error response
return errorResponse('Invalid input', 400, 'VALIDATION_ERROR');
// → { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }

// Common errors
return ApiErrors.unauthorized();
return ApiErrors.notFound('User');
return ApiErrors.validationError('Email is required');
```

**Note:** Existing endpoints should be migrated to use these helpers.

---

### 4.3 HTTP Status Codes (A)

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation errors) |
| 401 | Unauthorized (not authenticated) |
| 403 | Forbidden (not authorized) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

---

### 4.4 Session Authentication (A)

Use NextAuth.js with JWT strategy:

- Credentials provider for email/password
- JWT tokens in HTTP-only cookies
- Validate via `getServerSession(authOptions)`

---

## 5. Error Handling

### 5.1 Try-Catch in API Routes (A)

All API route handlers must be wrapped in try-catch:

```typescript
export async function POST(request: NextRequest) {
  try {
    // Handler logic
  } catch (error) {
    console.error('Context:', error);
    return NextResponse.json(
      { success: false, error: 'Operation failed' },
      { status: 500 }
    );
  }
}
```

---

### 5.2 Error Logging (B)

**Infrastructure:** `error_logs` table and `logError()` utility exist.

**Current State:** Not consistently used across all error paths.

**Standard:** Log all caught errors with context:

```typescript
await logError(error, 'API Route Context', {
  username: session?.user?.email,
  isLoggedIn: !!session,
  additionalInfo: { requestId, action }
});
```

---

### 5.3 Non-Breaking Error Logging (A)

Error logging must never cause application failure:

```typescript
try {
  await logServerError(entry);
} catch (loggingError) {
  console.error('[Error Logger] Failed:', loggingError);
  // Never throw - continue execution
}
```

---

### 5.4 User-Friendly Messages (B)

Return user-friendly messages, never expose internal details:

```typescript
// ✅ Good
{ error: 'Registration failed. Please try again later.' }

// ❌ Bad
{ error: error.message }  // May expose stack traces or internal info
```

---

### 5.5 Early Returns for Guards (A)

Use early returns for validation and error conditions:

```typescript
if (!session?.user?.email) {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

if (!body.email || !body.password) {
  return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
}

// Main logic continues here
```

---

## 6. Testing

### 6.1 Testing Framework (A)

Use Playwright for all automated testing:

```
tests/
├── api/           # API endpoint tests
├── e2e/           # End-to-end UI tests
└── fixtures/      # Shared test utilities
```

---

### 6.2 Test Organization (A)

Group tests using `test.describe` blocks:

```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup
  });

  test('should do something', async ({ page }) => {
    // Test
  });
});
```

---

### 6.3 Environment Isolation (A)

Tests run against staging by default:

```typescript
export function getBaseURL(): string {
  if (process.env.TEST_ENV === 'production') {
    return process.env.PRODUCTION_URL;
  }
  return process.env.STAGING_URL;  // Default
}
```

**Critical:** Production tests should be read-only or use dedicated test accounts.

---

### 6.4 Centralized Test Helpers (A)

Shared utilities in fixture files:

| File | Purpose |
|------|---------|
| `test-helpers.ts` | Environment config, wait utilities |
| `auth-helpers.ts` | Authentication helpers |
| `test-data.ts` | Test data generation |

---

### 6.5 Stable Locators (B)

**Priority order for locators:**

1. `data-testid` attributes (most stable)
2. Role-based: `getByRole('button', { name: /submit/i })`
3. Text-based: `getByText('Submit')`
4. CSS selectors (avoid when possible)

**Current State:** Mixed usage. Need to add more `data-testid` attributes.

---

### 6.6 Auto-Wait Over Timeouts (B)

**Preferred:**
```typescript
await expect(element).toBeVisible({ timeout: 10000 });
await page.waitForURL(/\/dashboard/);
```

**Avoid:**
```typescript
await page.waitForTimeout(2000);  // Only when absolutely necessary
```

**Note:** Some `waitForTimeout` usage remains for WebKit compatibility.

---

### 6.7 No API-Based Cleanup (A)

Test data cleanup must use local scripts, never API endpoints:

```bash
npm run cleanup:test-data
```

**Rationale:** API cleanup endpoints are a security risk.

---

### 6.8 Cross-Browser Testing (A)

Test across all supported browsers:

- Chromium (Desktop Chrome)
- Firefox
- WebKit (Safari engine)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 13)

---

## 7. Code Quality

### 7.1 TypeScript Interfaces (A)

Define interfaces for all data structures:

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  emailConfirmed: boolean;
  environment: string;
  createdAt: Date;
}
```

---

### 7.2 JSDoc Comments (B)

Document exported functions with JSDoc:

```typescript
/**
 * Creates a new user account with email confirmation
 * @param email - User's email address
 * @param name - User's display name
 * @param password - Plain text password (will be hashed)
 * @returns Created user object with confirmation token
 * @throws Error if user already exists
 */
export async function createUser(email: string, name: string, password: string): Promise<User>
```

**Current State:** Good coverage in test fixtures, inconsistent elsewhere.

---

### 7.3 Constants Over Magic Strings (A) ✅

Use constants from `lib/constants.ts`:

```typescript
import { BracketStatus, Environment, TokenType, ErrorCode } from '@/lib/constants';

// Use typed constants instead of magic strings
if (bracket.status === BracketStatus.SUBMITTED) { }
if (environment === Environment.PRODUCTION) { }
```

**Available Constants:**
- `BracketStatus` - Draft, InProgress, Submitted, Invalid, Deleted
- `Environment` - Development, Preview, Production
- `TokenType` - Confirmation, Reset, AutoSignin
- `ErrorCode` - Standard API error codes
- `TokenExpiration` - Token TTL values
- `PasswordRequirements` - Min length, bcrypt rounds

**Note:** Existing code should be migrated to use these constants.

---

### 7.4 Async/Await (A)

Use async/await for all asynchronous code:

```typescript
const result = await sql`SELECT * FROM users`;
const data = await response.json();
```

---

### 7.5 Explicit Return Types (B)

Functions should have explicit return types:

```typescript
// ✅ Good
async function getUser(id: string): Promise<User | null> { }

// ❌ Avoid
async function getUser(id: string) { }  // Implicit return type
```

---

## 8. Email & Notifications

### 8.1 Centralized Email Service (A)

All email operations go through dedicated service modules:

```typescript
import { sendConfirmationEmail } from '@/lib/emailService';
import { sendSubmissionConfirmationEmail } from '@/lib/bracketEmailService';
```

---

### 8.2 Email Templates (A)

Store templates as HTML files in `src/emails/`:

- `confirm.html` - Account confirmation
- `reset.html` - Password reset
- `email-submit.html` - Bracket submission confirmation
- `email-pdf.html` - PDF attachment emails

---

### 8.3 Async Email Processing (A)

Send emails asynchronously to avoid blocking responses:

```typescript
const emailPromise = sendSubmissionConfirmationEmail(...);
processEmailAsync(emailPromise);  // Uses Vercel's waitUntil
```

---

### 8.4 Email Logging (A)

Log all email events to `email_logs` table:

- Event type (sent, failed, bounced)
- Destination email
- Attachment status
- Success/failure

---

## 9. Configuration

### 9.1 Environment Variables (A)

All configuration via environment variables:

```typescript
process.env.NEXTAUTH_SECRET
process.env.DATABASE_URL
process.env.ADMIN_EMAIL
```

---

### 9.2 Fallback Configuration (A)

Provide fallbacks when external config fails:

```typescript
const config = await getSiteConfigFromGoogleSheets();
const value = config?.entryCost ?? FALLBACK_CONFIG.entryCost;
```

**Location:** `src/lib/fallbackConfig.ts`

---

### 9.3 Build vs Runtime Config (B)

Handle build-time vs runtime differently:

```typescript
if (process.env.NEXT_PHASE === 'phase-production-build') {
  return 'build-placeholder';
}
// Runtime: require actual value
if (!secret) throw new Error('NEXTAUTH_SECRET required');
```

**Status:** Applied for auth, needs systematic application elsewhere.

---

## 10. Performance

### 10.1 Database Indexes (A)

Index all frequently queried columns. See [3.4 Database Indexes](#34-database-indexes-a).

---

### 10.2 Lazy Loading (B)

Use dynamic imports for heavy modules:

```typescript
const { sql } = await import('@/lib/databaseAdapter');
```

**Status:** Applied in some places, not systematic.

---

### 10.3 Response Caching (B)

Cache appropriate responses:

- Site configuration (short TTL)
- Team reference data (medium TTL)
- Static content (long TTL)

**Status:** Some caching via Google Sheets service, not comprehensive.

---

## Summary & Action Items

### Current Statistics

| Rating | Count | Status |
|--------|-------|--------|
| **(A)** | 32 | Maintain |
| **(B)** | 6 | Improve |
| **(C)** | 0 | ✅ All refactored |

### Completed Improvements ✅

1. ~~**[C] Split `secureDatabase.ts`**~~ - Refactored into repositories/services
2. ~~**[B] Standardize API responses**~~ - Created `lib/api/responses.ts`
3. ~~**[B] Create validation utilities**~~ - Created `lib/validation/validators.ts`
4. ~~**[B] Define constants**~~ - Created `lib/constants.ts`

### Remaining Improvements

1. **[B] Expand error logging** - Use `logError()` consistently across all routes
2. **[B] Add test IDs** - Add more `data-testid` attributes to components
3. **[B] Migrate existing endpoints** - Update to use new response/validation helpers
4. **[B] Component organization** - Better structure for shared components
5. **[B] JSDoc coverage** - Add documentation to API routes
6. **[B] Explicit return types** - Add to all exported functions

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-21 | Initial document created from codebase analysis | Architect |
| 2026-02-21 | Reorganized into logical sections | Architect |
| 2026-02-21 | **Refactoring Phase 1:** Split `secureDatabase.ts` into modular structure | Architect |
| 2026-02-21 | Created `lib/api/responses.ts` for standardized API responses | Architect |
| 2026-02-21 | Created `lib/validation/validators.ts` for input validation | Architect |
| 2026-02-21 | Created `lib/constants.ts` for application constants | Architect |
| 2026-02-21 | Created `lib/types/database.ts` for shared type definitions | Architect |

---

## New Module Reference

Quick reference for new imports:

```typescript
// Types
import type { User, Bracket, BracketWithUser } from '@/lib/types/database';

// Repositories
import { createUser, getUserByEmail } from '@/lib/repositories/userRepository';
import { createBracket, getBracketById } from '@/lib/repositories/bracketRepository';
import { getAllTeamReferenceData } from '@/lib/repositories/teamDataRepository';

// Services
import { verifyPassword } from '@/lib/services/authService';
import { confirmUserEmail, resetPassword } from '@/lib/services/tokenService';

// API Helpers
import { successResponse, errorResponse, ApiErrors } from '@/lib/api/responses';

// Validation
import { validateRegistration, validateBracketInput } from '@/lib/validation/validators';

// Constants
import { BracketStatus, Environment, ErrorCode } from '@/lib/constants';

// Database (migrations only)
import { initializeDatabase } from '@/lib/database/migrations';

// Backward compatibility (deprecated - use specific imports above)
import { createUser, createBracket } from '@/lib/secureDatabase';
```

---

*This is a living document. Update it when standards change.*
