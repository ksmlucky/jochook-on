# Deterministic vector logo: football seams inside an ON ring, with a lime switch.
# All geometry stays inside the central mask-safe circle for installed app icons.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskIconRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'frontend/public/icons'
New-Item -ItemType Directory -Path $taskIconRoot -Force | Out-Null
$taskSvg = @"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#28624c"/>
  <path d="M318 147A136 136 0 1 1 194 147" fill="none" stroke="#fff" stroke-width="26" stroke-linecap="round"/>
  <path d="M256 108V180" stroke="#d8edb2" stroke-width="34" stroke-linecap="round"/>
  <path d="M256 222L299 254L282 304H230L213 254Z" fill="#fff"/>
  <path d="M256 222V206M213 254L128 227M299 254L384 227M230 304L176 374M282 304L336 374" stroke="#fff" stroke-width="15" stroke-linecap="round"/>
</svg>
"@
[IO.File]::WriteAllText((Join-Path $taskIconRoot 'jochook-on.svg'), $taskSvg, [Text.UTF8Encoding]::new($false))
foreach ($taskIconSize in @(180, 192, 512)) {
    $taskBitmap = [Drawing.Bitmap]::new($taskIconSize, $taskIconSize)
    $taskGraphics = [Drawing.Graphics]::FromImage($taskBitmap)
    $taskRing = [Drawing.Pen]::new([Drawing.Color]::White, 26)
    $taskSeam = [Drawing.Pen]::new([Drawing.Color]::White, 15)
    $taskSwitch = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#d8edb2'), 34)
    try {
        $taskGraphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $taskGraphics.Clear([Drawing.ColorTranslator]::FromHtml('#28624c'))
        $taskGraphics.ScaleTransform($taskIconSize / 512.0, $taskIconSize / 512.0)
        foreach ($taskPen in @($taskRing, $taskSeam, $taskSwitch)) {
            $taskPen.StartCap = [Drawing.Drawing2D.LineCap]::Round
            $taskPen.EndCap = [Drawing.Drawing2D.LineCap]::Round
        }
        $taskGraphics.DrawArc($taskRing, 120, 132, 272, 272, -63, 306)
        $taskGraphics.DrawLine($taskSwitch, 256, 108, 256, 180)
        $taskGraphics.FillPolygon([Drawing.Brushes]::White, [Drawing.PointF[]]@([Drawing.PointF]::new(256,222),[Drawing.PointF]::new(299,254),[Drawing.PointF]::new(282,304),[Drawing.PointF]::new(230,304),[Drawing.PointF]::new(213,254)))
        foreach ($taskLine in @(@(256,222,256,206), @(213,254,128,227), @(299,254,384,227), @(230,304,176,374), @(282,304,336,374))) {
            $taskGraphics.DrawLine($taskSeam, $taskLine[0], $taskLine[1], $taskLine[2], $taskLine[3])
        }
        $taskIconName = if ($taskIconSize -eq 180) { 'apple-touch-icon.png' } else { "icon-$taskIconSize.png" }
        $taskBitmap.Save((Join-Path $taskIconRoot $taskIconName), [Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $taskSwitch.Dispose(); $taskSeam.Dispose(); $taskRing.Dispose(); $taskGraphics.Dispose(); $taskBitmap.Dispose()
    }
}
Write-Output 'Generated football/ON SVG and opaque 180/192/512px icons.'