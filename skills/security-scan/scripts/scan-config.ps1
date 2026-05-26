# Scan ThinkPHP config for security issues
# Usage: .\scan-config.ps1

Write-Host "Scanning application/config.php..." -ForegroundColor Cyan

$configPath = "application/config.php"
if (Test-Path $configPath) {
    $debugMode = Select-String -Path $configPath -Pattern "'app_debug'\s*=>\s*true"
    if ($debugMode) {
        Write-Host "[WARNING] app_debug is set to true. Ensure this is NOT production." -ForegroundColor Yellow
        $debugMode
    } else {
        Write-Host "[OK] app_debug is not true." -ForegroundColor Green
    }
} else {
    Write-Host "[ERROR] application/config.php not found." -ForegroundColor Red
}

Write-Host "`nScanning application/database.php for hardcoded passwords..." -ForegroundColor Cyan
$dbPath = "application/database.php"
if (Test-Path $dbPath) {
    $passwords = Select-String -Path $dbPath -Pattern "'password'\s*=>\s*'[^']+'"
    if ($passwords) {
        Write-Host "[WARNING] Potential hardcoded passwords found in database.php." -ForegroundColor Yellow
        $passwords
    } else {
        Write-Host "[OK] No obvious hardcoded passwords found." -ForegroundColor Green
    }
} else {
    Write-Host "[ERROR] application/database.php not found." -ForegroundColor Red
}
