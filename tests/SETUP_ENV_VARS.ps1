# PowerShell script to set test environment variables
# 
# Usage:
#   1. Edit the passwords below with your actual passwords
#   2. Run: .\tests\SETUP_ENV_VARS.ps1
#   3. Then run: npx playwright test tests/e2e/authentication.spec.ts
#
# Note: These variables are only for the current PowerShell session.
# They will be lost when you close PowerShell.

# ============================================
# CONFIGURATION - EDIT THESE VALUES
# ============================================

# Test user email (same for both environments)
$env:TEST_USER_EMAIL = "thewarren@gmail.com"

# Staging password (for preview/staging environment - DEFAULT)
$env:TEST_USER_PASSWORD_STAGING = "YOUR_STAGING_PASSWORD_HERE"

# Production password (only used when TEST_ENV=production)
$env:TEST_USER_PASSWORD_PRODUCTION = "YOUR_PRODUCTION_PASSWORD_HERE"

# Optional: Display name
$env:TEST_USER_NAME = "Test User"

# ============================================
# VERIFICATION
# ============================================

Write-Host ""
Write-Host "✅ Environment variables set for this PowerShell session:" -ForegroundColor Green
Write-Host "   TEST_USER_EMAIL = $env:TEST_USER_EMAIL" -ForegroundColor Cyan
Write-Host "   TEST_USER_PASSWORD_STAGING = [HIDDEN]" -ForegroundColor Cyan
Write-Host "   TEST_USER_PASSWORD_PRODUCTION = [HIDDEN]" -ForegroundColor Cyan
Write-Host ""

# Check if passwords are still set to placeholder values
if ($env:TEST_USER_PASSWORD_STAGING -eq "YOUR_STAGING_PASSWORD_HERE") {
    Write-Host "⚠️  WARNING: TEST_USER_PASSWORD_STAGING is still set to placeholder value!" -ForegroundColor Yellow
    Write-Host "   Please edit this script and set your actual staging password." -ForegroundColor Yellow
    Write-Host ""
}

if ($env:TEST_USER_PASSWORD_PRODUCTION -eq "YOUR_PRODUCTION_PASSWORD_HERE") {
    Write-Host "⚠️  WARNING: TEST_USER_PASSWORD_PRODUCTION is still set to placeholder value!" -ForegroundColor Yellow
    Write-Host "   Please edit this script and set your actual production password." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "📝 Next steps:" -ForegroundColor Green
Write-Host "   1. Run staging tests: npx playwright test tests/e2e/authentication.spec.ts" -ForegroundColor White
Write-Host "   2. Run production tests: `$env:TEST_ENV='production'; npx playwright test tests/e2e/authentication.spec.ts" -ForegroundColor White
Write-Host ""
Write-Host "ℹ️  Note: These variables are only active in this PowerShell session." -ForegroundColor Gray
Write-Host "   Close PowerShell and you'll need to run this script again." -ForegroundColor Gray
Write-Host ""




