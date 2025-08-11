# Run User Agent Test Script
Write-Host "Starting User Agent Test..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is available
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Check if the test file exists
if (-not (Test-Path "test-user-agent-detailed.js")) {
    Write-Host "❌ Test file not found: test-user-agent-detailed.js" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Test file found" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  Make sure the backend server is running on port 3000" -ForegroundColor Yellow
Write-Host "   You can start it with: node server.js" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

try {
    Write-Host "🚀 Running test..." -ForegroundColor Green
    node test-user-agent-detailed.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Test completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Test failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error running test: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

