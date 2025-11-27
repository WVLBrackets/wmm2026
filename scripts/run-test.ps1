# Cross-platform test runner script
# Usage: .\scripts\run-test.ps1 <test-command> [environment]
# Example: .\scripts\run-test.ps1 "tests/e2e/authentication.spec.ts" staging

param(
    [Parameter(Mandatory=$true)]
    [string]$TestCommand,
    
    [Parameter(Mandatory=$false)]
    [string]$Environment = "staging"
)

# Set environment variable
$env:TEST_ENV = $Environment

# Run the test command
Write-Host "Running tests with TEST_ENV=$Environment" -ForegroundColor Cyan
Write-Host "Command: playwright test $TestCommand" -ForegroundColor Gray
Write-Host ""

npx playwright test $TestCommand

# Clear environment variable
Remove-Item Env:\TEST_ENV


