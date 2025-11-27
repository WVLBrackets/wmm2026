# Individual Test Scripts Reference

## Group 1: Basic Connectivity & Navigation (`connect`)

| Number | Name | Abbreviation | Description |
|--------|------|--------------|-------------|
| 1.1 | Load Homepage | `homepage` | Verifies the homepage loads correctly and is accessible. Checks that the page is not redirected to Vercel login and has meaningful content. |
| 1.2 | Load Signup Page | `signup-page` | Verifies the signup page loads with all required form fields visible. Ensures the page is accessible and form is ready for user input. |
| 1.3 | Load Signin Page | `signin-page` | Verifies the signin page loads with email and password fields visible. Ensures the authentication form is accessible. |
| 1.4 | Navigate Signup to Signin | `nav-up-in` | Tests clicking the "sign in to your existing account" link from signup page. Verifies navigation works correctly between auth pages. |
| 1.5 | Navigate Signin to Signup | `nav-in-up` | Tests clicking the "create a new account" link from signin page. Verifies navigation works correctly between auth pages. |

## Group 2: Account Creation & Validation (`account`)

| Number | Name | Abbreviation | Description |
|--------|------|--------------|-------------|
| 2.1 | Display Signup Form Fields | `form-fields` | Verifies all required signup form fields are visible and accessible. Checks name, email, password, and confirm password inputs are present. |
| 2.2 | Validate Required Fields | `req-fields` | Tests HTML5 required field validation prevents submission of empty form. Verifies all fields have required attributes. |
| 2.3 | Validate Email Format | `email-format` | Tests email format validation prevents invalid email addresses. Verifies browser HTML5 email validation works. |
| 2.4 | Validate Password Length | `pwd-length` | Tests password minimum length validation (6 characters). Verifies error message appears for passwords that are too short. |
| 2.5 | Accept Minimum Password | `pwd-min-ok` | Verifies password with exactly 6 characters is accepted. Tests the minimum password length requirement boundary. |
| 2.6 | Validate Password Match | `pwd-match` | Tests password confirmation must match the password field. Verifies error appears when passwords don't match. |
| 2.7 | Prevent Short Password Submit | `pwd-short` | Prevents form submission when password is less than 6 characters. Verifies client-side validation blocks API call. |
| 2.8 | Prevent Mismatched Passwords | `pwd-mismatch` | Prevents form submission when passwords don't match. Verifies client-side validation blocks API call. |
| 2.9 | Handle Special Characters Name | `name-special` | Tests account creation with special characters in name (apostrophes, hyphens). Verifies names with punctuation are accepted. |
| 2.10 | Handle Long Email Address | `email-long` | Tests account creation with very long email addresses. Verifies system handles edge cases for email length. |
| 2.11 | Disable Submit While Loading | `submit-load` | Verifies submit button is disabled and shows loading state during account creation. Tests UI feedback during async operations. |
| 2.12 | Toggle Password Visibility | `pwd-toggle` | Tests password show/hide toggle button functionality. Verifies users can reveal password text when needed. |
| 2.13 | Create Account Successfully | `create-ok` | Creates a new user account with valid data via UI. Verifies success message appears and account is created. |
| 2.14 | Prevent Duplicate Email UI | `dup-email-ui` | Prevents duplicate email registration via UI form. Verifies 409 status code and error handling for existing emails. |
| 2.15 | Navigate Signup to Signin | `nav-up-in2` | Tests navigation from signup page to signin page via link. Verifies users can switch between auth pages. |
| 2.16 | Create User Success Message | `create-msg` | Creates account and verifies success message displays correctly. Tests UI feedback after successful registration. |
| 2.17 | Prevent Duplicate During Signup | `dup-signup` | Prevents duplicate email registration during signup flow. Verifies error handling in UI when email exists. |
| 2.18 | Display Invalid Token Page | `token-inv-page` | Tests confirmation page displays error for invalid token. Verifies UI handles invalid confirmation tokens. |
| 2.19 | Display Missing Token Page | `token-miss-page` | Tests confirmation page displays error when token is missing. Verifies UI handles missing confirmation tokens. |
| 2.20 | Navigate Success to Signin | `nav-success` | Tests navigation from signup success page to signin page. Verifies post-registration flow works correctly. |

## Group 3: User Authentication & Session (`auth`)

| Number | Name | Abbreviation | Description |
|--------|------|--------------|-------------|
| 3.1 | Sign In Valid Credentials | `signin-ok` | Signs in with valid test user credentials. Verifies successful authentication and access to protected routes. |
| 3.2 | Show Error Invalid Email | `signin-bad-email` | Attempts sign-in with non-existent email address. Verifies error message appears and user stays on signin page. |
| 3.3 | Show Error Invalid Password | `signin-bad-pwd` | Attempts sign-in with wrong password for valid email. Verifies error message appears for incorrect credentials. |
| 3.4 | Maintain Session After Refresh | `session-refresh` | Verifies user session persists after page refresh. Tests that authentication state is maintained across page reloads. |
| 3.5 | Redirect Unauthenticated Users | `protect-route` | Tests that accessing protected routes without authentication redirects to signin. Verifies route protection works correctly. |
| 3.6 | Navigate Signin to Signup | `nav-in-up2` | Tests navigation link from signin page to signup page. Verifies users can switch to account creation flow. |
| 3.7 | Navigate Signup to Signin | `nav-up-in3` | Tests navigation link from signup page to signin page. Verifies users can switch to authentication flow. |

## Group 4: Bracket Creation & Management (`bracket`)

| Number | Name | Abbreviation | Description |
|--------|------|--------------|-------------|
| 4.1 | Navigate Bracket Landing Page | `bracket-land` | Verifies bracket landing page loads after authentication. Tests that users can access bracket management interface. |
| 4.2 | Create New Bracket | `bracket-new` | Creates a new bracket with entry name and saves it. Verifies bracket creation flow works end-to-end for authenticated users. |
| 4.3 | Save Bracket with Validation | `bracket-save` | Tests saving bracket with server-side validation. Verifies API accepts or rejects bracket saves based on validation rules. |

## Group 5: Backend API Validation (`api`)

| Number | Name | Abbreviation | Description |
|--------|------|--------------|-------------|
| 5.1 | Create User API Success | `api-create` | API test: Creates user account via POST /api/auth/register. Verifies API endpoint works correctly without UI. |
| 5.2 | Reject Missing Fields API | `api-missing2` | API test: Rejects registration with missing required fields. Verifies backend validation returns appropriate error. |
| 5.3 | Reject Short Password API | `api-pwd-short2` | API test: Rejects password less than 6 characters. Verifies backend enforces password length requirements. |
| 5.4 | Reject Duplicate Email API | `api-dup-email2` | API test: Rejects duplicate email registration. Verifies backend prevents duplicate accounts. |
| 5.5 | Reject Invalid Email API | `api-inv-email2` | API test: Rejects invalid email format. Verifies backend email validation works. |
| 5.6 | Return User ID on Success | `api-userid2` | API test: Verifies userId returned in response. Tests API response structure and data. |
| 5.7 | Require Email Confirmation | `api-confirm-req2` | API test: Verifies confirmation message in response. Tests that API indicates email confirmation needed. |
| 5.8 | Reject Invalid Confirmation Token | `api-token-inv2` | API test: Rejects confirmation with invalid token. Verifies backend token validation and error handling. |
| 5.9 | Reject Missing Confirmation Token | `api-token-miss2` | API test: Rejects confirmation without token. Verifies backend requires token parameter for confirmation. |

## Running Individual Tests

### Method 1: Using Helper Script (Recommended)
```bash
# Run by number
node scripts/run-test-by-id.js 1.1          # Test 1.1 (Load Homepage)
node scripts/run-test-by-id.js 3.1          # Test 3.1 (Sign In Valid Credentials)
node scripts/run-test-by-id.js 4.2          # Test 4.2 (Create New Bracket)

# Run by abbreviation
node scripts/run-test-by-id.js homepage     # Test 1.1
node scripts/run-test-by-id.js signin-ok    # Test 3.1
node scripts/run-test-by-id.js bracket-new  # Test 4.2

# Run groups
node scripts/run-test-by-id.js 1            # Group 1 (connect)
node scripts/run-test-by-id.js connect      # Group 1 (by abbreviation)
node scripts/run-test-by-id.js 3            # Group 3 (auth)
node scripts/run-test-by-id.js auth         # Group 3 (by abbreviation)

# With environment (set TEST_ENV before running)
cross-env TEST_ENV=production node scripts/run-test-by-id.js 1.1
cross-env TEST_ENV=staging node scripts/run-test-by-id.js signin-ok
```

### Method 2: Using npm Scripts (Key Tests Only)
```bash
# Some common tests have npm scripts
npm run test:1.1          # Test 1.1 (Load Homepage)
npm run test:homepage     # Test 1.1 (by abbreviation)
npm run test:3.1          # Test 3.1 (Sign In Valid Credentials)
npm run test:signin-ok    # Test 3.1 (by abbreviation)
npm run test:4.2          # Test 4.2 (Create New Bracket)
npm run test:bracket-new  # Test 4.2 (by abbreviation)
```

### Method 3: Direct Playwright (Original Method)
```bash
# Run by original test name pattern
npx playwright test -g "should load the homepage"
npx playwright test -g "should sign in with valid credentials"

# With environment
cross-env TEST_ENV=staging npx playwright test -g "should load the homepage"
cross-env TEST_ENV=production npx playwright test -g "should sign in with valid credentials"
```

### Method 4: Run Groups via npm Scripts
```bash
# By group number
npm run test:group:1      # Group 1 (connect)
npm run test:group:2      # Group 2 (account)
npm run test:group:3      # Group 3 (auth)
npm run test:group:4      # Group 4 (bracket)
npm run test:group:5      # Group 5 (api)

# By group abbreviation
npm run test:connect      # Group 1
npm run test:account      # Group 2
npm run test:auth         # Group 3
npm run test:bracket      # Group 4
npm run test:api          # Group 5
```

## Test Count by Group

| Group | Tests | Files |
|-------|-------|-------|
| 1. connect | 5 | 1 |
| 2. account | 20 | 3 |
| 3. auth | 7 | 1 |
| 4. bracket | 3 | 1 |
| 5. api | 9 | 1 |
| **Total** | **44** | **7** |

*Note: Each test appears in only one group. API tests are in Group 5 only.*

