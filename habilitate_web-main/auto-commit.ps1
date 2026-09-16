# auto-commit.ps1
# Watches the project for changes and auto-commits + pushes to GitHub

$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$debounceSeconds = 10   # Wait this many seconds after last change before committing

Write-Host "Auto-commit watcher started for: $projectPath" -ForegroundColor Cyan
Write-Host "   Debounce delay: $debounceSeconds seconds" -ForegroundColor Gray
Write-Host "   Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

# Set up FileSystemWatcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $projectPath
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::FileName -bor [System.IO.NotifyFilters]::DirectoryName

# Exclusion patterns (git internals, node_modules, build artifacts)
$excludePatterns = @(
    '\.git\',
    'node_modules\',
    'dist\',
    'build\',
    '\.next\',
    '__pycache__\',
    '*.log'
)

$lastChangeTime = [DateTime]::MinValue
$pendingCommit = $false

$action = {
    $path = $Event.SourceEventArgs.FullPath

    # Skip excluded paths
    foreach ($pattern in $excludePatterns) {
        if ($path -like "*$pattern*") { return }
    }

    $script:lastChangeTime = [DateTime]::Now
    $script:pendingCommit = $true
    Write-Host "  [CHANGED] $($Event.SourceEventArgs.Name)" -ForegroundColor Yellow
}

# Register event handlers
Register-ObjectEvent $watcher Changed -Action $action | Out-Null
Register-ObjectEvent $watcher Created -Action $action | Out-Null
Register-ObjectEvent $watcher Deleted -Action $action | Out-Null
Register-ObjectEvent $watcher Renamed -Action $action | Out-Null

try {
    while ($true) {
        Start-Sleep -Seconds 2

        if ($pendingCommit -and ([DateTime]::Now - $lastChangeTime).TotalSeconds -ge $debounceSeconds) {
            $pendingCommit = $false

            Push-Location $projectPath

            # Check if there are actual changes
            $status = git status --porcelain
            if ($status) {
                $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                $commitMsg = "auto-save: $timestamp"

                Write-Host ""
                Write-Host "[COMMITTING] $commitMsg" -ForegroundColor Magenta
                git add -A
                git commit -m $commitMsg
                git push origin HEAD

                if ($LASTEXITCODE -eq 0) {
                    Write-Host "[SUCCESS] Pushed: $commitMsg" -ForegroundColor Green
                } else {
                    Write-Host "[FAILED] Push failed. Check your network/credentials." -ForegroundColor Red
                }
            }

            Pop-Location
        }
    }
} finally {
    $watcher.EnableRaisingEvents = $false
    $watcher.Dispose()
    Get-EventSubscriber | Unregister-Event
    Write-Host "Auto-commit watcher stopped." -ForegroundColor Red
}

