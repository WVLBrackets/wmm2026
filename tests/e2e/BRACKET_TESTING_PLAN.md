# Bracket Testing Plan

## Overview

This document outlines the plan for testing bracket creation, management, submission, and viewing functionality.

## Test Strategy

### Approach: API Authentication + Browser UI Testing

1. **Authenticate via API** (reliable, fast)
2. **Use browser for bracket interactions** (test real UI behavior)
3. **Focus on success/failure** (not specific error messages)
4. **Monitor API calls** (verify actions were allowed/blocked)

## Test Files to Create

### 1. `bracket-creation.spec.ts`
**Purpose:** Test creating new brackets

**Tests:**
- Navigate to bracket page (landing page)
- Click "New Bracket" button
- Fill in entry name
- Make some picks (simplified - just enough to test)
- Save draft bracket (PUT to `/api/tournament-bracket`)
- Verify bracket was saved
- Handle validation errors (missing entry name, etc.)

### 2. `bracket-management.spec.ts`
**Purpose:** Test editing, copying, and deleting brackets

**Tests:**
- View bracket list on landing page
- Edit existing draft bracket
- Copy existing bracket
- Delete bracket (with confirmation)
- Navigate between brackets

### 3. `bracket-submission.spec.ts`
**Purpose:** Test submitting brackets

**Tests:**
- Submit a complete bracket (POST to `/api/tournament-bracket`)
- Verify submission success
- Handle submission deadline (if past deadline, submission blocked)
- Verify bracket status changed to "submitted"

### 4. `bracket-viewing.spec.ts`
**Purpose:** Test viewing submitted brackets

**Tests:**
- View submitted bracket (read-only mode)
- Print bracket
- Email bracket PDF
- View bracket details

## Key User Flows to Test

### Flow 1: Create New Bracket
1. Sign in (via API)
2. Navigate to `/bracket` (landing page)
3. Click "New Bracket" button
4. Fill entry name
5. Make picks (simplified)
6. Save draft (PUT `/api/tournament-bracket`)
7. Verify saved

### Flow 2: Edit Existing Bracket
1. Sign in (via API)
2. Navigate to `/bracket` (landing page)
3. Click "Edit" on a draft bracket
4. Modify picks
5. Save changes (PUT `/api/tournament-bracket/{id}`)
6. Verify updated

### Flow 3: Submit Bracket
1. Sign in (via API)
2. Navigate to `/bracket` (landing page)
3. Click "Edit" on a draft bracket
4. Complete all picks
5. Submit (POST `/api/tournament-bracket`)
6. Verify submitted

## Test Data Strategy

### Minimal Bracket Data
- Don't create full 64-team brackets
- Use minimal picks (just enough to test functionality)
- Focus on testing the flow, not complete bracket data

### Entry Names
- Use unique names: `Test Bracket ${Date.now()}`
- Avoid conflicts with existing brackets

## API Endpoints to Monitor

- `PUT /api/tournament-bracket` - Save draft bracket
- `POST /api/tournament-bracket` - Submit bracket
- `PUT /api/tournament-bracket/{id}` - Update existing bracket
- `GET /api/tournament-bracket/{id}` - Get bracket details

## Selectors Strategy

Since there are no `data-testid` attributes, we'll use:
- Role-based selectors: `getByRole('button', { name: 'New Bracket' })`
- Text-based selectors: `getByText('New Bracket')`
- Form inputs: `getByLabelText()` or `getByPlaceholderText()`

## Implementation Priority

1. **bracket-creation.spec.ts** - Start here (most important)
2. **bracket-submission.spec.ts** - Next (completes the flow)
3. **bracket-management.spec.ts** - Then (edit, copy, delete)
4. **bracket-viewing.spec.ts** - Last (viewing features)

## Next Steps

1. Create `bracket-creation.spec.ts` with basic tests
2. Test creating a new bracket
3. Test saving a draft
4. Expand to other bracket operations




