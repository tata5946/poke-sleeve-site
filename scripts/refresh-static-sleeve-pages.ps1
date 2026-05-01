param(
  [string]$TemplatePath = "detail.html",
  [string]$OutputRoot = "sleeve"
)

$ErrorActionPreference = "Stop"

function Assert-Exists([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Label not found: $Path"
  }
}

function Get-SleeveDataId([string]$RouteId) {
  $sleeveId = ([string]$RouteId).Trim()
  if ($sleeveId -match '^4521329\d{6,7}$') { return $sleeveId.Substring(7) }
  return $sleeveId
}

Assert-Exists -Path $TemplatePath -Label "Template"
Assert-Exists -Path $OutputRoot -Label "Sleeve directory"

$template = Get-Content -LiteralPath $TemplatePath -Raw -Encoding UTF8
$baseTag = '  <base href="../../" />'

Get-ChildItem -Path $OutputRoot -Recurse -Filter index.html -File | ForEach-Object {
  $targetPath = $_.FullName
  $current = Get-Content -LiteralPath $targetPath -Raw -Encoding UTF8
  $routeId = Split-Path -Path (Split-Path -Path $targetPath -Parent) -Leaf
  $id = Get-SleeveDataId $routeId
  if ([string]::IsNullOrWhiteSpace($id)) { return }

  $jsId = ConvertTo-Json $id -Compress
  $inlineIdScript = '  <script>window.__SLEEVE_PAGE_ID = ' + $jsId + ';</script>'
  $content = $template

  $content = $content -replace '<head>', ("<head>`r`n" + $baseTag)

  foreach ($pattern in @(
    '<title>.*?</title>',
    '<meta name="description" content="[^"]*" />',
    '<meta property="og:title" content="[^"]*" />',
    '<meta property="og:description" content="[^"]*" />',
    '<meta property="og:image" content="[^"]*" />',
    '<meta property="og:url" content="[^"]*" />',
    '<link rel="canonical" href="[^"]*" />'
  )) {
    $match = [regex]::Match($current, $pattern)
    if ($match.Success) {
      $content = [regex]::Replace($content, $pattern, ($match.Value.Replace('$', '$$')), 1)
    }
  }

  $content = [regex]::Replace(
    $content,
    '<script src="\./assets/common\.js(?:\?[^"]*)?"></script>',
    ($inlineIdScript + "`r`n`r`n" + '$0'),
    1
  )
  Set-Content -LiteralPath $targetPath -Value $content -Encoding UTF8
}

Write-Output "Refreshed static sleeve pages from $TemplatePath"
