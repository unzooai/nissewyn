#requires -Version 5.1
<#
Build the Unzoo One installer (Windows MSI).

One product, one installer: the desktop client (this app), its background
service (unterm-core), the terminal (unterm) and the CLI, with the helpers the
terminal needs. All of them land flat in the install directory, which is
where each looks for the others.

Steps:
  1. Release-build the runtime and the terminal (unterm/ workspace).
  2. Build the interface (npm run build:static -> dist/client).
  3. Stage the runtime files into src-tauri/payload.
  4. Bundle with Tauri (WiX); the MSI lands in src-tauri/target/release/bundle/msi.

Usage (from the repository root):
  powershell -File apps\unzoo-one\build-installer.ps1
  powershell -File apps\unzoo-one\build-installer.ps1 -SkipRuntimeBuild
#>
[CmdletBinding()]
param(
  # Reuse unterm/target/release as it is (it was just built).
  [switch]$SkipRuntimeBuild,
  # Reuse dist/client as it is.
  [switch]$SkipInterfaceBuild
)
$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$unterm = Join-Path $root "unterm"
$tauri = Join-Path $PSScriptRoot "src-tauri"
$release = Join-Path $unterm "target\release"

function Run([string]$what, [scriptblock]$block) {
  Write-Host "==> $what"
  & $block
  if ($LASTEXITCODE -ne 0) { throw "$what failed (exit $LASTEXITCODE)" }
}

if (-not $SkipRuntimeBuild) {
  Push-Location $unterm
  try { Run "runtime and terminal (release)" { cargo build --release -p unterm-app -p unterm-cli -p unterm-core } }
  finally { Pop-Location }
}

if (-not $SkipInterfaceBuild) {
  Push-Location $root
  try { Run "interface (static)" { npm run build:static } }
  finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $root "dist\client\index.html"))) { throw "no interface build at dist\client" }

# Native helpers must match the build arch.
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
$helpers = if ($arch -eq "arm64") { Join-Path $unterm "assets\windows\arm64" } else { Join-Path $unterm "assets\windows" }

$payload = Join-Path $tauri "payload"
if (Test-Path $payload) { Remove-Item -Recurse -Force $payload }
New-Item -ItemType Directory -Path $payload | Out-Null

$flat = @(
  (Join-Path $release "unterm.exe"),
  (Join-Path $release "unterm-cli.exe"),
  (Join-Path $release "unterm-core.exe"),
  (Join-Path $helpers "conhost\conpty.dll"),
  (Join-Path $helpers "conhost\OpenConsole.exe"),
  (Join-Path $helpers "angle\libEGL.dll"),
  (Join-Path $helpers "angle\libGLESv2.dll")
)
foreach ($file in $flat) {
  if (-not (Test-Path $file)) { throw "missing: $file" }
  Copy-Item $file $payload
}
# Software-GL fallback for the terminal: x64 only.
New-Item -ItemType Directory -Path (Join-Path $payload "mesa") | Out-Null
if ($arch -ne "arm64") {
  Copy-Item (Join-Path $unterm "assets\windows\mesa\opengl32.dll") (Join-Path $payload "mesa")
}
New-Item -ItemType Directory -Path (Join-Path $payload "defaults") | Out-Null
Copy-Item (Join-Path $unterm "assets\unterm.conf") (Join-Path $payload "defaults")
$fonts = Join-Path $payload "assets\fonts"
New-Item -ItemType Directory -Path $fonts -Force | Out-Null
foreach ($font in "SymbolsNerdFontMono-Regular.ttf", "NotoColorEmoji.ttf", "JetBrainsMono-Regular.ttf") {
  Copy-Item (Join-Path $unterm "assets\fonts\$font") $fonts
}
Write-Host "==> staged $((Get-ChildItem $payload -Recurse -File).Count) runtime files"

Push-Location $PSScriptRoot
try { Run "installer (tauri build)" { npx --no-install tauri build } }
finally { Pop-Location }

$msi = Get-ChildItem (Join-Path $tauri "target\release\bundle\msi") -Filter *.msi | Sort-Object LastWriteTime | Select-Object -Last 1
Write-Host "==> $($msi.FullName)"
