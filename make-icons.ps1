# دروستکردنی ئایکۆنی PWA بە System.Drawing
Add-Type -AssemblyName System.Drawing

$accent = [System.Drawing.Color]::FromArgb(16, 185, 129)
$accentDark = [System.Drawing.Color]::FromArgb(5, 122, 96)
$outDir = Join-Path $PSScriptRoot "..\icons"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

function New-Icon {
    param([int]$Size, [string]$Path, [double]$Scale = 1.0)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # پاشبنەمای خڕگۆشە بە گرادیێنت
    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $radius = [int]($Size * 0.225)
    $path2 = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $path2.AddArc($Size - $d - 1, 1, $d, $d, 270, 90)
    $path2.AddArc($Size - $d - 1, $Size - $d - 1, $d, $d, 0, 90)
    $path2.AddArc(1, $Size - $d - 1, $d, $d, 90, 90)
    $path2.AddArc(1, 1, $d, $d, 180, 90)
    $path2.CloseFigure()

    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $accent, $accentDark, 55.0)
    $g.FillPath($brush, $path2)

    # سیستەمی کووردینات بۆ قەبارەی 512
    $s = $Scale
    $g.ScaleTransform($Size / 512.0 * $s, $Size / 512.0 * $s)
    $g.TranslateTransform((512 * (1 - $s) / 2), (512 * (1 - $s) / 2))

    $white = [System.Drawing.Brushes]::White

    # بۆکسی بار
    $g.FillRectangle($white, 88, 158, 216, 148)
    # کابین
    $cabPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $cabPath.AddPolygon(@(
        (New-Object System.Drawing.Point(310, 200)),
        (New-Object System.Drawing.Point(366, 200)),
        (New-Object System.Drawing.Point(404, 252)),
        (New-Object System.Drawing.Point(404, 306)),
        (New-Object System.Drawing.Point(310, 306))
    ))
    $g.FillPath($white, $cabPath)
    # پەنجەرە
    $glass = [System.Drawing.Brushes]::White
    $g.FillRectangle($glass, 356, 212, 34, 34)
    # خانەکانی بۆکس
    $linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(5, 122, 96), 6)
    $g.DrawLine($linePen, 150, 200, 150, 264)
    $g.DrawLine($linePen, 200, 200, 200, 264)
    # تایەکان
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(5, 122, 96))
    $g.FillEllipse($bgBrush, 128, 288, 72, 72)
    $g.FillEllipse($bgBrush, 330, 288, 72, 72)
    $g.FillEllipse($white, 148, 308, 32, 32)
    $g.FillEllipse($white, 350, 308, 32, 32)

    $g.Dispose()
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "OK -> $Path"
}

New-Icon -Size 512 -Path (Join-Path $outDir "icon-512.png") -Scale 1.0
New-Icon -Size 192 -Path (Join-Path $outDir "icon-192.png") -Scale 1.0
New-Icon -Size 512 -Path (Join-Path $outDir "maskable-512.png") -Scale 0.72
