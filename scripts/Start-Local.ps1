param([switch]$OpenBrowser)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Use-DevTools.ps1')
Import-JochookOnEnvironment
Import-JochookOnAdminBootstrap
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskState = Join-Path $taskRoot '.local'
& (Join-Path $PSScriptRoot 'Start-MySQL.ps1')
function Test-JochookOnHttp([string]$Url) {
    try { return (Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { return $false }
}
function Save-JochookOnProcess($Process, [string]$Name, [string]$Executable) {
    # Start-Process 직후 Process.Path가 비어 있을 수 있어 실제 실행에 사용한 경로를 기록한다.
    @{ id = $Process.Id; started = $Process.StartTime.ToUniversalTime().ToString('o'); executable = [IO.Path]::GetFullPath($Executable) } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskState ($Name + '.process.json')) -Encoding UTF8
}
if (-not (Test-JochookOnHttp 'http://127.0.0.1:8080/actuator/health')) {
    $taskJar = Join-Path $taskRoot 'backend\build\libs\jochook-on-api-0.1.0-SNAPSHOT.jar'
    if (-not (Test-Path -LiteralPath $taskJar)) { throw 'Build the backend first: scripts/Start-Backend.ps1 -Task bootJar' }
    $taskProcess = Start-Process -FilePath (Join-Path $env:JAVA_HOME 'bin\java.exe') -ArgumentList '-jar', ('"' + $taskJar + '"') -WorkingDirectory (Join-Path $taskRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskState 'backend.stdout.log') -RedirectStandardError (Join-Path $taskState 'backend.stderr.log')
    Save-JochookOnProcess $taskProcess 'backend' (Join-Path $env:JAVA_HOME 'bin\java.exe')
    for ($taskAttempt = 0; $taskAttempt -lt 40; $taskAttempt++) {
        if (Test-JochookOnHttp 'http://127.0.0.1:8080/actuator/health') { break }
        if ($taskProcess.HasExited) { throw 'The API stopped. See .local/backend.stdout.log.' }
        Start-Sleep -Seconds 1
    }
    if (-not (Test-JochookOnHttp 'http://127.0.0.1:8080/actuator/health')) { throw 'API startup timed out. See .local/backend.stdout.log.' }
}
if (-not (Test-JochookOnHttp 'http://127.0.0.1:5173/')) {
    $taskNodeExe = (Get-Command node.exe).Source
    $taskProcess = Start-Process -FilePath $taskNodeExe -ArgumentList ('"' + (Join-Path $PSScriptRoot 'preview-server.mjs') + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskState 'frontend.stdout.log') -RedirectStandardError (Join-Path $taskState 'frontend.stderr.log')
    Save-JochookOnProcess $taskProcess 'frontend' $taskNodeExe
    for ($taskAttempt = 0; $taskAttempt -lt 10; $taskAttempt++) {
        if (Test-JochookOnHttp 'http://127.0.0.1:5173/') { break }
        Start-Sleep -Seconds 1
    }
}
if (-not (Test-JochookOnHttp 'http://127.0.0.1:5173/api/v1/auth/csrf')) { throw 'The website could not reach the authentication API.' }
Write-Output 'JochookON is running: http://127.0.0.1:5173'
Write-Output 'Use Stop-JochookON.cmd to stop the local servers. Closing the browser does not stop them.'
if ($OpenBrowser) { Start-Process 'http://127.0.0.1:5173' }
