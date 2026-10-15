#requires -Version 7.0
param(
    [uri]$BaseUrl = 'https://http--jochook-on-web--wmjz5mzg84j4.code.run/',
    [string]$OutputPath = (Join-Path $PSScriptRoot '../work/production-check-latest.json'),
    [ValidateRange(5, 60)][int]$TimeoutSeconds = 20
)

$ErrorActionPreference = 'Stop'
if (!$BaseUrl.IsAbsoluteUri -or $BaseUrl.Scheme -ne 'https' -or $BaseUrl.UserInfo -or $BaseUrl.Query -or $BaseUrl.Fragment -or $BaseUrl.AbsolutePath -ne '/') {
    throw 'BaseUrl must be an HTTPS origin without credentials, path, query or fragment.'
}

# No login, cookies, team data, or write requests. Redirects are checked rather than followed.
$handler = [Net.Http.HttpClientHandler]::new()
$handler.AllowAutoRedirect = $false
$handler.UseCookies = $false
$client = [Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
$checks = [Collections.Generic.List[object]]::new()
$homeHtml = ''

function Invoke-PublicCheck([string]$Name, [string]$Path, [int]$ExpectedStatus, [string]$ContentType = '') {
    $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get, [uri]::new($BaseUrl, $Path))
    $request.Headers.TryAddWithoutValidation('Cache-Control', 'no-cache') | Out-Null
    $timer = [Diagnostics.Stopwatch]::StartNew()
    $response = $null
    try {
        $response = $client.SendAsync($request).GetAwaiter().GetResult()
        $status = [int]$response.StatusCode
        $type = [string]$response.Content.Headers.ContentType.MediaType
        $ok = $status -eq $ExpectedStatus -and (!$ContentType -or $type -eq $ContentType)
        $checks.Add([pscustomobject]@{name=$Name;status=$status;expected=$ExpectedStatus;ok=$ok;milliseconds=$timer.ElapsedMilliseconds})
        if ($Name -eq 'homepage' -and $ok) { $script:homeHtml = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() }
    } catch {
        # Exception text can contain network/proxy details. The report needs only the failure kind.
        $checks.Add([pscustomobject]@{name=$Name;status=$null;expected=$ExpectedStatus;ok=$false;error=$_.Exception.GetType().Name;milliseconds=$timer.ElapsedMilliseconds})
    } finally {
        $request.Dispose()
        if ($response) { $response.Dispose() }
    }
}

try {
    Invoke-PublicCheck 'homepage' '/' 200 'text/html'
    Invoke-PublicCheck 'web-readiness' '/healthz' 204
    Invoke-PublicCheck 'anonymous-players-blocked' '/api/v1/players' 401
    Invoke-PublicCheck 'anonymous-matches-blocked' '/api/v1/matches' 401
    Invoke-PublicCheck 'actuator-private' '/actuator/health' 404
    Invoke-PublicCheck 'pwa-manifest' '/manifest.webmanifest' 200 'application/manifest+json'
    Invoke-PublicCheck 'service-worker' '/sw.js' 200
    foreach ($extension in @('js', 'css')) {
        # Only same-origin asset paths found in the public HTML can be fetched.
        $asset = [regex]::Match($homeHtml, '"(/assets/index-[A-Za-z0-9_-]+\.' + $extension + ')"').Groups[1].Value
        if ($asset) { Invoke-PublicCheck "app-$extension" $asset 200 }
        else { $checks.Add([pscustomobject]@{name="app-$extension";status=$null;expected=200;ok=$false;error='AssetNotFound';milliseconds=0}) }
    }
    $result = [ordered]@{
        checkedAt = [DateTimeOffset]::Now.ToString('o')
        site = $BaseUrl.GetLeftPart([UriPartial]::Authority)
        passed = @($checks | Where-Object { !$_.ok }).Count -eq 0
        scope = 'Public read-only checks; no authenticated business flow or load test.'
        checks = $checks.ToArray()
    }
    $resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($resolvedOutput)) | Out-Null
    $result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $resolvedOutput -Encoding utf8
    $checks | Select-Object name,status,ok,milliseconds | Format-Table -AutoSize
    Write-Output "Report: $resolvedOutput"
    if (!$result.passed) { exit 1 }
} finally {
    $client.Dispose()
    $handler.Dispose()
}
