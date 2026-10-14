. (Join-Path $PSScriptRoot 'Use-DevTools.ps1')
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Output 'HANA FC development terminal: Java, Node.js, npm, pnpm and MySQL are available here.'
Write-Output 'Run .\scripts\Start-Backend.ps1 for the API, pnpm dev for frontend development.'
Write-Output 'For code changes: stop the preview with Stop-HANA.cmd, then start development servers.'
