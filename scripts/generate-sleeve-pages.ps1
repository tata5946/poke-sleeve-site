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
$fallbackOgImage = 'https://pokesuri-navi.com/assets/favicon.svg'

foreach ($sleeve in @($data.sleeves)) {
  $id = [string]$sleeve.id
  if ([string]::IsNullOrWhiteSpace($id)) { continue }

  $encodedId = [System.Uri]::EscapeDataString($id)
  $jsId = ConvertTo-Json $id -Compress
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
  $ogTags = @(
    '  <meta property="og:title" content="' + ($ogTitle.Replace('"', '&quot;')) + '" />',
    '  <meta property="og:description" content="' + ($ogDescription.Replace('"', '&quot;')) + '" />',
    '  <meta property="og:image" content="' + ($ogImage.Replace('"', '&quot;')) + '" />',
    '  <meta property="og:url" content="' + ($ogUrl.Replace('"', '&quot;')) + '" />'
  ) -join "`r`n"
  $inlineIdScript = '  <script>window.__SLEEVE_PAGE_ID = ' + $jsId + ';</script>'

  $content = $template
  $content = $content -replace '<head>', ("<head>`r`n" + $baseTag)
  $content = [regex]::Replace(
    $content,
    '<meta name="description" content="[^"]*" />',
    {
      param($match)
      return $match.Value + "`r`n" + $ogTags + "`r`n" + $canonicalTag
    },
    1
  )
  $content = [regex]::Replace(
    $content,
    '"\s*/>\s*<meta property="og:',
    {
      param($match)
      return '" />' + [Environment]::NewLine + '  <meta property="og:'
    }
  )
  $content = $content -replace '<script src="\./assets/common\.js"></script>', ($inlineIdScript + "`r`n`r`n" + '  <script src="./assets/common.js"></script>')

  $targetDir = Join-Path $OutputRoot $id
  if (-not (Test-Path -LiteralPath $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
  }

  $targetPath = Join-Path $targetDir "index.html"
  Set-Content -LiteralPath $targetPath -Value $content -Encoding UTF8
}

Write-Output "Generated sleeve pages in $OutputRoot"
