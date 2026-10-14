$taskPrograms = Join-Path $env:LOCALAPPDATA 'Programs'
$taskJava = Get-ChildItem -LiteralPath (Join-Path $taskPrograms 'Eclipse Adoptium') -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
$taskNode = Get-ChildItem -LiteralPath (Join-Path $taskPrograms 'nodejs') -Directory -Filter 'node-v24*-win-x64' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
$taskMysql = Get-ChildItem -LiteralPath (Join-Path $taskPrograms 'MySQL') -Directory -Filter 'mysql-8.4*-winx64' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
$taskBins = @()
if ($taskJava) { $env:JAVA_HOME = $taskJava.FullName; $taskBins += Join-Path $taskJava.FullName 'bin' }
if ($taskNode) { $taskBins += $taskNode.FullName }
if ($taskMysql) {
    $env:JOCHOOK_ON_MYSQL_HOME = $taskMysql.FullName
    # Older local helper scripts still use this environment variable.
    $env:HANA_MYSQL_HOME = $taskMysql.FullName
    $taskBins += Join-Path $taskMysql.FullName 'bin'
}
foreach ($taskBin in @((Join-Path $taskPrograms 'pnpm'), (Join-Path $taskPrograms 'Git\cmd'), (Join-Path $taskPrograms 'DockerDesktop\resources\bin'))) {
    if (Test-Path -LiteralPath $taskBin) { $taskBins += $taskBin }
}
$env:Path = ($taskBins -join ';') + ';' + $env:Path
$env:npm_config_cache = Join-Path $taskPrograms 'HanaDevTools\npm-cache'
$env:GRADLE_USER_HOME = Join-Path (Split-Path -Parent $PSScriptRoot) 'work\gradle-cache'

function Import-JochookOnEnvironment {
    $taskEnvFile = Join-Path (Split-Path -Parent $PSScriptRoot) '.env'
    foreach ($taskLine in Get-Content -LiteralPath $taskEnvFile -Encoding UTF8) {
        if ($taskLine -match '^\s*(MYSQL_HOST|MYSQL_PORT|MYSQL_DATABASE|MYSQL_USER|MYSQL_PASSWORD|MYSQL_ROOT_PASSWORD)=(.*)$') {
            $taskValue = $Matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($Matches[1], $taskValue, 'Process')
        }
    }
}

function Import-JochookOnAdminBootstrap {
    $taskAdminFile = Join-Path (Split-Path -Parent $PSScriptRoot) '.local\admin-bootstrap.json'
    if (Test-Path -LiteralPath $taskAdminFile) {
        $taskAdmin = Get-Content -LiteralPath $taskAdminFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $env:JOCHOOK_ON_BOOTSTRAP_USERNAME = [string]$taskAdmin.username
        $env:JOCHOOK_ON_BOOTSTRAP_PASSWORD = [string]$taskAdmin.password
        # 이 PC에서 직접 지정한 기존 관리자만 서비스 관리자로 초기 설정한다.
        # 다른 ADMIN 계정 전체를 승격하거나 운영 환경의 지정값을 덮어쓰지 않는다.
        if (-not $env:JOCHOOK_ON_SERVICE_ADMIN_USERNAME) {
            $env:JOCHOOK_ON_SERVICE_ADMIN_USERNAME = [string]$taskAdmin.username
        }
    }
}

# Keep existing local-only helper scripts working after the service rename.
function Import-HanaEnvironment { Import-JochookOnEnvironment }
function Import-HanaAdminBootstrap { Import-JochookOnAdminBootstrap }
