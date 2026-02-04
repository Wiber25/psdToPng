param (
    [string]$ImagePath,
    [int]$Width,
    [int]$Height
)

Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Image]::FromFile($ImagePath)
$resized = new-object System.Drawing.Bitmap $Width, $Height

$graph = [System.Drawing.Graphics]::FromImage($resized)
$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graph.DrawImage($img, 0, 0, $Width, $Height)

$img.Dispose()

$resized.Save($ImagePath, [System.Drawing.Imaging.ImageFormat]::Png)
$resized.Dispose()
$graph.Dispose()

Write-Host "Resized $ImagePath to ${Width}x${Height}"
