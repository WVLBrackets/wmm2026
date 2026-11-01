# Local Development Code Removal Recommendations

## Overview
Since local development is no longer being used, we can significantly simplify the codebase by removing all local-specific code. This will reduce complexity and maintenance burden.

---

## 🗑️ Files to Delete Entirely

### 1. `src/lib/localPostgres.ts`
**Status:** ✅ **DELETE ENTIRELY**
- **Reason:** This entire file is only used for local PostgreSQL connections
- **Impact:** Used by `databaseAdapter.ts` and `teamDataConnection.ts` when `environment === 'development'`
- **Dependencies:** None (will be removed from imports)

---

## 🔧 Files Requiring Code Removal

### 2. `src/lib/databaseAdapter.ts`
**Status:** ✅ **SIMPLIFY**
- **Current:** Has conditional logic to use `localPostgres` for development, `@vercel/postgres` for preview/production
- **Change:** Remove development branch, always use `@vercel/postgres`
- **Lines to remove:** 16-19 (development branch)
- **Lines to simplify:** 36-45 (`getDatabaseInfo` function - remove development references)

**After:**
```typescript
async function getSqlAdapter(): Promise<SqlFunction> {
  if (!sqlAdapter) {
    // Always use Vercel Postgres (Neon)
    const { sql } = await import('@vercel/postgres');
    sqlAdapter = sql as SqlFunction;
  }
  return sqlAdapter;
}
```

---

### 3. `src/lib/databaseConfig.ts`
**Status:** ✅ **SIMPLIFY**
- **Current:** Detects `NODE_ENV === 'development'` and uses `DATABASE_URL_LOCAL`
- **Change:** Remove development detection, only handle `preview` and `production`
- **Lines to remove:** 16-25 (development branch)
- **Lines to update:** 49-63 (remove `isDevelopment()` function, simplify environment detection)

**After:**
```typescript
export function getDatabaseConfig(): DatabaseConfig {
  const vercelEnv = process.env.VERCEL_ENV;
  
  let environment: string;
  let connectionString: string;
  let database: string;
  
  if (vercelEnv === 'preview') {
    // Vercel preview/staging
    environment = 'preview';
    connectionString = process.env.POSTGRES_URL || '';
    database = `wmm2026_preview_${process.env.VERCEL_GIT_COMMIT_SHA || 'unknown'}`;
  } else {
    // Production (default)
    environment = 'production';
    connectionString = process.env.POSTGRES_URL || '';
    database = 'wmm2026_prod';
  }
  
  if (!connectionString) {
    throw new Error(`Database connection string not configured for environment: ${environment}`);
  }
  
  return {
    connectionString,
    environment,
    database
  };
}
```

**Remove functions:**
- `isDevelopment()` - no longer needed

---

### 4. `src/lib/teamDataConnection.ts`
**Status:** ✅ **SIMPLIFY**
- **Current:** Has conditional logic to use `localPostgres` for development
- **Change:** Remove development branch, always use production database connection
- **Lines to remove:** 22-25 (development branch)
- **Lines to update:** 12-17 (update comments)

**After:**
```typescript
async function getTeamDataSqlAdapter(): Promise<SqlFunction> {
  if (!teamDataSqlAdapter) {
    // Always use production database connection
    // In staging, POSTGRES_URL_PROD points to prod DB
    // In production, POSTGRES_URL_PROD should equal POSTGRES_URL (or we use POSTGRES_URL)
    const postgresUrl = process.env.POSTGRES_URL_PROD || process.env.POSTGRES_URL;
    
    if (!postgresUrl) {
      throw new Error('POSTGRES_URL_PROD or POSTGRES_URL environment variable is not set for team data');
    }
    
    // Use pg Pool for cross-environment connection (works for Neon/Vercel Postgres)
    const { Pool } = await import('pg');
    teamDataPool = new Pool({
      connectionString: postgresUrl,
      ssl: { rejectUnauthorized: false }, // Required for Neon/Vercel Postgres
      max: 5, // Limit connection pool size
    });
    
    // Create SQL function that uses parameterized queries
    teamDataSqlAdapter = async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (!teamDataPool) {
        throw new Error('Team data pool not initialized');
      }
      
      // Build query with parameterized placeholders ($1, $2, etc.)
      let query = strings[0];
      for (let i = 0; i < values.length; i++) {
        query += `$${i + 1}` + strings[i + 1];
      }
      
      return teamDataPool.query(query, values);
    };
  }
  
  return teamDataSqlAdapter;
}
```

---

### 5. `src/lib/secureDatabase.ts`
**Status:** ✅ **REMOVE AUTO-CONFIRMATION LOGIC**
- **Current:** Auto-confirms users in development mode (lines 283-316)
- **Change:** Remove auto-confirmation, always require email confirmation
- **Lines to remove:** 283-316 (all auto-confirmation logic)

**After:**
```typescript
// Remove isDevelopment check, always require confirmation
const confirmationToken = crypto.randomBytes(32).toString('hex');
const confirmationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

const userId = crypto.randomUUID();

// Insert user with environment
await sql`
  INSERT INTO users (
    id, email, name, password, email_confirmed,
    confirmation_token, confirmation_expires, environment
  ) VALUES (
    ${userId}, ${email}, ${name}, ${hashedPassword}, false,
    ${confirmationToken}, 
    ${confirmationExpires.toISOString()},
    ${environment}
  )
`;

// Always store confirmation token
await sql`
  INSERT INTO tokens (token, user_id, expires, type, environment)
  VALUES (${confirmationToken}, ${userId}, ${confirmationExpires.toISOString()}, 'confirmation', ${environment})
`;

return {
  id: userId,
  email,
  name,
  password: hashedPassword,
  emailConfirmed: false,
  confirmationToken,
  confirmationExpires,
  environment,
  createdAt: new Date(),
};
```

---

### 6. `src/lib/emailService.ts`
**Status:** ✅ **REMOVE CONSOLE LOGGING**
- **Current:** Returns early with console logging in development mode (lines 51-56)
- **Change:**** Remove development check, always use email service
- **Lines to remove:** 51-56 (development console logging)
- **Lines to update:** 257, 409 (remove `|| 'development'` fallback)

**After:**
```typescript
async function getEmailProvider() {
  // Check if email is configured
  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
    // In production without email config, disable email service
    return {
      provider: 'disabled',
    };
  }

  // Use Resend for email
  return {
    provider: 'resend',
  };
}
```

---

### 7. `src/lib/auth.ts`
**Status:** ✅ **REMOVE FALLBACK SECRET**
- **Current:** Has fallback secret for development (line 137)
- **Change:** Require NEXTAUTH_SECRET, throw error if missing
- **Lines to update:** 137

**After:**
```typescript
secret: process.env.NEXTAUTH_SECRET || (() => {
  throw new Error('NEXTAUTH_SECRET environment variable is required');
})(),
```

---

### 8. `src/app/api/auth/register/route.ts`
**Status:** ✅ **REMOVE AUTO-CONFIRMATION & LOCALHOST URLS**
- **Current:** Auto-confirms users in development, uses localhost URLs
- **Change:** Remove development-specific logic
- **Lines to remove:** 45-56 (auto-confirmation)
- **Lines to update:** 68-98 (remove development URL handling, simplify to preview/production)

**After:**
```typescript
// Remove auto-confirmation logic entirely

// Determine base URL based on environment
const vercelEnv = process.env.VERCEL_ENV;
let baseUrl: string;

if (vercelEnv === 'production') {
  // Production: Use NEXTAUTH_URL which should be the production domain
  baseUrl = process.env.NEXTAUTH_URL || 'https://wmm2026.vercel.app';
  console.log(`[Register] Using production URL: ${baseUrl}`);
} else if (vercelEnv === 'preview') {
  // Preview: Use Host header to get the branch URL (stable across deployments)
  const host = request.headers.get('host');
  if (host) {
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    baseUrl = `${protocol}://${host}`;
    console.log(`[Register] Using preview branch URL from Host header: ${baseUrl}`);
  } else {
    // Fallback to VERCEL_URL if Host header not available
    baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXTAUTH_URL || 'https://wmm2026.vercel.app';
    console.log(`[Register] Using preview URL fallback: ${baseUrl}`);
  }
} else {
  // Fallback to production URL (should not happen in deployed environments)
  baseUrl = process.env.NEXTAUTH_URL || 'https://wmm2026.vercel.app';
  console.log(`[Register] Using fallback URL: ${baseUrl}`);
}
```

---

### 9. `src/app/api/auth/forgot-password/route.ts`
**Status:** ✅ **REMOVE DEVELOPMENT TOKEN RETURN & LOCALHOST URLS**
- **Current:** Returns token directly in development, uses localhost URLs
- **Change:** Remove development-specific logic
- **Lines to remove:** 35-50 (development token return)
- **Lines to update:** 50-72 (remove development URL handling)

**Similar changes as register route above**

---

### 10. `src/app/api/init-database/route.ts`
**Status:** ✅ **REMOVE DEVELOPMENT ERROR DETAILS**
- **Current:** Shows detailed error messages in development
- **Change:** Always return generic errors for security
- **Lines to update:** 32, 38, 70, 76 (remove `isDevelopment` checks and detailed error returns)

---

### 11. `src/app/api/admin/users/route.ts`
**Status:** ✅ **REMOVE DEVELOPMENT ERROR DETAILS**
- **Current:** Shows detailed error messages in development
- **Change:** Always return generic errors
- **Lines to update:** 40-41, 67-68, 86 (remove `isDevelopment` checks)

---

### 12. `src/app/api/email-status/route.ts`
**Status:** ✅ **REMOVE DEVELOPMENT STACK TRACES**
- **Current:** Includes stack traces in development
- **Change:** Never include stack traces
- **Lines to update:** 38, 42, 90, 94 (remove `isDevelopment` checks)

---

### 13. `src/app/api/check-admin/route.ts`
**Status:** ✅ **REMOVE DEVELOPMENT ERROR DETAILS**
- **Current:** Shows detailed errors in development
- **Change:** Always return generic errors
- **Lines to update:** 29 (remove `isDevelopment` check)

---

### 14. `src/app/api/bracket/email-pdf/route.ts`
**Status:** ✅ **REMOVE DEVELOPMENT ERROR DETAILS & LOCAL CHROME**
- **Current:** Returns detailed errors in staging/development, uses local Chrome
- **Change:** Remove development checks, always use Vercel Chrome
- **Lines to update:** 127-128 (remove staging/development check)
- **Lines to remove:** 235-285 (local Chrome executable path logic)

---

### 15. `src/app/admin/page.tsx`
**Status:** ✅ **REMOVE DEVELOPMENT CHECKS**
- **Current:** Hides Team Data tab in development (line 598, 1598)
- **Change:** Always show Team Data tab
- **Lines to remove:** 127 (state variable), 598 (detection logic), 1598 (conditional rendering)

**After:**
```typescript
// Remove isDevelopment state
// Remove hostname check
// Remove conditional rendering - always show Team Data tab
```

---

### 16. `src/components/DynamicNavigation.tsx`
**Status:** ✅ **SIMPLIFY PREVIEW DETECTION**
- **Current:** Checks `NODE_ENV === 'development'` and combines with preview
- **Change:** Only check for preview, remove development check
- **Lines to update:** 71, 84

**After:**
```typescript
// Detect preview/staging by checking if we're on a Vercel preview URL
const isPreview = typeof window !== 'undefined' && (
  window.location.hostname.includes('-git-') || 
  (window.location.hostname.includes('vercel.app') && 
   !window.location.hostname.startsWith('wmm2026') &&
   window.location.hostname.includes('.'))
);

// Use dev flag for preview/staging deployments
if (isPreview) {
  return siteConfig.showPicksDev === 'Yes';
}

// Use prod flag for production deployments only
return siteConfig.showPicksProd === 'Yes';
```

---

### 17. `src/app/bracket/page.tsx`
**Status:** ✅ **SIMPLIFY PREVIEW DETECTION**
- **Current:** Checks `NODE_ENV === 'development'` and combines with preview
- **Change:** Only check for preview, remove development check
- **Lines to update:** 51, 64

**Similar changes as DynamicNavigation.tsx**

---

### 18. `src/app/auth/signup/page.tsx`
**Status:** ✅ **REMOVE AUTO-CONFIRMATION CHECK**
- **Current:** Checks if user was auto-confirmed in development (line 74)
- **Change:** Remove this check (users will always need to confirm)
- **Lines to remove:** 74 (comment and related logic if any)

---

### 19. `src/app/auth/forgot-password/page.tsx`
**Status:** ✅ **REMOVE DEVELOPMENT TOKEN HANDLING**
- **Current:** Redirects directly to reset password with token in development (lines 36-37)
- **Change:** Always send email, never return token directly
- **Lines to remove:** 36-37 (development token handling)

---

### 20. `src/lib/database.ts` (if exists)
**Status:** ✅ **CHECK AND REMOVE**
- **Current:** May have development-specific logic
- **Action:** Review and remove any development checks

---

## 📝 Documentation Files to Update

### 21. `ENVIRONMENT_SETUP.md`
**Status:** ✅ **UPDATE**
- **Change:** Remove all references to development/local environment
- **Keep:** Preview and Production sections only

---

### 22. `TEAM_DATA_SETUP.md`
**Status:** ✅ **UPDATE**
- **Change:** Remove development section (lines 25-28)
- **Keep:** Preview and Production sections only

---

### 23. `env.example`
**Status:** ✅ **UPDATE**
- **Change:** Remove `DATABASE_URL_LOCAL` and any development-specific variables
- **Keep:** Only production/preview variables

---

## 📊 Summary

### Files to Delete: 1
- `src/lib/localPostgres.ts`

### Files to Modify: ~20
- Database adapters and configs: 4 files
- API routes: 8 files
- Components/pages: 5 files
- Library files: 3 files

### Documentation to Update: 3 files

### Estimated Lines of Code Removed: ~300-400 lines

### Benefits:
1. ✅ Simpler codebase - no environment branching
2. ✅ Easier maintenance - one code path
3. ✅ Reduced complexity - fewer conditionals
4. ✅ Better security - no development shortcuts
5. ✅ Clearer intent - code only handles preview/production

---

## ⚠️ Important Notes

1. **Environment Variables:** After removal, ensure `DATABASE_URL_LOCAL` is not referenced anywhere
2. **Testing:** All changes should be tested on staging before merging to main
3. **Database:** The `environment` column in database tables can still have 'development' values from old data, but new code won't create them
4. **Migration:** Consider if any database cleanup is needed for old development environment records

---

## 🚀 Implementation Order

1. **Phase 1:** Remove local-only files (`localPostgres.ts`)
2. **Phase 2:** Simplify database adapters and configs
3. **Phase 3:** Remove development logic from API routes
4. **Phase 4:** Update components and pages
5. **Phase 5:** Update documentation
6. **Phase 6:** Test on staging
7. **Phase 7:** Merge to main

---

## ✅ Verification Checklist

After implementation, verify:
- [ ] No references to `localPostgres` remain
- [ ] No references to `DATABASE_URL_LOCAL` remain
- [ ] No `NODE_ENV === 'development'` checks remain (except in build scripts if needed)
- [ ] All API routes work on staging
- [ ] Email confirmation always required
- [ ] Team Data tab always visible in admin
- [ ] Documentation updated
- [ ] Build succeeds without errors

