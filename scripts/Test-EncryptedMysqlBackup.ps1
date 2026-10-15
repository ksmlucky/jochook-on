#requires -Version 7.0
param(
    [Parameter(Mandatory)][string]$BackupDirectory,
    [string]$Database = 'hana_fc'
)

# Always starts its own disposable server. No host/port argument can target production.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Use-DevTools.ps1')
if ($Database -notmatch '^[a-z][a-z0-9_]*$') { throw 'Invalid database name.' }
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$backupRoot = [IO.Path]::GetFullPath($BackupDirectory)
$manifestPath = Join-Path $backupRoot 'manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.encryptedFile -ne 'native.sql.gz.dpapi') { throw 'Unsupported encrypted backup.' }
$encryptedPath = Join-Path $backupRoot $manifest.encryptedFile
$scratchRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'work'))
$testRoot = Join-Path $scratchRoot ('mysql-restore-check-' + [guid]::NewGuid().ToString('N'))
$dataDirectory = Join-Path $testRoot 'data'
$server = $null
$compressed = $null
$sql = $null
$testPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
$report = [ordered]@{checkedAt=(Get-Date).ToString('o');restoreVerified=$false;plaintextSqlFileCreated=$false;temporaryDataRemoved=$false;productionModified=$false}

function Invoke-TestMysql([string]$Query, [byte[]]$InputBytes, [switch]$WithoutPassword) {
    $info = [Diagnostics.ProcessStartInfo]::new((Get-Command mysql.exe).Source)
    $info.UseShellExecute=$false; $info.CreateNoWindow=$true
    $info.RedirectStandardInput=$true; $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true
    foreach ($arg in @('--no-defaults','--protocol=TCP','--host=127.0.0.1',"--port=$testPort",'--user=root','--connect-timeout=2','--default-character-set=utf8mb4','--binary-mode','--batch','--skip-column-names')) { $info.ArgumentList.Add($arg) }
    $info.Environment.Remove('MYSQL_PWD') | Out-Null
    if (!$WithoutPassword) { $info.Environment['MYSQL_PWD']=$testPassword }
    $process = [Diagnostics.Process]::Start($info)
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    try {
        if ($InputBytes) { $process.StandardInput.BaseStream.Write($InputBytes) }
        else { $process.StandardInput.Write($Query) }
        $process.StandardInput.Close()
        if (!$process.WaitForExit(60000)) { $process.Kill($true); throw 'Local restore command timed out.' }
        $output = $stdout.GetAwaiter().GetResult()
        $null = $stderr.GetAwaiter().GetResult() # SQL errors may contain personal data.
        if ($process.ExitCode -ne 0) { throw 'Local restore command failed; SQL details omitted.' }
        return $output.TrimEnd()
    } finally { $process.Dispose() }
}

try {
    Add-Type -AssemblyName System.Security
    $compressed = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($encryptedPath),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($compressed)).ToLowerInvariant()
    if ($hash -ne $manifest.sha256) { throw 'Backup checksum mismatch.' }
    $inputMemory = [IO.MemoryStream]::new($compressed)
    $gzip = [IO.Compression.GZipStream]::new($inputMemory,[IO.Compression.CompressionMode]::Decompress)
    $outputMemory = [IO.MemoryStream]::new()
    try {
        $buffer = [byte[]]::new(65536)
        while (($count=$gzip.Read($buffer,0,$buffer.Length)) -gt 0) {
            if ($outputMemory.Length + $count -gt 64MB) { throw 'Backup exceeds local verification size limit.' }
            $outputMemory.Write($buffer,0,$count)
        }
        $sql = $outputMemory.ToArray()
    } finally { $gzip.Dispose(); $inputMemory.Dispose(); $outputMemory.Dispose(); if($buffer){[Array]::Clear($buffer)} }
    New-Item -ItemType Directory -Path $dataDirectory | Out-Null
    $mysqlServer = (Get-Command mysqld.exe).Source
    $initInfo = [Diagnostics.ProcessStartInfo]::new($mysqlServer)
    $initInfo.UseShellExecute=$false; $initInfo.CreateNoWindow=$true
    foreach($arg in @('--no-defaults','--initialize-insecure',"--datadir=$dataDirectory",'--lower-case-table-names=1',"--log-error=$(Join-Path $testRoot 'init.log')")) { $initInfo.ArgumentList.Add($arg) }
    $initProcess = [Diagnostics.Process]::Start($initInfo)
    try { if(!$initProcess.WaitForExit(60000)){ $initProcess.Kill($true); $initProcess.WaitForExit(); throw 'Restore initialization timed out.' }; if($initProcess.ExitCode -ne 0){throw 'Restore initialization failed.'} } finally {$initProcess.Dispose()}
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
    $listener.Start(); $testPort=$listener.LocalEndpoint.Port; $listener.Stop()
    $startInfo = [Diagnostics.ProcessStartInfo]::new($mysqlServer)
    $startInfo.UseShellExecute=$false; $startInfo.CreateNoWindow=$true
    foreach($arg in @('--no-defaults',"--datadir=$dataDirectory",'--bind-address=127.0.0.1',"--port=$testPort",'--mysqlx=0','--skip-log-bin','--local-infile=0','--secure-file-priv=NULL','--lower-case-table-names=1',"--log-error=$(Join-Path $testRoot 'server.log')")) { $startInfo.ArgumentList.Add($arg) }
    $server = [Diagnostics.Process]::Start($startInfo)
    $ready=$false
    for($attempt=0;$attempt -lt 30;$attempt++) {
        if($server.HasExited){throw 'Restore server failed to start.'}
        try { $actualDirectory=Invoke-TestMysql -Query 'SELECT @@datadir;' -WithoutPassword } catch {Start-Sleep -Seconds 1;continue}
        if([IO.Path]::GetFullPath($actualDirectory.Replace('\\','\')).TrimEnd('\','/') -ne [IO.Path]::GetFullPath($dataDirectory).TrimEnd('\','/')) { throw 'Unexpected restore target.' }
        $null=Invoke-TestMysql -Query "ALTER USER 'root'@'localhost' IDENTIFIED BY '$testPassword';" -WithoutPassword
        $ready=$true; break
    }
    if(!$ready){throw 'Restore server did not become ready.'}
    $actualDirectory = Invoke-TestMysql -Query 'SELECT @@datadir;'
    if([IO.Path]::GetFullPath($actualDirectory.Replace('\\','\')).TrimEnd('\','/') -ne [IO.Path]::GetFullPath($dataDirectory).TrimEnd('\','/')) { throw 'Unexpected restore target.' }
    $null=Invoke-TestMysql -Query "CREATE DATABASE IF NOT EXISTS $Database CHARACTER SET utf8mb4;"
    # The dump may include CREATE DATABASE/USE. All of it runs only on this fresh server.
    $prefix=[Text.Encoding]::UTF8.GetBytes("USE $Database;`n")
    $payload=[byte[]]::new($prefix.Length+$sql.Length)
    [Array]::Copy($prefix,0,$payload,0,$prefix.Length); [Array]::Copy($sql,0,$payload,$prefix.Length,$sql.Length)
    try {$null=Invoke-TestMysql -InputBytes $payload} finally {[Array]::Clear($payload)}
    $tables=(Invoke-TestMysql -Query "SELECT table_name FROM information_schema.tables WHERE table_schema='$Database' AND table_type='BASE TABLE' ORDER BY table_name;") -split '\r?\n'
    if(!$tables.Count -or !$tables.Contains('flyway_schema_history')) {throw 'Application schema was not restored.'}
    $checks=@()
    foreach($table in $tables) {
        if($table -notmatch '^[a-z][a-z0-9_]*$'){throw 'Unexpected table name.'}
        $check=Invoke-TestMysql -Query "CHECK TABLE $Database.$table;"
        if($check -notmatch '\tstatus\tOK$'){throw 'Restored table integrity check failed.'}
        $checks+=@{table=$table;rows=[long](Invoke-TestMysql -Query "SELECT COUNT(*) FROM $Database.$table;")}
    }
    $failedMigrations=Invoke-TestMysql -Query "SELECT COUNT(*) FROM $Database.flyway_schema_history WHERE success=0;"
    if($failedMigrations -ne '0'){throw 'Restored migration history contains failures.'}
    $report.restoreVerified=$true
    $report.tableCount=$tables.Count
    $report.tables=$checks
    $report.latestMigration=Invoke-TestMysql -Query "SELECT version FROM $Database.flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;"
    $report.method='isolated-native-mysql-import-check-table-and-migration-history'
} finally {
    if($server) {
        if(!$server.HasExited) {
            try {$null=Invoke-TestMysql -Query 'SHUTDOWN;'} catch {}
            if(!$server.WaitForExit(10000)){$server.Kill($true);$server.WaitForExit()}
        }
        $server.Dispose()
    }
    if($compressed){[Array]::Clear($compressed)}
    if($sql){[Array]::Clear($sql)}
    # Deletion is restricted to the exact unique directory created by this invocation.
    $resolvedTestRoot=[IO.Path]::GetFullPath($testRoot)
    if($resolvedTestRoot.StartsWith($scratchRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($resolvedTestRoot) -match '^mysql-restore-check-[0-9a-f]{32}$') {
        if(Test-Path -LiteralPath $resolvedTestRoot){Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force}
        $report.temporaryDataRemoved=!(Test-Path -LiteralPath $resolvedTestRoot)
    }
    $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $backupRoot 'restore-check.json') -Encoding utf8
}
Write-Output "Restore verified: $($report.restoreVerified); tables: $($report.tableCount); migration: $($report.latestMigration); temporary data removed: $($report.temporaryDataRemoved)"
