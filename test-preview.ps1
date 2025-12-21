# Script kiểm tra preview có hoạt động không
Write-Host "🔍 Testing preview connection..." -ForegroundColor Cyan
Write-Host ""

$url = "http://localhost:5000"
$healthUrl = "http://localhost:5000/health"

try {
    Write-Host "Testing health endpoint..." -ForegroundColor Yellow
    $healthResponse = Invoke-WebRequest -Uri $healthUrl -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($healthResponse.StatusCode -eq 200) {
        Write-Host "✅ Health check passed!" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
    Write-Host "   Server may not be running. Please run: npm run dev" -ForegroundColor Yellow
    exit 1
}

try {
    Write-Host ""
    Write-Host "Testing main page..." -ForegroundColor Yellow
    $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Main page accessible!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🌐 Preview is working! Open in browser:" -ForegroundColor Cyan
        Write-Host "   $url" -ForegroundColor White
        Write-Host ""
        Write-Host "Press any key to open in browser, or Ctrl+C to cancel..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        Start-Process $url
    }
} catch {
    Write-Host "❌ Main page failed: $_" -ForegroundColor Red
    Write-Host "   Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    exit 1
}

