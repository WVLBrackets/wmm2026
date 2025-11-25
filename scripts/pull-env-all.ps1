# Pull environment variables from both Production and Preview (Staging)
# This ensures we have all test credentials regardless of which environment we're testing

Write-Host ""
Write-Host "Pulling Environment Variables from Vercel" -ForegroundColor Cyan
Write-Host ""
Write-Host "Step 1: Pulling from Production..." -ForegroundColor Yellow
vercel env pull .env.test --environment=production

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Failed to pull from Production" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Pulling from Preview (Staging)..." -ForegroundColor Yellow
vercel env pull .env.test.preview --environment=preview

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Failed to pull from Preview" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Merging environment variables..." -ForegroundColor Yellow

# Read both files
$prodVars = @{}
$previewVars = @{}

if (Test-Path .env.test) {
    Get-Content .env.test | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $prodVars[$key] = $value
        }
    }
}

if (Test-Path .env.test.preview) {
    Get-Content .env.test.preview | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $previewVars[$key] = $value
        }
    }
}

# Merge: Production takes precedence, but include Preview-specific variables
$mergedVars = @{}
foreach ($key in $previewVars.Keys) {
    $mergedVars[$key] = $previewVars[$key]
}
foreach ($key in $prodVars.Keys) {
    $mergedVars[$key] = $prodVars[$key]
}

# Write merged file
$output = @()
$output += "# Merged environment variables from Production and Preview"
$output += "# Production variables take precedence for conflicts"
$output += "# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$output += ""

# Sort keys for readability
$sortedKeys = $mergedVars.Keys | Sort-Object

foreach ($key in $sortedKeys) {
    $value = $mergedVars[$key]
    $output += "$key=$value"
}

# Write file with proper line breaks (join array with newlines)
$output -join "`n" | Out-File -FilePath .env.test -Encoding utf8

# Clean up temporary file
Remove-Item .env.test.preview -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Successfully merged environment variables!" -ForegroundColor Green
Write-Host ""
Write-Host "Included variables:" -ForegroundColor Cyan
Write-Host "  Production: TEST_USER_EMAIL, TEST_USER_PASSWORD_PRODUCTION, NEXTAUTH_URL, PRODUCTION_URL" -ForegroundColor White
Write-Host "  Preview: TEST_USER_PASSWORD_STAGING, STAGING_URL" -ForegroundColor White
