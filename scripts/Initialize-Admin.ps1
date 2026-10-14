$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskLocal = Join-Path $taskRoot '.local'
$taskFile = Join-Path $taskLocal 'admin-bootstrap.json'
if (Test-Path -LiteralPath $taskFile) {
    Write-Output 'Existing local admin settings were preserved: .local/admin-bootstrap.json'
    return
}
New-Item -ItemType Directory -Path $taskLocal -Force | Out-Null
$taskBytes = New-Object byte[] 24
$taskRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $taskRandom.GetBytes($taskBytes) } finally { $taskRandom.Dispose() }
$taskJson = @{ username = 'admin'; password = [Convert]::ToBase64String($taskBytes) } | ConvertTo-Json
$taskStream = [IO.File]::Open($taskFile, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $taskContent = [Text.UTF8Encoding]::new($false).GetBytes($taskJson)
    $taskStream.Write($taskContent, 0, $taskContent.Length)
} finally { $taskStream.Dispose() }
Write-Output 'Local admin settings created: .local/admin-bootstrap.json'
Write-Output 'The first API startup creates the account only when the accounts table is empty.'
