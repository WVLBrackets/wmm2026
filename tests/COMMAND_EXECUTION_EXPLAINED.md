# Command Execution Explained

## Are `node scripts/run-test-by-id.js connect` and `npm run test:connect` the same?

**Yes, they are synonyms!** `npm run test:connect` is just a shortcut that calls the same command.

## Step-by-Step Execution

### Command 1: `node scripts/run-test-by-id.js connect`

**Step 1:** You type the command
```bash
node scripts/run-test-by-id.js connect
```

**Step 2:** Node.js executes the script
- Reads `scripts/run-test-by-id.js`
- Passes `"connect"` as the first argument (`process.argv[2]`)

**Step 3:** Script looks up `"connect"` in `groupMapping`
```javascript
const groupMapping = {
  'connect': 'tests/simple-test.spec.ts',  // ← Found it!
  // ... other mappings
};
```

**Step 4:** Script builds the Playwright command
```javascript
const filePattern = 'tests/simple-test.spec.ts';
const env = process.env.TEST_ENV || 'staging';
const command = `npx cross-env TEST_ENV=${env} npx playwright test ${filePattern}`;
// Result: "npx cross-env TEST_ENV=staging npx playwright test tests/simple-test.spec.ts"
```

**Step 5:** Script displays what it's doing
```
📋 Running Group connect (1)
   Files: tests/simple-test.spec.ts
   Environment: staging
```

**Step 6:** Script executes the command
- Runs: `npx cross-env TEST_ENV=staging npx playwright test tests/simple-test.spec.ts`
- This runs Playwright with the specified file
- Playwright runs all 5 tests in `simple-test.spec.ts`

**Final Result:** All tests in Group 1 (connect) are executed.

---

### Command 2: `npm run test:connect`

**Step 1:** You type the command
```bash
npm run test:connect
```

**Step 2:** npm looks up the script in `package.json`
```json
{
  "scripts": {
    "test:connect": "node scripts/run-test-by-id.js connect"  // ← Found it!
  }
}
```

**Step 3:** npm executes the script definition
- Runs: `node scripts/run-test-by-id.js connect`
- **This is exactly the same as Command 1!**

**Step 4-6:** Same as Command 1 (Steps 3-6 above)

**Final Result:** Identical to Command 1 - all tests in Group 1 (connect) are executed.

---

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Command: npm run test:connect                           │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ package.json looks up "test:connect"                    │
│ Finds: "node scripts/run-test-by-id.js connect"        │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Executes: node scripts/run-test-by-id.js connect       │
│ (This is the SAME as typing it directly!)              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ run-test-by-id.js receives "connect"                   │
│ Looks up in groupMapping                                │
│ Finds: 'tests/simple-test.spec.ts'                     │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Builds command:                                          │
│ npx cross-env TEST_ENV=staging npx playwright test      │
│   tests/simple-test.spec.ts                             │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Playwright runs 5 tests from simple-test.spec.ts        │
│ ✓ Load homepage                                         │
│ ✓ Load signup page                                      │
│ ✓ Load signin page                                      │
│ ✓ Navigate signup to signin                             │
│ ✓ Navigate signin to signup                             │
└─────────────────────────────────────────────────────────┘
```

## Key Points

### 1. They Are Identical
- `npm run test:connect` = `node scripts/run-test-by-id.js connect`
- npm scripts are just shortcuts defined in `package.json`

### 2. Why Use npm Scripts?
**Advantages:**
- ✅ Shorter to type: `npm run test:connect` vs `node scripts/run-test-by-id.js connect`
- ✅ Consistent with other npm commands
- ✅ Can be used in CI/CD pipelines easily
- ✅ Works the same on all platforms

**When to use direct command:**
- When you need to pass additional arguments: `node scripts/run-test-by-id.js connect --project=chromium`
- When debugging the script itself
- When npm isn't available (rare)

### 3. The Mapping Chain

```
User Command
    ↓
npm script (package.json)
    ↓
Helper Script (run-test-by-id.js)
    ↓
Group Mapping (connect → simple-test.spec.ts)
    ↓
Playwright Command
    ↓
Test Execution
```

## Other Examples

### Using Group Number
```bash
# These are all equivalent:
npm run test:group:1
node scripts/run-test-by-id.js 1
node scripts/run-test-by-id.js connect
npm run test:connect
```

All four commands:
1. Map to Group 1
2. Execute `tests/simple-test.spec.ts`
3. Run the same 5 tests

### With Additional Arguments
```bash
# Only works with direct command (for now):
node scripts/run-test-by-id.js connect --project=chromium

# npm script doesn't support extra args (yet):
npm run test:connect --project=chromium  # ❌ Won't work
```

**Note:** We could update npm scripts to support this, but for now, use the direct command when you need extra Playwright arguments.

## Summary

| Command | What It Does | When to Use |
|---------|--------------|-------------|
| `npm run test:connect` | Shortcut that calls the helper script | Daily use, CI/CD |
| `node scripts/run-test-by-id.js connect` | Direct execution of helper script | When you need extra args, debugging |
| Both are synonyms | They do exactly the same thing | Use whichever you prefer |

**Bottom line:** Use `npm run test:connect` for convenience, or `node scripts/run-test-by-id.js connect` when you need to pass additional Playwright arguments like `--project=chromium`.


