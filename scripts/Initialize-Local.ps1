$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskEnvPath = Join-Path $taskRoot '.env'

if (Test-Path -LiteralPath $taskEnvPath) {
    Write-Output '.env already exists. Existing settings were preserved.'
    exit 0
}

$taskTemplate = Get-Content -LiteralPath (Join-Path $taskRoot '.env.example') -Raw -Encoding UTF8
$taskTemplate = $taskTemplate.Replace('replace-with-a-local-password', [Guid]::NewGuid().ToString('N'))
$taskTemplate = $taskTemplate.Replace('replace-with-a-different-local-password', [Guid]::NewGuid().ToString('N'))
[System.IO.File]::WriteAllText($taskEnvPath, $taskTemplate, [System.Text.UTF8Encoding]::new($false))
Write-Output 'Created .env with local database passwords. The file is excluded from Git.'
