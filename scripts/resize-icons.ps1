Add-Type -AssemblyName System.Drawing

$baseDir = Split-Path -Parent $PSScriptRoot
$srcFile = Join-Path $baseDir "public\icons\icon-128.png"
$src = [System.Drawing.Image]::FromFile($srcFile)

foreach ($dim in @(192, 512)) {
    $dstFile = Join-Path $baseDir "public\icons\icon-$dim.png"
    $bmp = New-Object System.Drawing.Bitmap $dim, $dim
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($src, 0, 0, $dim, $dim)
    $g.Dispose()
    $bmp.Save($dstFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Generated $dstFile ($dim x $dim)"
}

$src.Dispose()
