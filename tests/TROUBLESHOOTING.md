# Troubleshooting Playwright Tests

## Issue: Tests Appear to Hang

If `npm run test:ui` seems to hang, try these solutions:

### Solution 1: Start Dev Server Manually First

1. **Open a new PowerShell window** and start the dev server:
   ```powershell
   npm run dev
   ```
   
2. Wait until you see:
   ```
   ✓ Ready in X seconds
   ○ Local: http://localhost:3000
   ```

3. **Keep that window open**, then in a **different PowerShell window**, run:
   ```powershell
   npm run test:ui
   ```

### Solution 2: Run Tests Without UI Mode First

To see error messages, try running tests in regular mode:

```powershell
npm test
```

This will show you any errors that might be preventing the UI from starting.

### Solution 3: Check if Browser Window Opened

The Playwright UI opens in a browser window. Check:
- Your taskbar for a new browser window
- Alt+Tab to see all open windows
- The browser might be minimized

### Solution 4: Increase Timeout

If your dev server takes a long time to start, you can increase the timeout in `playwright.config.ts`:

```typescript
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,
  timeout: 300 * 1000, // Increase from 120 to 300 seconds
},
```

### Solution 5: Run API Tests Only (No Server Needed)

API tests don't need the dev server. Try:

```powershell
npm run test:api
```

If this works, the issue is with the dev server startup.

## Common Error Messages

### "Port 3000 is already in use"
**Solution:** Stop any existing dev server or change the port.

### "Cannot find module"
**Solution:** Run `npm install` to ensure all dependencies are installed.

### "Browser not found"
**Solution:** Run `npx playwright install` to install browsers.

## Still Having Issues?

1. Check that Node.js is installed: `node --version`
2. Check that npm is installed: `npm --version`
3. Make sure you're in the project directory
4. Try running `npm install` again to ensure dependencies are up to date

