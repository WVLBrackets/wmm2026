# Sync test infrastructure from staging to main
# Run this after adding tests or dependencies to staging

Write-Host "`n=== Syncing Test Infrastructure: Staging → Main ===" -ForegroundColor Cyan
Write-Host ""

# Check current branch
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "Current branch: $currentBranch" -ForegroundColor Gray

# Check for uncommitted changes
Write-Host "`n0. Checking for uncommitted changes..." -ForegroundColor Yellow
$uncommitted = git status --porcelain
if ($uncommitted) {
    Write-Host "   Found uncommitted changes. Stashing them..." -ForegroundColor Yellow
    git stash push -m "Auto-stash before syncing tests to main"
    $hasStash = $true
} else {
    $hasStash = $false
}

# Make sure we're on staging and up to date
Write-Host "`n1. Checking out staging branch..." -ForegroundColor Yellow
git checkout staging
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to checkout staging branch" -ForegroundColor Red
    if ($hasStash) {
        Write-Host "   Restoring stashed changes..." -ForegroundColor Yellow
        git stash pop
    }
    exit 1
}

Write-Host "2. Pulling latest from staging..." -ForegroundColor Yellow
git pull origin staging
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Warning: Could not pull from staging (might be up to date)" -ForegroundColor Yellow
}

# Switch to main
Write-Host "3. Checking out main branch..." -ForegroundColor Yellow
git checkout main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to checkout main branch" -ForegroundColor Red
    exit 1
}

Write-Host "4. Pulling latest from main..." -ForegroundColor Yellow
git pull origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Warning: Could not pull from main (might be up to date)" -ForegroundColor Yellow
}

# Merge staging
Write-Host "`n5. Merging staging into main..." -ForegroundColor Yellow
git merge staging --no-edit

# Check for conflicts
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Merge conflicts detected!" -ForegroundColor Red
    Write-Host "Please resolve conflicts manually, then run:" -ForegroundColor Yellow
    Write-Host "  git push origin main" -ForegroundColor White
    exit 1
}

# Push to main
Write-Host "6. Pushing to main..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push to main" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Sync complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Go to GitHub Actions" -ForegroundColor White
Write-Host "2. Trigger 'Smoke Tests' workflow" -ForegroundColor White
Write-Host "3. Select 'staging' branch" -ForegroundColor White
Write-Host "4. Verify it runs successfully" -ForegroundColor White
Write-Host ""

# Switch back to staging
Write-Host "Switching back to staging branch..." -ForegroundColor Gray
git checkout staging

# Restore stashed changes if any
if ($hasStash) {
    Write-Host "Restoring your uncommitted changes..." -ForegroundColor Yellow
    git stash pop
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Warning: Could not restore all stashed changes (may have conflicts)" -ForegroundColor Yellow
    }
}

Write-Host "`nDone! You're back on staging branch." -ForegroundColor Green

