$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Use-DevTools.ps1')
Import-HanaEnvironment
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskState = Join-Path $taskRoot '.local'
foreach ($taskName in @('frontend', 'backend')) {
    $taskRecord = Join-Path $taskState ($taskName + '.process.json')
    if (Test-Path -LiteralPath $taskRecord) {
        $taskInfo = Get-Content -LiteralPath $taskRecord -Raw -Encoding UTF8 | ConvertFrom-Json
        $taskProcess = Get-Process -Id $taskInfo.id -ErrorAction SilentlyContinue
        if ($taskProcess) {
            # PowerShell 7.5는 JSON 날짜를 DateTime으로 읽고, Windows PowerShell은 문자열로 읽는다.
            $taskStarted = ([datetime]$taskInfo.started).ToUniversalTime()
            if ($taskProcess.Path -ne $taskInfo.executable -or $taskProcess.StartTime.ToUniversalTime() -ne $taskStarted) {
                throw "Cannot verify $taskName process ownership. The process and its record were retained."
            }
            Stop-Process -Id $taskProcess.Id
        }
        Remove-Item -LiteralPath $taskRecord
    }
}
# Check the actual data directory before shutting down MySQL.
$taskClient = Join-Path $taskState 'mysql-stop.cnf'
[IO.File]::WriteAllText($taskClient, "[client]`nhost=127.0.0.1`nport=3307`nuser=root`npassword=$($env:MYSQL_ROOT_PASSWORD)`nprotocol=tcp`n", [Text.UTF8Encoding]::new($false))
try {
    $ErrorActionPreference = 'Continue'
    $taskActualData = & (Join-Path $env:HANA_MYSQL_HOME 'bin\mysql.exe') "--defaults-extra-file=$taskClient" --connect-timeout=2 --batch --skip-column-names --execute='SELECT @@datadir' 2>$null
    $taskMysqlExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($taskMysqlExit -eq 0) {
        $taskExpected = [IO.Path]::GetFullPath((Join-Path $taskState 'mysql-data')).TrimEnd('\','/')
        $taskActual = [IO.Path]::GetFullPath(([string]$taskActualData).Replace('\\','\')).TrimEnd('\','/')
        if ($taskExpected -ne $taskActual) { throw 'MySQL uses another data directory. It was not stopped.' }
        & (Join-Path $env:HANA_MYSQL_HOME 'bin\mysqladmin.exe') "--defaults-extra-file=$taskClient" shutdown
        if ($LASTEXITCODE -ne 0) { throw 'MySQL shutdown failed.' }
    }
} finally { Remove-Item -LiteralPath $taskClient }
Write-Output 'HANA FC local servers are stopped. Database files are preserved.'
