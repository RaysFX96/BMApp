Add-Type -AssemblyName System.Drawing

$sizes = @{
    'ldpi'    = 36
    'mdpi'    = 48
    'hdpi'    = 72
    'xhdpi'   = 96
    'xxhdpi'  = 144
    'xxxhdpi' = 192
}

$baseDir = "C:\Users\Administrator\Desktop\App Moto"
$sourceIcon = Join-Path $baseDir "icon_temp\biker_manager_icon.png"
$resDir = Join-Path $baseDir "android\app\src\main\res"

try {
    # 1. Clean existing mipmap directories (Nuclear Option)
    Write-Host "Cleaning: Removing old mipmap directories..."
    Get-ChildItem $resDir -Filter "mipmap-*" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    
    # 2. Load Source Image
    $sourceImage = [System.Drawing.Image]::FromFile($sourceIcon)
    Write-Host "Loaded icon: $($sourceImage.Width)x$($sourceImage.Height)"
    
    # 3. Generate PNGs for each density
    foreach ($density in $sizes.Keys) {
        $size = $sizes[$density]
        
        # Create resized bitmap
        $resized = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($resized)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
        
        # Create directory
        $outputDir = Join-Path $resDir "mipmap-$density"
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
        
        # Save standard launcher
        $outputPath = Join-Path $outputDir "ic_launcher.png"
        $resized.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        # Save round launcher
        $outputPathRound = Join-Path $outputDir "ic_launcher_round.png"
        $resized.Save($outputPathRound, [System.Drawing.Imaging.ImageFormat]::Png)

        # Save foreground for adaptive
        $outputPathForeground = Join-Path $outputDir "ic_launcher_foreground.png"
        $resized.Save($outputPathForeground, [System.Drawing.Imaging.ImageFormat]::Png)
        
        Write-Host "Generated $density ($size px)"
        
        $graphics.Dispose()
        $resized.Dispose()
    }
    
    $sourceImage.Dispose()

    # 4. Generate Adaptive Icon XMLs (anydpi-v26)
    $anydpiDir = Join-Path $resDir "mipmap-anydpi-v26"
    New-Item -ItemType Directory -Path $anydpiDir -Force | Out-Null

    $xmlContent = '<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>'
    
    Set-Content -Path (Join-Path $anydpiDir "ic_launcher.xml") -Value $xmlContent
    Set-Content -Path (Join-Path $anydpiDir "ic_launcher_round.xml") -Value $xmlContent
    Write-Host "Generated Adaptive Icon XMLs"

    Write-Host "`nAll icons completely reset and regenerated!"
    
}
catch {
    Write-Host "Error: $_"
    exit 1
}
