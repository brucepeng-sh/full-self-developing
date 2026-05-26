# Scan ThinkPHP application for potential SQLi vectors
# Usage: .\scan-sqli.ps1

Write-Host "Scanning application/ for potential SQL Injection vectors..." -ForegroundColor Cyan

$rootPath = "application"
$patterns = @("whereRaw", "Db::query", "->query\(", "->execute\(")

foreach ($pattern in $patterns) {
    Write-Host "Checking for: $pattern" -ForegroundColor Gray
    $results = Get-ChildItem -Path $rootPath -Recurse -Filter "*.php" | Select-String -Pattern $pattern
    if ($results) {
        Write-Host "[WARNING] Potential raw queries found using: $pattern" -ForegroundColor Yellow
        $results | ForEach-Object {
            Write-Host "$($_.Path):$($_.LineNumber) - $($_.Line.Trim())"
        }
    } else {
        Write-Host "[OK] No usage of $pattern found." -ForegroundColor Green
    }
    Write-Host ""
}
