param(
  [string]$DataPath = "data.json",
  [string]$TemplatePath = "detail.html",
  [string]$OutputRoot = "sleeve"
)

$ErrorActionPreference = "Stop"

function Assert-Exists([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Label not found: $Path"
  }
}

Assert-Exists -Path $DataPath -Label "Data file"
Assert-Exists -Path $TemplatePath -Label "Template"

$data = Get-Content -LiteralPath $DataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$template = Get-Content -LiteralPath $TemplatePath -Raw -Encoding UTF8

if (-not (Test-Path -LiteralPath $OutputRoot)) {
  New-Item -ItemType Directory -Path $OutputRoot | Out-Null
}

$baseTag = '  <base href="../../" />'

foreach ($sleeve in @($data.sleeves)) {
  $id = [string]$sleeve.id
  if ([string]::IsNullOrWhiteSpace($id)) { continue }

  $encodedId = [System.Uri]::EscapeDataString($id)
  $jsId = ConvertTo-Json $id -Compress
  $canonicalTag = '  <link rel="canonical" href="/sleeve/' + $encodedId + '/" />'
  $inlineIdScript = '  <script>window.__SLEEVE_PAGE_ID = ' + $jsId + ';</script>'

  $content = $template
  $content = $content -replace '<head>', ("<head>`r`n" + $baseTag)
  $content = $content -replace '<meta name="description" content="[^"]*" />', ('$0' + "`r`n" + $canonicalTag)
  $content = $content -replace '<script src="\./assets/common\.js"></script>', ($inlineIdScript + "`r`n`r`n" + '  <script src="./assets/common.js"></script>')

  $targetDir = Join-Path $OutputRoot $id
  if (-not (Test-Path -LiteralPath $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
  }

  $targetPath = Join-Path $targetDir "index.html"
  Set-Content -LiteralPath $targetPath -Value $content -Encoding UTF8
}

Write-Output "Generated sleeve pages in $OutputRoot"
