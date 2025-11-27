# CI/CD Execution Guide

## Where Can You Execute Tests?

### 1. Local Terminal / PowerShell ✅

**Windows PowerShell:**
```powershell
# Set environment
$env:TEST_ENV='staging'

# Run group
node scripts/run-test-by-id.js connect
npm run test:connect

# Run individual test
node scripts/run-test-by-id.js 1.1
node scripts/run-test-by-id.js homepage
```

**Linux/Mac Terminal:**
```bash
# Set environment
export TEST_ENV=staging

# Run group
node scripts/run-test-by-id.js connect
npm run test:connect

# Run individual test
node scripts/run-test-by-id.js 1.1
node scripts/run-test-by-id.js homepage
```

### 2. GitHub Actions (CI/CD) ✅

**Yes!** You can execute groups or individual tests through GitHub Actions workflows.

## Current Workflows

You already have 3 workflows that run tests:

1. **`test-health.yml`** - Runs health checks (Group 1)
2. **`test-smoke.yml`** - Runs smoke tests (Groups 3 + 4)
3. **`test-full-regression.yml`** - Runs all tests

## How to Use Organized Groups in CI/CD

### Example 1: Run Group 1 (Connect) in GitHub Actions

Create or update `.github/workflows/test-connect.yml`:

```yaml
name: Connectivity Tests

on:
  workflow_dispatch:  # Manual trigger
  push:
    branches:
      - staging
      - main

jobs:
  test-connect:
    name: Group 1 - Connectivity Tests
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      
      - name: Run Group 1 (Connect) tests
        env:
          TEST_ENV: staging
        run: npm run test:connect
        # OR: node scripts/run-test-by-id.js connect
        # OR: node scripts/run-test-by-id.js 1
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: connect-test-report
          path: playwright-report/
```

### Example 2: Run Individual Test in GitHub Actions

Create `.github/workflows/test-single.yml`:

```yaml
name: Single Test

on:
  workflow_dispatch:
    inputs:
      test_id:
        description: 'Test ID (e.g., 1.1, homepage, connect)'
        required: true
        type: string

jobs:
  test-single:
    name: Run Single Test
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      
      - name: Run test
        env:
          TEST_ENV: staging
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD_STAGING: ${{ secrets.TEST_USER_PASSWORD_STAGING }}
        run: node scripts/run-test-by-id.js ${{ github.event.inputs.test_id }}
```

### Example 3: Run Multiple Groups in Sequence

Create `.github/workflows/test-groups.yml`:

```yaml
name: Test Groups

on:
  workflow_dispatch:
    inputs:
      groups:
        description: 'Comma-separated group IDs (e.g., 1,2,3 or connect,account,auth)'
        required: true
        type: string

jobs:
  test-groups:
    name: Run Test Groups
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      
      - name: Run test groups
        env:
          TEST_ENV: staging
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD_STAGING: ${{ secrets.TEST_USER_PASSWORD_STAGING }}
        run: |
          IFS=',' read -ra GROUPS <<< "${{ github.event.inputs.groups }}"
          for group in "${GROUPS[@]}"; do
            echo "Running group: $group"
            node scripts/run-test-by-id.js "$group"
          done
```

## Updating Existing Workflows

### Update `test-health.yml` to Use Group System

**Current (line 45):**
```yaml
run: npm run test:health
```

**Updated (using organized system):**
```yaml
run: npm run test:connect
# OR
run: node scripts/run-test-by-id.js 1
# OR
run: node scripts/run-test-by-id.js connect
```

All three commands do the same thing (run Group 1).

### Update `test-smoke.yml` to Use Group System

**Current (line 60):**
```yaml
run: npm run test:smoke
```

**Updated (using organized system):**
```yaml
run: |
  node scripts/run-test-by-id.js auth
  node scripts/run-test-by-id.js bracket
# OR create a new npm script: test:smoke that runs groups 3 and 4
```

## Workflow Trigger Options

### 1. Manual Trigger (workflow_dispatch)
```yaml
on:
  workflow_dispatch:
    inputs:
      test_group:
        description: 'Test group to run'
        required: true
        type: choice
        options:
          - '1'
          - '2'
          - '3'
          - '4'
          - '5'
          - 'connect'
          - 'account'
          - 'auth'
          - 'bracket'
          - 'api'
```

### 2. On Push to Branch
```yaml
on:
  push:
    branches:
      - staging
      - main
```

### 3. On Pull Request
```yaml
on:
  pull_request:
    branches:
      - staging
      - main
```

### 4. Scheduled (Cron)
```yaml
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
```

### 5. On Tag/Release
```yaml
on:
  push:
    tags:
      - 'v*'  # Version tags
```

## Complete Example: Run Any Group via Manual Trigger

Create `.github/workflows/test-group.yml`:

```yaml
name: Test Group Runner

on:
  workflow_dispatch:
    inputs:
      group:
        description: 'Group to test (1-5 or abbreviation)'
        required: true
        type: choice
        options:
          - '1'
          - '2'
          - '3'
          - '4'
          - '5'
          - 'connect'
          - 'account'
          - 'auth'
          - 'bracket'
          - 'api'
      environment:
        description: 'Environment to test against'
        required: true
        type: choice
        options:
          - 'staging'
          - 'production'
      browser:
        description: 'Browser to use'
        required: false
        type: choice
        options:
          - 'chromium'
          - 'firefox'
          - 'all'

jobs:
  test-group:
    name: Test Group ${{ github.event.inputs.group }}
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: |
          if [ "${{ github.event.inputs.browser }}" == "all" ] || [ -z "${{ github.event.inputs.browser }}" ]; then
            npx playwright install --with-deps chromium firefox
          else
            npx playwright install --with-deps ${{ github.event.inputs.browser }}
          fi
      
      - name: Run test group
        env:
          TEST_ENV: ${{ github.event.inputs.environment }}
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD_STAGING: ${{ secrets.TEST_USER_PASSWORD_STAGING }}
          TEST_USER_PASSWORD_PRODUCTION: ${{ secrets.TEST_USER_PASSWORD_PRODUCTION }}
        run: |
          if [ -n "${{ github.event.inputs.browser }}" ] && [ "${{ github.event.inputs.browser }}" != "all" ]; then
            node scripts/run-test-by-id.js ${{ github.event.inputs.group }} --project=${{ github.event.inputs.browser }}
          else
            node scripts/run-test-by-id.js ${{ github.event.inputs.group }}
          fi
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-group-${{ github.event.inputs.group }}-report
          path: playwright-report/
          retention-days: 7
```

## Summary

### Where to Execute:

| Location | Command Format | Example |
|----------|---------------|---------|
| **PowerShell** | `node scripts/run-test-by-id.js <id>` | `node scripts/run-test-by-id.js connect` |
| **Terminal** | `node scripts/run-test-by-id.js <id>` | `node scripts/run-test-by-id.js 1` |
| **GitHub Actions** | Same commands in workflow YAML | `run: node scripts/run-test-by-id.js connect` |
| **npm Scripts** | `npm run test:<abbreviation>` | `npm run test:connect` |

### Key Points:

1. ✅ **Same commands work everywhere** - Local, CI/CD, anywhere Node.js runs
2. ✅ **Use group numbers/abbreviations** - Don't reference file names
3. ✅ **GitHub Actions can run any group** - Via workflow_dispatch or automated triggers
4. ✅ **Individual tests work too** - Use test numbers like `1.1` or abbreviations like `homepage`


