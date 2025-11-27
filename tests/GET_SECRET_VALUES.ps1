# Script to extract GitHub Secret values from .env.test
# Run this to get the values you need to add to GitHub Secrets

Write-Host "`n=== GitHub Secret Values ===`n" -ForegroundColor Cyan

if (-not (Test-Path .env.test)) {
    Write-Host "❌ .env.test file not found!" -ForegroundColor Red
    Write-Host "Run: vercel env pull .env.test --environment=preview" -ForegroundColor Yellow
    exit 1
}

$content = Get-Content .env.test

# Extract TEST_USER_EMAIL
$emailLine = $content | Select-String "TEST_USER_EMAIL"
if ($emailLine) {
    $email = ($emailLine.ToString() -split '=')[1].Trim().Trim('"')
    Write-Host "1. TEST_USER_EMAIL" -ForegroundColor Green
    Write-Host "   Value: $email" -ForegroundColor White
    Write-Host ""
}

# Extract TEST_USER_PASSWORD_STAGING
$stagingLine = $content | Select-String "TEST_USER_PASSWORD_STAGING"
if ($stagingLine) {
    $staging = ($stagingLine.ToString() -split '=')[1].Trim().Trim('"')
    Write-Host "2. TEST_USER_PASSWORD_STAGING" -ForegroundColor Green
    Write-Host "   Value: $staging" -ForegroundColor White
    Write-Host ""
}

# Extract TEST_USER_PASSWORD_PRODUCTION
$prodLine = $content | Select-String "TEST_USER_PASSWORD_PRODUCTION"
if ($prodLine) {
    $prod = ($prodLine.ToString() -split '=')[1].Trim().Trim('"')
    Write-Host "3. TEST_USER_PASSWORD_PRODUCTION" -ForegroundColor Green
    Write-Host "   Value: $prod" -ForegroundColor White
    Write-Host ""
}

Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Go to: https://github.com/YOUR_USERNAME/wmm2026/settings/secrets/actions" -ForegroundColor Yellow
Write-Host "2. Click 'New repository secret'" -ForegroundColor Yellow
Write-Host "3. Add each secret above (Name and Value)" -ForegroundColor Yellow
Write-Host "4. Test by running a workflow in GitHub Actions" -ForegroundColor Yellow
Write-Host ""




