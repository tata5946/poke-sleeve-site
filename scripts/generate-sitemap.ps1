param(
  [string]$SiteOrigin = "https://pokesuri-navi.com",
  [string]$DataPath = "data.json",
  [string]$OutputPath = "sitemap.xml",
  [string]$PageOutputRoot = "sleeves/page",
  [int]$PageSize = 50
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

function Get-ExistingLastmodMap([string]$Path) {
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  try {
    [xml]$existing = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    foreach ($url in @($existing.urlset.url)) {
      $loc = [string]$url.loc
      $lastmod = [string]$url.lastmod
      if ($loc -and $lastmod) { $map[$loc] = $lastmod }
    }
  } catch {}
  return $map
}

function Get-PageFileLastmod([int]$PageNumber) {
  $path = Join-Path -Path $PageOutputRoot -ChildPath (Join-Path -Path ([string]$PageNumber) -ChildPath "index.html")
  if (Test-Path -LiteralPath $path) {
    return (Get-Item -LiteralPath $path).LastWriteTime.ToString("yyyy-MM-dd")
  }
  return $null
}

function Get-StaticFileLastmod([string]$Path) {
  if (Test-Path -LiteralPath $Path) {
    return (Get-Item -LiteralPath $Path).LastWriteTime.ToString("yyyy-MM-dd")
  }
  return $null
}

function Add-Url([System.Collections.Generic.List[object]]$List, [string]$Url, [hashtable]$ExistingLastmods, [string]$Lastmod = $null) {
  $effectiveLastmod = $Lastmod
  if (-not $effectiveLastmod -and $ExistingLastmods.ContainsKey($Url)) {
    $effectiveLastmod = $ExistingLastmods[$Url]
  }
  if (-not $effectiveLastmod) {
    $effectiveLastmod = Get-Date -Format "yyyy-MM-dd"
  }
  $List.Add([pscustomobject]@{
    Loc = $Url
    Lastmod = $effectiveLastmod
  })
}

Assert-Exists -Path $DataPath -Label "Data file"
if ($PageSize -lt 1) { throw "PageSize must be 1 or greater." }

$origin = Normalize-Origin $SiteOrigin
$data = Get-Content -LiteralPath $DataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$existingLastmods = Get-ExistingLastmodMap $OutputPath

$staticPages = @(
  "",
  "sleeves/",
  "sleeves/all.html",
  "ranking.html",
  "access-ranking.html",
  "growth.html",
  "surge.html",
  "index-market.html",
  "articles.html",
  "abyss-eye.html",
  "chaos-rising.html",
  "storm-emerald.html",
  "june-19-restock.html",
  "contact.html",
  "policy.html"
) | Select-Object -Unique

$sleeveIds = @($data.sleeves) |
  ForEach-Object { ([string]$_.id).Trim() } |
  Where-Object { $_ } |
  Select-Object -Unique |
  Sort-Object

$urls = New-Object 'System.Collections.Generic.List[object]'
foreach ($page in $staticPages) {
  $url = ""
  $lastmod = $null
  if ([string]::IsNullOrWhiteSpace($page)) {
    $url = $origin + "/"
  } else {
    $url = $origin + "/" + $page
    if ($page -eq "sleeves/all.html") {
      $lastmod = Get-StaticFileLastmod $page
    }
  }
  Add-Url $urls $url $existingLastmods $lastmod
}

$totalPages = [int][math]::Ceiling($sleeveIds.Count / $PageSize)
for ($page = 1; $page -le $totalPages; $page++) {
  $url = $origin + "/sleeves/page/$page/"
  Add-Url $urls $url $existingLastmods (Get-PageFileLastmod $page)
}
foreach ($id in $sleeveIds) {
  $routeId = Get-SleeveRouteId $id
  Add-Url $urls ($origin + "/sleeve/" + [System.Uri]::EscapeDataString($routeId) + "/") $existingLastmods
}

$xml = New-Object System.Text.StringBuilder
[void]$xml.AppendLine('<?xml version="1.0" encoding="UTF-8"?>')
[void]$xml.AppendLine('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
foreach ($url in $urls) {
  [void]$xml.AppendLine('  <url>')
  [void]$xml.AppendLine(("    <loc>{0}</loc>" -f $url.Loc))
  [void]$xml.AppendLine(("    <lastmod>{0}</lastmod>" -f $url.Lastmod))
  [void]$xml.AppendLine('  </url>')
}
[void]$xml.AppendLine('</urlset>')

[System.IO.File]::WriteAllText(
  $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath),
  $xml.ToString().TrimEnd("`r", "`n") + "`r`n",
  [System.Text.UTF8Encoding]::new($false)
)
Write-Output "Generated $OutputPath"
