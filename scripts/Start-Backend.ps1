param(
    [ValidateSet('bootRun', 'test', 'integrationTest', 'bootJar')]
    [string]$Task = 'bootRun'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Use-DevTools.ps1')
$taskRoot = Split-Path -Parent $PSScriptRoot

if ($Task -eq 'bootRun') {
    Import-HanaAdminBootstrap
    $taskEnvPath = Join-Path $taskRoot '.env'
    if (-not (Test-Path -LiteralPath $taskEnvPath)) {
        throw 'Run scripts/Initialize-Local.ps1 first, then docker compose up -d --wait.'
    }
    foreach ($taskLine in Get-Content -LiteralPath $taskEnvPath -Encoding UTF8) {
        if ($taskLine -match '^\s*(MYSQL_HOST|MYSQL_PORT|MYSQL_DATABASE|MYSQL_USER|MYSQL_PASSWORD)=(.*)$') {
            $taskKey = $Matches[1]
            $taskValue = $Matches[2].Trim()
            if ($taskValue.StartsWith('replace-with-')) {
                throw 'Replace the sample database password in .env before starting the API.'
            }
            if ($taskValue.Length -ge 2 -and (($taskValue.StartsWith('"') -and $taskValue.EndsWith('"')) -or ($taskValue.StartsWith("'") -and $taskValue.EndsWith("'")))) {
                $taskValue = $taskValue.Substring(1, $taskValue.Length - 2)
            }
            [Environment]::SetEnvironmentVariable($taskKey, $taskValue, 'Process')
        }
    }
}

if (-not $env:JAVA_HOME -and -not (Get-Command java -ErrorAction SilentlyContinue)) {
    $taskTools = Join-Path $taskRoot 'work\tools'
    $taskJdk = Get-ChildItem -LiteralPath $taskTools -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -First 1
    if (-not $taskJdk) { throw 'Java 21 is required. Install a JDK and configure JAVA_HOME.' }
    $env:JAVA_HOME = $taskJdk.FullName
}

$env:GRADLE_USER_HOME = Join-Path $taskRoot 'work\gradle-cache'
Push-Location (Join-Path $taskRoot 'backend')
try {
    & .\gradlew.bat --no-daemon $Task
    if ($LASTEXITCODE -ne 0) { throw "Gradle task failed: $Task (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}
