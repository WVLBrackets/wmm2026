# Troubleshooting script for sign-in test failures
# This script will help debug the authentication test issues

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Sign-In Test Troubleshooting" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if environment variables are set
Write-Host "Step 1: Checking environment variables..." -ForegroundColor Yellow
Write-Host ""

if (-not $env:TEST_USER_EMAIL) {
    Write-Host "❌ TEST_USER_EMAIL is NOT SET" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set it:" -ForegroundColor Yellow
    Write-Host '  $env:TEST_USER_EMAIL="thewarren@gmail.com"' -ForegroundColor White
    Write-Host ""
    exit 1
} else {
    Write-Host "✅ TEST_USER_EMAIL is SET: $env:TEST_USER_EMAIL" -ForegroundColor Green
}

if (-not $env:TEST_USER_PASSWORD_STAGING) {
    Write-Host "❌ TEST_USER_PASSWORD_STAGING is NOT SET" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set it:" -ForegroundColor Yellow
    Write-Host '  $env:TEST_USER_PASSWORD_STAGING="your-staging-password"' -ForegroundColor White
    Write-Host ""
    Write-Host "Or edit and run: .\tests\SETUP_ENV_VARS.ps1" -ForegroundColor Yellow
    Write-Host ""
    exit 1
} else {
    Write-Host "✅ TEST_USER_PASSWORD_STAGING is SET" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 2: Running test in headed mode (visible browser)..." -ForegroundColor Yellow
Write-Host "This will open a browser so you can see what's happening." -ForegroundColor Gray
Write-Host ""

# Step 2: Run test in headed mode
npx playwright test tests/e2e/authentication.spec.ts -g "should sign in with valid credentials" --project=chromium --headed

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Troubleshooting Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "What to look for:" -ForegroundColor Yellow
Write-Host "  1. Does the sign-in form fill correctly?" -ForegroundColor White
Write-Host "  2. Does it submit?" -ForegroundColor White
Write-Host "  3. Does it show an error message?" -ForegroundColor White
Write-Host "  4. Does it redirect? Where?" -ForegroundColor White
Write-Host ""
Write-Host "If you see an error message, note what it says." -ForegroundColor Yellow
Write-Host ""




