# Global Engineering Standards

**Project:** WMM2026 (Tournament Bracket Application)  
**Created:** February 21, 2026  
**Last Updated:** February 21, 2026 (Added data-testid naming conventions standard)  
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

1. [Tech Stack](#1-tech-stack)
2. [Architecture](#2-architecture)
3. [Security](#3-security)
4. [Database](#4-database)
5. [API Design](#5-api-design)
6. [Error Handling](#6-error-handling)
7. [Testing](#7-testing)
8. [Code Quality](#8-code-quality)
9. [Email & Notifications](#9-email--notifications)
10. [Configuration](#10-configuration)
11. [Performance](#11-performance)

---

## 1. Tech Stack

> **Section Owner:** Application Architect  
> **Last Reviewed:** February 21, 2026

This section defines the approved technologies for this project. All technology choices should align with this stack unless explicitly approved.

---

### 1.1 Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 15.x | React framework with App Router, SSR/SSG |
| **React** | 19.x | UI component library |
| **TypeScript** | 5.x | Type-safe JavaScript |
| **Node.js** | 20.x+ | Runtime environment |

---

### 1.2 Frontend & Styling

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tailwind CSS** | 4.x | Utility-first CSS framework |
| **Lucide React** | latest | Icon library |
| **React Hook Form** | - | Form state management (if used) |

---

### 1.3 Authentication & Security

| Technology | Version | Purpose |
|------------|---------|---------|
| **NextAuth.js** | 4.x | Authentication framework |
| **bcryptjs** | latest | Password hashing |
| **crypto** (Node.js) | built-in | Token generation, CSRF |

**Authentication Strategy:** JWT with Credentials provider (email/password)

---

### 1.4 Database

| Technology | Version | Purpose |
|------------|---------|---------|
| **Vercel Postgres** | latest | Managed PostgreSQL (powered by Neon) |
| **@vercel/postgres** | latest | Database client |

**ORM Strategy:** Raw SQL queries via tagged template literals (no ORM)

```typescript
import { sql } from '@/lib/databaseAdapter';
const result = await sql`SELECT * FROM users WHERE id = ${userId}`;
```

---

### 1.5 PDF Generation

| Technology | Version | Purpose |
|------------|---------|---------|
| **jsPDF** | 4.x | Client-side PDF generation |
| **Puppeteer Core** | 24.x | Server-side PDF rendering |

**Use Cases:**
- **jsPDF:** Quick client-side bracket exports, simple documents
- **Puppeteer Core:** High-fidelity PDF rendering from HTML, complex layouts

---

### 1.6 Email & Notifications

| Technology | Version | Purpose |
|------------|---------|---------|
| **Nodemailer** | latest | SMTP email delivery |
| **HTML Templates** | - | Email templates in `src/emails/` |

---

### 1.7 External Integrations

| Technology | Purpose |
|------------|---------|
| **Google Sheets API** | Site configuration, dynamic content |

---

### 1.8 Testing

| Technology | Version | Purpose |
|------------|---------|---------|
| **Playwright** | latest | E2E and API testing |

**Test Types:** API tests, E2E browser tests, cross-browser (Chromium, Firefox, WebKit, Mobile)

---

### 1.9 Deployment & Infrastructure

| Technology | Purpose |
|------------|---------|
| **Vercel** | Hosting, serverless functions, preview deployments |
| **GitHub** | Source control, CI/CD integration |

**Environments:**
- `production` - Live site
- `preview` - Branch deployments (staging)
- `development` - Local development

---

### 1.10 Development Tools

| Tool | Purpose |
|------|---------|
| **ESLint** | Code linting |
| **Prettier** | Code formatting (if configured) |
| **Turbopack** | Fast development builds |

---

### Technology Selection Guidelines

When evaluating new technologies:

1. **Prefer established solutions** - Choose well-maintained, widely-adopted libraries
2. **Minimize dependencies** - Only add what's truly needed
3. **Consider bundle size** - Frontend dependencies affect load time
4. **Check Vercel compatibility** - Must work in serverless environment
5. **Evaluate maintenance burden** - Who will maintain it long-term?

**Approval Process:** New technologies require Architect review before adoption.

---

## 2. Architecture

### 2.1 Framework & Technology Stack (A)

Use Next.js App Router with TypeScript for all application code. See [Section 1: Tech Stack](#1-tech-stack) for complete details.

- All pages use the `/app` directory structure
- API routes live under `/app/api/`
- TypeScript is required for all `.ts` and `.tsx` files
- Tailwind CSS for styling

---

### 2.2 Directory Structure (A)

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

### 2.3 Component Organization (B)

Group related components into subdirectories by feature:

```
components/
├── bracket/       # Bracket-specific components
├── admin/         # Admin panel components
└── [shared]/      # Shared components at root
```

**Testability:** All interactive UI components (buttons, inputs, dialogs) MUST include `data-testid` attributes for stable test automation. See **Section 7.7** for naming conventions and the established test ID table.

**Status:** Partially applied. Feature directories exist but shared components lack clear organization.

---

### 2.4 Single Responsibility for Library Modules (A) ✅

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

## 3. Security

> **Section Owner:** Security Auditor  
> **Last Reviewed:** February 21, 2026  
> **Compliance Status:** All standards (A) - Fully compliant

This section defines all security standards for the application. The Security Auditor is responsible for maintaining these standards and ensuring compliance across the codebase.

---

### 2.0 Environment-Aware Security Controls (A) ⭐

**FOUNDATIONAL PATTERN:** Security controls must balance protection with testability across environments.

```typescript
function getSecurityConfig() {
  const isProduction = process.env.VERCEL_ENV === 'production' 
                    || process.env.NODE_ENV === 'production';
  
  return {
    rateLimitMultiplier: isProduction ? 1 : 10,  // 10x relaxed for testing
    strictValidation: isProduction,
    verboseErrors: !isProduction,
  };
}
```

**Principle:** 
- **Production:** Maximum security, strict limits, minimal error details
- **Staging/Preview:** Relaxed limits to enable QA testing, more verbose errors for debugging
- **Development:** Most permissive, full error details

**Apply This Pattern To:**

| Control | Production | Staging/Preview | Rationale |
|---------|------------|-----------------|-----------|
| Rate Limits | Strict (e.g., 5/15min) | Relaxed (e.g., 50/15min) | QA runs many test iterations |
| Error Messages | Generic only | Include error codes | Debugging without exposing internals |
| Session Timeouts | Short | Extended | Longer test sessions |
| CAPTCHA/Challenges | Enabled | Disabled or test mode | Automation compatibility |

**Anti-Patterns to Avoid:**
- ❌ Disabling security entirely in non-production
- ❌ Using different code paths (leads to untested production code)
- ❌ Hardcoding environment checks throughout codebase

**Best Practice:**
- ✅ Use configuration multipliers (same code, different thresholds)
- ✅ Centralize environment detection
- ✅ Document the production values as the "source of truth"
- ✅ Ensure staging tests still exercise security code paths

**Location:** `src/lib/rateLimit.ts`, all security middleware

---

### 3.1 Password Hashing (A)

Hash passwords using bcrypt with cost factor 12:

```typescript
const hashedPassword = await bcrypt.hash(password, 12);
```

**Rationale:** Cost factor 12 provides strong protection while maintaining acceptable performance.

**Location:** `src/lib/repositories/userRepository.ts`

---

### 3.2 Email Confirmation Required (A)

All new accounts require email confirmation before authentication:

1. Generate cryptographic token on registration
2. Send confirmation email with tokenized link
3. Token expires after 24 hours
4. Validate token before allowing sign-in

**Location:** `src/lib/services/tokenService.ts`

---

### 3.3 Admin Authorization (A)

Admin routes must verify admin status before processing:

```typescript
const isAdminUser = await isUserAdmin();
if (!isAdminUser) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

**Location:** `src/lib/adminAuth.ts`

---

### 3.4 Rate Limiting (A)

Apply rate limiting to prevent abuse on sensitive endpoints:

```typescript
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rateLimit';

const rateLimitResponse = rateLimitMiddleware(request, 'auth:register', RATE_LIMITS.AUTH_REGISTER);
if (rateLimitResponse) return rateLimitResponse;
```

**Location:** `src/lib/rateLimit.ts`

**Predefined Configurations (Production):**

| Endpoint | Window | Max Requests | Rationale |
|----------|--------|--------------|-----------|
| `AUTH_LOGIN` | 15 min | 5 | Prevent brute force attacks |
| `AUTH_REGISTER` | 1 hour | 3 | Prevent account spam |
| `AUTH_FORGOT_PASSWORD` | 1 hour | 3 | Prevent email flooding |
| `AUTH_RESET_PASSWORD` | 15 min | 5 | Prevent token brute forcing |
| `AUTH_CONFIRM` | 15 min | 10 | Prevent confirmation abuse |

**Environment-Aware Limits:**
- **Production:** Strict limits (as shown above)
- **Staging/Preview:** 10x more permissive to facilitate testing
  - Login: 50 attempts per 15 min
  - Password Reset: 30 attempts per hour

**Implementation Notes:**
- Uses in-memory storage (resets on deployment)
- Client identified via `X-Forwarded-For` header (Vercel proxy)
- Returns 429 with `Retry-After` header when limited
- Rate limit headers included in all responses
- Clear error messages displayed to users (e.g., "Too many login attempts. Please try again in X minutes.")

**Current Coverage:**
- ✅ Registration endpoint (`/api/auth/register`)
- ✅ Password reset (`/api/auth/forgot-password`, `/api/auth/reset-password`)
- ✅ Email confirmation (`/api/auth/confirm`)
- ✅ Login attempts (via NextAuth authorize function)
- ❌ Bracket submission (consider for future)

---

### 3.5 CSRF Protection (A)

Protect state-changing endpoints using Double Submit Cookie pattern:

```typescript
import { csrfProtection, validateCSRFToken } from '@/lib/csrf';

// In API route
const csrfError = csrfProtection(request);
if (csrfError) return csrfError;
```

**Location:** `src/lib/csrf.ts`, `src/hooks/useCSRF.ts`

**Implementation:**
- Server generates signed token with timestamp
- Token stored in cookie AND must be sent in `x-csrf-token` header
- Tokens expire after 24 hours
- Exempt paths defined in `CSRF_EXEMPT_PATHS`

**Current Coverage:**
- ✅ Tournament bracket endpoints (`/api/tournament-bracket`)
- ✅ Bracket update/delete (`/api/tournament-bracket/[id]`)
- Exempt: Auth endpoints (use rate limiting instead)

---

### 3.6 XSS Prevention (A)

Escape user-generated content before rendering in HTML contexts:

```typescript
import { escapeHtml } from '@/lib/emailTemplate';

const safeName = escapeHtml(userProvidedName);
```

**Location:** `src/lib/emailTemplate.ts`

**Critical Areas:**
- Email templates (user names, entry names)
- Admin dashboards displaying user data
- Any HTML rendering of user input

---

### 3.7 Command Injection Prevention (A)

Never pass user input directly to shell commands:

```typescript
// ✅ Safe: Validate against allowlist
const validProjects = ['chromium', 'firefox', 'webkit'];
if (!validProjects.includes(project)) {
  throw new Error('Invalid project');
}

// ❌ Dangerous: Direct interpolation
exec(`npm run test -- --project=${userInput}`);  // NEVER DO THIS
```

**Location:** `scripts/run-tests-with-projects.js`, `scripts/run-test-by-id.js`

---

### 3.8 Input Validation (A)

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
```

**Location:** `src/lib/validation/validators.ts`

**Note:** Existing endpoints should be migrated to use these validators.

---

### 3.9 Test Environment Headers (A)

Honor test suppression headers only in non-production:

```typescript
const isProduction = process.env.VERCEL_ENV === 'production';
const suppressTestEmails = !isProduction && request.headers.get('X-Suppress-Test-Emails') === 'true';
```

**Critical:** Never honor test headers in production.

---

### 3.10 No Secrets in Code (A)

Never hardcode secrets; always use environment variables:

```typescript
const secret = process.env.NEXTAUTH_SECRET;
const adminEmail = process.env.ADMIN_EMAIL;
```

**Required Environment Variables:**
- `NEXTAUTH_SECRET` - JWT signing key
- `DATABASE_URL` - Postgres connection string
- `ADMIN_EMAIL` - Admin user email
- `EMAIL_SERVER_*` - SMTP configuration

---

### 3.11 SQL Injection Prevention (A)

Always use parameterized queries. See [3.1 Parameterized Queries](#31-parameterized-queries-a).

---

### 2.12 Information Disclosure Prevention (A)

Never expose internal details in error responses:

```typescript
// ✅ Safe - Generic user-facing message
return NextResponse.json(
  { error: 'Registration failed. Please try again later.' },
  { status: 500 }
);

// ❌ Dangerous - Exposes internal details
return NextResponse.json(
  { error: error.message, stack: error.stack, details: dbError },
  { status: 500 }
);
```

**Critical Rules:**
- Never include stack traces in API responses
- Never expose database error details
- Never reveal system paths or configuration
- Log detailed errors server-side, return generic messages to clients

**Location:** All API routes in `src/app/api/`

---

### Security Checklist for New Features

When implementing new features, verify:

- [ ] Authentication required for sensitive endpoints
- [ ] Authorization checks for user-specific data
- [ ] Rate limiting on public endpoints
- [ ] CSRF protection on state-changing operations
- [ ] Input validation before processing
- [ ] XSS escaping for user content in HTML
- [ ] No secrets hardcoded
- [ ] Error messages don't leak internal details

---

## 4. Database

### 4.1 Parameterized Queries (A)

Use template literals with `@vercel/postgres` to prevent SQL injection:

```typescript
const result = await sql`
  SELECT * FROM users WHERE email = ${email} AND environment = ${environment}
`;
```

**Never** concatenate user input into SQL strings.

---

### 4.2 Environment Isolation (A)

All database operations must be scoped to the current environment:

```typescript
const environment = getCurrentEnvironment();
// Include environment in ALL queries
WHERE environment = ${environment}
```

**Environments:** `development`, `preview`, `production`

**Rationale:** Ensures test data never affects production and vice versa.

---

### 4.3 Foreign Key Constraints (A)

Enforce referential integrity:

```sql
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
```

---

### 4.4 Database Indexes (A)

Create indexes for frequently queried columns:

```sql
CREATE INDEX IF NOT EXISTS idx_users_email_env ON users(email, environment);
CREATE INDEX IF NOT EXISTS idx_brackets_user_id_env ON brackets(user_id, environment);
```

---

### 4.5 Migration Management (A) ✅

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

### 4.6 Repository Pattern (A) ✅

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

## 5. API Design

### 5.1 RESTful Conventions (A)

| Method | Purpose |
|--------|---------|
| `GET` | Read data |
| `POST` | Create resource |
| `PUT` | Update resource |
| `PATCH` | Partial update |
| `DELETE` | Remove resource |

---

### 5.2 Response Format (A) ✅

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

### 5.3 HTTP Status Codes (A)

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

### 5.4 Session Authentication (A)

Use NextAuth.js with JWT strategy:

- Credentials provider for email/password
- JWT tokens in HTTP-only cookies
- Validate via `getServerSession(authOptions)`

---

## 6. Error Handling

### 6.1 Try-Catch in API Routes (A)

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

### 6.2 Error Logging (B)

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

### 6.3 Non-Breaking Error Logging (A)

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

### 6.4 User-Friendly Messages (B)

Return user-friendly messages, never expose internal details:

```typescript
// ✅ Good
{ error: 'Registration failed. Please try again later.' }

// ❌ Bad
{ error: error.message }  // May expose stack traces or internal info
```

---

### 6.5 Early Returns for Guards (A)

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

## 7. Testing

> **Section Owner:** QA Engineer  
> **Last Reviewed:** February 21, 2026  
> **Compliance Status:** 10 standards (A), 2 standards (B)

This section defines all testing standards for the application. The QA Engineer is responsible for maintaining these standards, test coverage, and test quality.

---

### 7.1 Testing Framework (A)

Use Playwright for all automated testing:

```
tests/
├── api/              # API endpoint tests (no browser)
│   ├── admin.spec.ts         # Admin API security tests
│   ├── auth.spec.ts          # Authentication API tests
│   ├── bracket.spec.ts       # Bracket API tests
│   ├── password-reset.spec.ts # Password reset flow tests
│   ├── public-endpoints.spec.ts # Public API tests
│   └── security.spec.ts      # Security penetration tests
├── e2e/              # End-to-end UI tests (browser-based)
│   ├── smoke-test.spec.ts    # Critical path smoke test
│   ├── authentication.spec.ts
│   ├── account-creation.spec.ts
│   ├── account-validation.spec.ts
│   ├── bracket-interaction.spec.ts
│   ├── bracket-full-workflow.spec.ts
│   ├── admin-security.spec.ts
│   └── ... (12 spec files total)
└── fixtures/         # Shared test utilities and helpers
    ├── test-helpers.ts       # Environment, wait utilities, data tracking
    ├── auth-helpers.ts       # Sign in/out, session management
    └── test-data.ts          # Test data generation
```

**Configuration:** `playwright.config.ts`

---

### 7.2 Test Types (A)

| Type | Directory | Purpose | Runs Browser | Test Count |
|------|-----------|---------|--------------|------------|
| **API Tests** | `tests/api/` | Test API endpoints directly | No | ~126 |
| **E2E Tests** | `tests/e2e/` | Test user flows through UI | Yes | ~140 |
| **Smoke Tests** | `smoke-test.spec.ts` | Critical path verification | Yes | 1 |
| **Security Tests** | `tests/api/security.spec.ts` | Penetration testing | No | ~50 |

**Running Tests:**
```bash
# All tests (all browsers)
npm run test

# Specific type
npm run test:api           # API tests only
npm run test:e2e           # E2E tests only

# Single browser (faster feedback)
npx playwright test --project=chromium

# Smoke test only (quick verification)
npx playwright test tests/e2e/smoke-test.spec.ts --project=chromium
```

---

### 7.3 Test Organization (A)

Group tests using `test.describe` blocks with clear naming:

```typescript
test.describe('Feature Name', () => {
  test.describe('Scenario Group', () => {
    test.beforeEach(async ({ page }) => {
      // Setup for this group
    });

    test('should [expected behavior] when [condition]', async ({ page }) => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

**Naming Convention:**
- Describe blocks: Feature or scenario name
- Test names: `should [do something] when [condition]`

---

### 7.4 Environment Isolation (A)

Tests run against staging by default with Vercel deployment protection bypass:

```typescript
export function getBaseURL(): string {
  if (process.env.PLAYWRIGHT_TEST_BASE_URL) {
    return process.env.PLAYWRIGHT_TEST_BASE_URL;  // Explicit override
  }
  if (process.env.TEST_ENV === 'production') {
    return process.env.PRODUCTION_URL;
  }
  return process.env.STAGING_URL;  // Default to staging
}
```

**Vercel Deployment Protection:**

Staging environments use Vercel's deployment protection. Tests bypass this via the `x-vercel-protection-bypass` header configured in `playwright.config.ts`:

```typescript
extraHTTPHeaders: {
  ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET 
    ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
    : {}),
}
```

**Required Environment Variables:**
- `VERCEL_AUTOMATION_BYPASS_SECRET` - Bypass token from Vercel dashboard
- `TEST_USER_EMAIL` - Test user email address
- `TEST_USER_PASSWORD_STAGING` - Test user password for staging
- `TEST_USER_PASSWORD_PRODUCTION` - Test user password for production (if testing prod)

**Critical Rules:**
- Never run destructive tests against production
- Production tests must be read-only or use dedicated test accounts
- Test data uses `environment` column for database isolation

---

### 7.5 Centralized Test Helpers (A)

Shared utilities in fixture files:

| File | Purpose | Key Exports |
|------|---------|-------------|
| `test-helpers.ts` | Environment config, wait utilities, data tracking | `getBaseURL()`, `getTestUserCredentials()`, `waitForNetworkSettled()`, `retryWithBackoff()`, `trackTestData()` |
| `auth-helpers.ts` | Sign in/out, user creation, CSRF helpers | `signInUser()`, `signOutUser()`, `createTestUser()`, `makeBracketAPIRequest()` |
| `test-data.ts` | Test data generation | `generateUniqueEmail()`, `generateTestUser()`, `generateBracketName()` |

**Usage:**
```typescript
import { getBaseURL, getTestUserCredentials, waitForNetworkSettled } from '../fixtures/test-helpers';
import { signInUser, makeBracketAPIRequest } from '../fixtures/auth-helpers';
import { generateUniqueEmail, generateTestUser } from '../fixtures/test-data';
```

**Wait Utilities (prefer over waitForTimeout):**
```typescript
// Wait for network to settle
await waitForNetworkSettled(page);

// Wait for navigation with expected URL
await waitForNavigationComplete(page, /\/bracket/);

// Retry flaky operations
const result = await retryWithBackoff(() => fetchData(), 3, 500);
```

---

### 7.6 Stable Locators (A) ✅

**Priority order for locators:**

1. **`data-testid`** - Most stable, explicit test contracts
   ```typescript
   page.getByTestId('submit-button')
   ```

2. **Role-based** - Semantic and accessible
   ```typescript
   page.getByRole('button', { name: /submit/i })
   ```

3. **Label-based** - For form elements
   ```typescript
   page.getByLabel('Email')
   ```

4. **Text-based** - For visible content
   ```typescript
   page.getByText('Submit Entry')
   ```

5. **CSS selectors** - Avoid when possible, brittle
   ```typescript
   page.locator('.submit-btn')  // Last resort
   ```

---

### 7.7 Data-TestID Naming Conventions (A) ✅

**Standard:** All interactive elements that tests need to locate MUST have `data-testid` attributes.

#### Naming Pattern

Use kebab-case with descriptive, action-oriented names:

```
{action/noun}-{element-type}[-{variant}]
```

**Examples:**
- `logout-button-desktop` - Action + element type + viewport variant
- `entry-name-input` - Noun + element type  
- `delete-confirmation-dialog` - Action + context + element type

#### Responsive Variants

**IMPORTANT:** When the same interactive element appears in both desktop and mobile layouts, use `-desktop` / `-mobile` suffixes to ensure uniqueness:

```tsx
{/* Desktop Layout */}
<button data-testid="new-bracket-button-desktop">...</button>

{/* Mobile Layout */}
<button data-testid="new-bracket-button-mobile">...</button>
```

**Why:** Playwright's strict mode fails when a locator matches multiple elements. Unique IDs prevent ambiguity and make tests self-documenting.

#### When to Add data-testid

**MUST have data-testid:**
- Buttons that trigger actions (submit, delete, copy, etc.)
- Form inputs that tests need to fill
- Dialogs/modals that tests need to interact with
- Elements that vary between mobile/desktop views
- Elements without stable text content (icon-only buttons)

**MAY skip data-testid:**
- Static display elements (headings, paragraphs)
- Elements with stable, unique text that won't change
- Elements already uniquely identifiable by role + name

#### Established Test IDs

| Test ID | Component | Purpose |
|---------|-----------|---------|
| `logout-button-desktop` | MyPicksLanding | Sign out button (desktop) |
| `logout-button-mobile` | MyPicksLanding | Sign out button (mobile) |
| `new-bracket-button-desktop` | MyPicksLanding | Create new bracket (desktop) |
| `new-bracket-button-mobile` | MyPicksLanding | Create new bracket (mobile) |
| `entry-name-input` | RegionBracketLayout, FinalFourChampionship | Bracket name field |
| `tiebreaker-input` | FinalFourChampionship | Tiebreaker score field |
| `copy-bracket-button` | MyPicksLanding | Copy bracket action |
| `email-bracket-button` | MyPicksLanding | Email PDF action |
| `delete-bracket-button` | MyPicksLanding | Delete bracket action |
| `delete-confirmation-dialog` | MyPicksLanding | Delete confirmation UI |

#### Implementation

```tsx
// Button with data-testid
<button 
  onClick={handleSubmit}
  data-testid="submit-bracket-button"
>
  Submit
</button>

// Input with data-testid
<input
  type="text"
  value={entryName}
  onChange={(e) => setEntryName(e.target.value)}
  data-testid="entry-name-input"
/>

// Dialog/container with data-testid
<div 
  className="modal"
  data-testid="delete-confirmation-dialog"
>
  ...
</div>
```

#### Test Usage

```typescript
// Preferred: getByTestId for stability
await page.getByTestId('logout-button').click();
await page.getByTestId('entry-name-input').fill('My Bracket');
await expect(page.getByTestId('delete-confirmation-dialog')).toBeVisible();
```

**Adding New Test IDs:** When adding new interactive elements, include the `data-testid` attribute and add it to the table above.

---

### 7.8 Auto-Wait Over Timeouts (B)

**Preferred - Web-first assertions:**
```typescript
await expect(element).toBeVisible({ timeout: 10000 });
await expect(page).toHaveURL(/\/dashboard/);
await expect(element).toHaveText('Success');
```

**Acceptable - Centralized wait utilities:**
```typescript
await waitForNetworkSettled(page);
await waitForNavigationComplete(page, /\/dashboard/);
await waitForElementStable(element);
```

**Avoid - Fixed timeouts:**
```typescript
await page.waitForTimeout(2000);  // Only when absolutely necessary
```

**Note:** Some `waitForTimeout` remains for WebKit compatibility issues.

---

### 7.8 Test Data Management (A)

**Creation:**
- Use helper functions for consistent test data
- Include timestamps for uniqueness
- Pattern: `{prefix}-{timestamp}-{random}@example.com`

```typescript
import { generateUniqueEmail, generateTestUser } from '../fixtures/test-data';

const email = generateUniqueEmail('api-test');  // api-test-1740123456789-abc123@example.com
const user = generateTestUser({ name: 'Custom Name' });
```

**Cleanup:**
```bash
npm run cleanup:test-data
```

**Never** create API endpoints for test cleanup (security risk).

**Tracking:**
```typescript
import { trackTestData, generateCleanupReport } from '../fixtures/test-helpers';

const user = await createTestUser();
trackTestData('user', user.email);  // Track for cleanup

// In afterAll hook:
console.log(generateCleanupReport());
```

---

### 7.9 Cross-Browser Testing (A)

Test across all supported browsers:

| Browser | Viewport | Device | Notes |
|---------|----------|--------|-------|
| Chromium | Desktop | Desktop Chrome | Primary browser |
| Firefox | Desktop | Desktop Firefox | Secondary |
| WebKit | Desktop | Desktop Safari | Safari engine, requires extended timeouts |
| Mobile Chrome | 393x851 | Pixel 5 | Android emulation |
| Mobile Safari | 390x844 | iPhone 13 | iOS emulation |
| Mobile Safari (Pro) | 390x844 | iPhone 13 Pro | Larger iOS device |

**Configuration:** See `playwright.config.ts` projects array.

**WebKit-Specific Handling:**
- Extended timeouts (60s navigation, 30s actions)
- Manual cookie handling for session persistence
- `fillInputReliably()` helper for React controlled inputs

---

### 7.10 API Testing Standards (A)

API tests verify endpoint behavior without browser context:

```typescript
import { test, expect } from '@playwright/test';
import { getBaseURL } from '../fixtures/test-helpers';

test.describe('API: /api/endpoint', () => {
  test('should return 200 for valid request', async ({ request }) => {
    const baseURL = getBaseURL();
    const response = await request.post(`${baseURL}/api/endpoint`, {
      data: { /* payload */ },
      headers: { 'Content-Type': 'application/json' }
    });
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });
});
```

**Resilient Assertions for Environment Variations:**
```typescript
// Handle staging auth protection (may return redirect or 401)
expect(response.status()).not.toBe(200);  // Should not succeed
expect(response.status()).not.toBe(500);  // Should not crash

// Check content type before parsing JSON
const contentType = response.headers()['content-type'] || '';
if (contentType.includes('application/json')) {
  const data = await response.json();
  expect(data.error).toBeDefined();
}
```

**Checklist for API tests:**
- [ ] Test success cases (200, 201)
- [ ] Test validation errors (400, 422)
- [ ] Test authentication (401)
- [ ] Test authorization (403)
- [ ] Test not found (404)
- [ ] Test rate limiting (429) where applicable
- [ ] Handle environment-specific responses (redirects, auth protection)

---

### 7.11 E2E Testing Standards (A)

E2E tests simulate real user behavior:

```typescript
import { signInUser } from '../fixtures/auth-helpers';
import { getTestUserCredentials } from '../fixtures/test-helpers';

test('user can submit bracket', async ({ page }) => {
  // Arrange - Sign in using centralized helper
  const credentials = getTestUserCredentials();
  await signInUser(page, credentials.email, credentials.password);
  
  // Act - Perform user actions
  await page.goto('/bracket');
  await page.getByLabel('Entry Name').fill('My Bracket');
  await page.getByRole('button', { name: 'Submit' }).click();
  
  // Assert - Verify outcomes
  await expect(page.getByText('Submission successful')).toBeVisible();
});
```

**Checklist for E2E tests:**
- [ ] Test happy path flows
- [ ] Test error handling (invalid input, network errors)
- [ ] Test accessibility (keyboard navigation, screen readers)
- [ ] Test mobile viewports
- [ ] Test session persistence
- [ ] Use centralized auth helpers (not inline credentials)

---

### 7.12 Test Assertions (A)

Use Playwright's built-in assertions:

```typescript
// Visibility
await expect(element).toBeVisible();
await expect(element).toBeHidden();

// Content
await expect(element).toHaveText('Expected text');
await expect(element).toContainText('partial');

// State
await expect(element).toBeEnabled();
await expect(element).toBeChecked();

// Count
await expect(page.getByRole('listitem')).toHaveCount(5);

// URL
await expect(page).toHaveURL(/\/dashboard/);
```

---

### 6.13 Security Testing Standards (A) ✅ NEW

Security tests verify resistance to common attacks:

**Test Categories:**
| Category | Purpose | Example Payloads |
|----------|---------|------------------|
| SQL Injection | Verify parameterized queries | `'; DROP TABLE users; --` |
| XSS Prevention | Verify output escaping | `<script>alert('xss')</script>` |
| CSRF Protection | Verify token requirements | Missing/invalid CSRF tokens |
| Auth Bypass | Verify route protection | Access without session |
| Rate Limiting | Verify abuse prevention | Rapid repeated requests |
| Path Traversal | Verify input sanitization | `../../../etc/passwd` |

**Security Test Pattern:**
```typescript
test('should reject SQL injection in email field', async ({ request }) => {
  const baseURL = getBaseURL();
  const sqlPayload = "'; DROP TABLE users; --";
  
  const response = await request.post(`${baseURL}/api/auth/register`, {
    data: { email: sqlPayload, password: 'test123', name: 'Test' },
  });
  
  // Should reject with error, not succeed or crash
  expect(response.status()).not.toBe(200);
  expect(response.status()).not.toBe(500);
});
```

**Location:** `tests/api/security.spec.ts`

---

### 6.14 CI/CD Integration (A) ✅ NEW

Tests run automatically via GitHub Actions:

**Workflows:**
| Workflow | Trigger | Scope |
|----------|---------|-------|
| `test-smoke.yml` | Push to staging | Smoke tests only |
| `test-full-regression.yml` | Manual / PR merge | All tests, all browsers |
| `test-pr.yml` | Pull request | Smoke + API + Security |

**Parallel Execution:**
```yaml
env:
  PLAYWRIGHT_WORKERS: '4'  # Parallel test execution
```

**Browser Caching:**
```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-browsers-${{ hashFiles('package-lock.json') }}
```

---

### Testing Checklist for New Features

When adding tests for new features, verify:

- [ ] API tests for all new endpoints
- [ ] E2E tests for user-facing flows
- [ ] Error case coverage (validation, not found, unauthorized)
- [ ] Authentication/authorization tests
- [ ] Mobile viewport testing
- [ ] Cross-browser compatibility (especially WebKit)
- [ ] Test data cleanup handled (use tracking utilities)
- [ ] No hardcoded waits (use centralized wait utilities)
- [ ] Security considerations (injection, XSS, CSRF)
- [ ] Environment-agnostic assertions (handle staging auth protection)
- [ ] **Use `data-testid` locators** for interactive elements (see Section 7.7)

---

## 8. Code Quality

### 8.1 TypeScript Interfaces (A)

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

### 8.2 JSDoc Comments (B)

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

### 8.3 Constants Over Magic Strings (A) ✅

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

### 8.4 Async/Await (A)

Use async/await for all asynchronous code:

```typescript
const result = await sql`SELECT * FROM users`;
const data = await response.json();
```

---

### 8.5 Explicit Return Types (B)

Functions should have explicit return types:

```typescript
// ✅ Good
async function getUser(id: string): Promise<User | null> { }

// ❌ Avoid
async function getUser(id: string) { }  // Implicit return type
```

---

## 9. Email & Notifications

### 9.1 Centralized Email Service (A)

All email operations go through dedicated service modules:

```typescript
import { sendConfirmationEmail } from '@/lib/emailService';
import { sendSubmissionConfirmationEmail } from '@/lib/bracketEmailService';
```

---

### 9.2 Email Templates (A)

Store templates as HTML files in `src/emails/`:

- `confirm.html` - Account confirmation
- `reset.html` - Password reset
- `email-submit.html` - Bracket submission confirmation
- `email-pdf.html` - PDF attachment emails

---

### 9.3 Async Email Processing (A)

Send emails asynchronously to avoid blocking responses:

```typescript
const emailPromise = sendSubmissionConfirmationEmail(...);
processEmailAsync(emailPromise);  // Uses Vercel's waitUntil
```

---

### 9.4 Email Logging (A)

Log all email events to `email_logs` table:

- Event type (sent, failed, bounced)
- Destination email
- Attachment status
- Success/failure

---

## 10. Configuration

### 10.1 Environment Variables (A)

All configuration via environment variables:

```typescript
process.env.NEXTAUTH_SECRET
process.env.DATABASE_URL
process.env.ADMIN_EMAIL
```

---

### 10.2 Fallback Configuration (A)

Provide fallbacks when external config fails:

```typescript
const config = await getSiteConfigFromGoogleSheets();
const value = config?.entryCost ?? FALLBACK_CONFIG.entryCost;
```

**Location:** `src/lib/fallbackConfig.ts`

---

### 10.3 Build vs Runtime Config (B)

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

## 11. Performance

### 11.1 Database Indexes (A)

Index all frequently queried columns. See [4.4 Database Indexes](#44-database-indexes-a).

---

### 11.2 Lazy Loading (B)

Use dynamic imports for heavy modules:

```typescript
const { sql } = await import('@/lib/databaseAdapter');
```

**Status:** Applied in some places, not systematic.

---

### 11.3 Response Caching (B)

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
| **(A)** | 45 | Maintain |
| **(B)** | 3 | Improve |
| **(C)** | 0 | ✅ All refactored |

### Completed Improvements ✅

1. ~~**[C] Split `secureDatabase.ts`**~~ - Refactored into repositories/services
2. ~~**[B] Standardize API responses**~~ - Created `lib/api/responses.ts`
3. ~~**[B] Create validation utilities**~~ - Created `lib/validation/validators.ts`
4. ~~**[B] Define constants**~~ - Created `lib/constants.ts`
5. ~~**[B] Rate limiting**~~ - Implemented on all auth endpoints
6. ~~**[B] CSRF protection**~~ - Implemented for bracket operations
7. ~~**[B] XSS prevention**~~ - Added escaping in email templates
8. ~~**[B] Test helpers centralization**~~ - Consolidated into `tests/fixtures/` with documented utilities
9. ~~**[B] Security testing**~~ - Added comprehensive penetration test suite (`security.spec.ts`)
10. ~~**[B] CI/CD testing integration**~~ - GitHub Actions workflows with caching and parallelization

### Remaining Improvements

1. ~~**[B] Stable locators** - Add more `data-testid` attributes to components~~ ✅ **Completed** - See Section 7.7
2. **[B] Auto-wait cleanup** - Remove remaining `waitForTimeout` calls where possible
3. **[B] Lazy loading** - Apply dynamic imports more systematically

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
| 2026-02-21 | **Security:** Added CSRF protection, rate limiting, XSS prevention | Security Auditor |
| 2026-02-21 | **Expanded Security Section:** Added section ownership, CSRF, XSS, command injection standards | Architect |
| 2026-02-21 | **Expanded Testing Section:** Added section ownership, test types, API/E2E standards, checklists | Architect |
| 2026-02-21 | **Security Review:** Added rate limit configurations table, added Information Disclosure Prevention | Security Auditor |
| 2026-02-21 | **Testing Review:** Complete rewrite with accurate file structure, Security Testing Standards, CI/CD Integration | QA Engineer |
| 2026-02-21 | **Added Section 1 (Tech Stack):** New dedicated section for approved technologies, PDF generation tools, selection guidelines | Architect |
| 2026-02-21 | **Rate Limiting Update:** Documented environment-aware limits (10x relaxed for staging/preview) | Security Auditor |
| 2026-02-21 | **Added 2.0 Environment-Aware Security Controls:** Foundational pattern for balancing security with testability | Security Auditor |
| 2026-02-21 | **Admin Export Feature:** Updated `/api/admin/brackets/export` with new 74-column CSV format, status-based sorting | Architect |
| 2026-02-21 | **API Migration Complete:** All 17 API routes now use modular imports (repositories, services, migrations) | Architect |
| 2026-02-21 | **Test ID Coverage:** Added data-testid attributes for stable Playwright locators (logout, new-bracket, entry-name, tiebreaker, copy/email/delete buttons, delete dialog) | Architect |
| 2026-02-22 | **Test Updates:** Migrated E2E tests to use data-testid locators (sign-out.spec.ts, bracket-full-workflow.spec.ts, bracket-interaction.spec.ts); Added data-testid to Testing Checklist | QA Engineer |

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
