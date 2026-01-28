# setup_ffmpeg.ps1
$BinDir = Join-Path $PSScriptRoot "mediaflow-core/bin"
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Force -Path $BinDir
}

$ZipPath = Join-Path $BinDir "ffmpeg.zip"
$DownloadUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"

Write-Host "Downloading FFmpeg from $DownloadUrl..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath

Write-Host "Extracting FFmpeg..." -ForegroundColor Cyan
$TempExtract = Join-Path $BinDir "temp_extract"
Expand-Archive -Path $ZipPath -DestinationPath $TempExtract -Force

# Move ffmpeg.exe and ffprobe.exe to bin/
$ExeFolder = Get-ChildItem -Path $TempExtract -Directory | Select-Object -First 1
$BinPath = Join-Path $ExeFolder.FullName "bin"

Copy-Item -Path (Join-Path $BinPath "ffmpeg.exe") -Destination $BinDir -Force
Copy-Item -Path (Join-Path $BinPath "ffprobe.exe") -Destination $BinDir -Force

# Cleanup
Write-Host "Cleaning up temporary files..." -ForegroundColor Cyan
Remove-Item -Path $ZipPath -Force
Remove-Item -Path $TempExtract -Recurse -Force

Write-Host "FFmpeg setup complete! Path: $BinDir" -ForegroundColor Green
