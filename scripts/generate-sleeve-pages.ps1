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

function Get-SleeveRouteId([string]$Id) {
  $sleeveId = ([string]$Id).Trim()
  if ($sleeveId -match '^\d{6,7}$') { return "4521329$sleeveId" }
  return $sleeveId
}

Assert-Exists -Path $DataPath -Label "Data file"
Assert-Exists -Path $TemplatePath -Label "Template"

$data = Get-Content -LiteralPath $DataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$template = Get-Content -LiteralPath $TemplatePath -Raw -Encoding UTF8

if (-not (Test-Path -LiteralPath $OutputRoot)) {
  New-Item -ItemType Directory -Path $OutputRoot | Out-Null
}

$baseTag = '  <base href="../../" />'
$fallbackOgImage = 'https://pokesuri-navi.com/assets/favicon.svg'

foreach ($sleeve in @($data.sleeves)) {
  $id = [string]$sleeve.id
  if ([string]::IsNullOrWhiteSpace($id)) { continue }

  $routeId = Get-SleeveRouteId $id
  $encodedId = [System.Uri]::EscapeDataString($routeId)
  $jsId = ConvertTo-Json $id -Compress
  $jsSleeve = ConvertTo-Json $sleeve -Compress -Depth 100
  $name = ([string]$sleeve.name).Trim()
  $series = ([string]$sleeve.series).Trim()
  $condition = ([string]$sleeve.condition).Trim()
  $releaseYear = ([string]$sleeve.releaseYear).Trim()
  $ogTitle = if ($name) { "$name | ポケスリ相場ナビ" } else { "スリーブ相場 - ポケスリ相場ナビ" }
  $descParts = @($name)
  if ($releaseYear) { $descParts += "発売年 $releaseYear" }
  if ($series) { $descParts += "シリーズ $series" }
  if ($condition) { $descParts += "状態 $condition" }
  $ogDescription = if ($descParts.Count -gt 0) { ($descParts -join " / ") + " の価格推移ページです。" } else { "ポケカスリーブの週次価格推移を確認できる詳細ページです。" }
  $rawImage = ([string]$sleeve.imageUrl).Trim()
  $ogImage = if ($rawImage) { $rawImage } else { $fallbackOgImage }
  $ogUrl = "https://pokesuri-navi.com/sleeve/$encodedId/"
  $canonicalTag = '  <link rel="canonical" href="/sleeve/' + $encodedId + '/" />'
  $inlinePageDataScript = '  <script>window.__SLEEVE_PAGE_ID = ' + $jsId + ';window.__SLEEVE_PAGE_DATA = ' + $jsSleeve + ';</script>'

  $content = $template
  $content = $content -replace '<head>', ("<head>`r`n" + $baseTag)
  $content = [regex]::Replace($content, '<title>.*?</title>', ('  <title>' + ($ogTitle.Replace('$', '$$')) + '</title>'), 1)
  $content = [regex]::Replace($content, '<meta name="description" content="[^"]*" />', ('  <meta name="description" content="' + ($ogDescription.Replace('"', '&quot;').Replace('$', '$$')) + '" />'), 1)
  $content = [regex]::Replace($content, '<meta property="og:title" content="[^"]*" />', ('  <meta property="og:title" content="' + ($ogTitle.Replace('"', '&quot;').Replace('$', '$$')) + '" />'), 1)
  $content = [regex]::Replace($content, '<meta property="og:description" content="[^"]*" />', ('  <meta property="og:description" content="' + ($ogDescription.Replace('"', '&quot;').Replace('$', '$$')) + '" />'), 1)
  $content = [regex]::Replace($content, '<meta property="og:image" content="[^"]*" />', ('  <meta property="og:image" content="' + ($ogImage.Replace('"', '&quot;').Replace('$', '$$')) + '" />'), 1)
  $content = [regex]::Replace($content, '<meta property="og:url" content="[^"]*" />', ('  <meta property="og:url" content="' + ($ogUrl.Replace('"', '&quot;').Replace('$', '$$')) + '" />'), 1)
  if ($content -match '<link rel="canonical" href="[^"]*" />') {
    $content = [regex]::Replace($content, '<link rel="canonical" href="[^"]*" />', ($canonicalTag.Replace('$', '$$')), 1)
  } else {
    $content = [regex]::Replace(
      $content,
      '<meta property="og:url" content="[^"]*" />',
      {
        param($match)
        return $match.Value + "`r`n" + $canonicalTag
      },
      1
    )
  }
  $content = [regex]::Replace(
    $content,
    '<script src="\./assets/common\.js(?:\?[^"]*)?"></script>',
    ($inlinePageDataScript + "`r`n`r`n" + '$0'),
    1
  )

  $targetDir = Join-Path $OutputRoot $routeId
  if (-not (Test-Path -LiteralPath $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
  }

  $targetPath = Join-Path $targetDir "index.html"
  Set-Content -LiteralPath $targetPath -Value $content -Encoding UTF8
}

Write-Output "Generated sleeve pages in $OutputRoot"
