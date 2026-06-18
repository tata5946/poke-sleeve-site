param(
  [string]$SiteOrigin = "https://pokesuri-navi.com",
  [string]$DataPath = "data.json",
  [string]$OutputPath = "sitemap.xml"
)

$ErrorActionPreference = "Stop"

function Assert-Exists([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Label not found: $Path"
  }
}

function Normalize-Origin([string]$Origin) {
  return ([string]$Origin).TrimEnd("/")
}

function Get-SleeveRouteId([string]$Id) {
  $sleeveId = ([string]$Id).Trim()
  if ($sleeveId -match '^\d{6,7}$') { return "4521329$sleeveId" }
  return $sleeveId
}

Assert-Exists -Path $DataPath -Label "Data file"

$origin = Normalize-Origin $SiteOrigin
$today = Get-Date -Format "yyyy-MM-dd"
$data = Get-Content -LiteralPath $DataPath -Raw -Encoding UTF8 | ConvertFrom-Json

$staticPages = @(
  "",
  "index.html",
  "sleeves/",
  "ranking.html",
  "access-ranking.html",
  "growth.html",
  "surge.html",
  "index-market.html",
  "articles.html",
  "article.html",
  "abyss-eye.html",
  "chaos-rising.html",
  "june-19-restock.html",
  "contact.html",
  "contact-complete.html",
  "policy.html"
) | Select-Object -Unique

$sleeveIds = @($data.sleeves) |
  ForEach-Object { ([string]$_.id).Trim() } |
  Where-Object { $_ } |
  Select-Object -Unique |
  Sort-Object

$urls = New-Object System.Collections.Generic.List[string]
foreach ($page in $staticPages) {
  if ([string]::IsNullOrWhiteSpace($page)) {
    $urls.Add($origin + "/")
  } else {
    $urls.Add($origin + "/" + $page)
  }
}
foreach ($id in $sleeveIds) {
  $routeId = Get-SleeveRouteId $id
  $urls.Add($origin + "/sleeve/" + [System.Uri]::EscapeDataString($routeId) + "/")
}

$xml = New-Object System.Text.StringBuilder
[void]$xml.AppendLine('<?xml version="1.0" encoding="UTF-8"?>')
[void]$xml.AppendLine('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
foreach ($url in $urls) {
  [void]$xml.AppendLine('  <url>')
  [void]$xml.AppendLine("    <loc>$url</loc>")
  [void]$xml.AppendLine("    <lastmod>$today</lastmod>")
  [void]$xml.AppendLine('  </url>')
}
[void]$xml.AppendLine('</urlset>')

Set-Content -LiteralPath $OutputPath -Value $xml.ToString() -Encoding UTF8
Write-Output "Generated $OutputPath"
