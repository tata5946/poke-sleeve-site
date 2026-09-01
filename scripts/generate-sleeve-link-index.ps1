param(
  [string]$DataPath = "data.json",
  [string]$OutputPath = "sleeves/all.html",
  [string]$PageOutputRoot = "sleeves/page",
  [int]$PageSize = 50,
  [string]$SiteOrigin = "https://pokesuri-navi.com"
)

$ErrorActionPreference = "Stop"

function Assert-Exists([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Label not found: $Path"
  }
}

function ConvertTo-HtmlText([object]$Value) {
  return [System.Net.WebUtility]::HtmlEncode([string]$Value)
}

function ConvertTo-AbsoluteUrl([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { return "" }
  $origin = ([string]$SiteOrigin).TrimEnd("/")
  $normalized = ([string]$Path).Trim()
  if ($normalized.StartsWith("http://") -or $normalized.StartsWith("https://")) {
    return $normalized
  }
  if (-not $normalized.StartsWith("/")) { $normalized = "/" + $normalized }
  return $origin + $normalized
}

function Get-SleeveRouteId([string]$Id) {
  $sleeveId = ([string]$Id).Trim()
  if ($sleeveId -match '^\d{6,7}$') { return "4521329$sleeveId" }
  return $sleeveId
}

function Get-SleeveHref([object]$Sleeve) {
  $routeId = Get-SleeveRouteId ([string]$Sleeve.id)
  return "/sleeve/" + [System.Uri]::EscapeDataString($routeId) + "/"
}

function Get-PageHref([int]$PageNumber) {
  return "/sleeves/page/$PageNumber/"
}

function Get-NumberOrNull([object]$Value) {
  if ($null -eq $Value) { return $null }
  $text = ([string]$Value).Trim()
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }
  $n = 0.0
  if ([double]::TryParse($text, [ref]$n)) { return $n }
  return $null
}

function Get-IsoDate([object]$Value, [string]$FallbackDay = "01") {
  if ($null -eq $Value) { return "" }
  $text = ([string]$Value).Trim()
  if ([string]::IsNullOrWhiteSpace($text)) { return "" }
  if ($text -match '^\d{4}-\d{2}-\d{2}$') { return $text }
  if ($text -match '^\d{4}-\d{2}$') { return "$text-$FallbackDay" }
  if ($text -match '^\d{4}$') { return "$text-01-01" }
  try {
    return ([datetime]$text).ToString("yyyy-MM-dd")
  } catch {
    return ""
  }
}

function Get-DateText([object]$Value) {
  $date = Get-IsoDate $Value
  if ([string]::IsNullOrWhiteSpace($date)) { return "&#26410;&#21462;&#24471;" }
  return ConvertTo-HtmlText $date
}

function Get-YenText([object]$Value, [string]$Fallback = "&#26410;&#21462;&#24471;") {
  $price = Get-NumberOrNull $Value
  if ($null -ne $price -and $price -gt 0) {
    return ("{0:N0}&#20870;" -f $price)
  }
  return $Fallback
}

function Get-PropertyValue([object]$Object, [string]$Name) {
  if ($null -eq $Object) { return $null }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) { return $null }
  return $property.Value
}

function Get-LatestSeriesPrice([object]$Rows, [string]$DateProperty) {
  $latestDate = ""
  $latestPrice = $null
  foreach ($row in @($Rows)) {
    if ($null -eq $row) { continue }
    $date = Get-IsoDate (Get-PropertyValue $row $DateProperty)
    $price = Get-NumberOrNull (Get-PropertyValue $row "price")
    if ($date -and $null -ne $price -and $price -gt 0 -and ($latestDate -eq "" -or $date -gt $latestDate)) {
      $latestDate = $date
      $latestPrice = $price
    }
  }
  return $latestPrice
}

function Get-LatestPriceValue([object]$Sleeve) {
  $weekly = Get-LatestSeriesPrice $Sleeve.weeklyPrices "week"
  if ($null -ne $weekly) { return $weekly }

  $monthly = Get-LatestSeriesPrice $Sleeve.monthlyPrices "month"
  if ($null -ne $monthly) { return $monthly }

  $yearly = Get-LatestSeriesPrice $Sleeve.yearlyPrices "year"
  if ($null -ne $yearly) { return $yearly }

  if ($Sleeve.pricesByYear) {
    $latestYear = 0
    $latestPrice = $null
    foreach ($property in @($Sleeve.pricesByYear.PSObject.Properties)) {
      $year = 0
      $price = Get-NumberOrNull $property.Value
      if ([int]::TryParse($property.Name, [ref]$year) -and $null -ne $price -and $price -gt 0 -and $year -gt $latestYear) {
        $latestYear = $year
        $latestPrice = $price
      }
    }
    if ($null -ne $latestPrice) { return $latestPrice }
  }

  return $null
}

function Get-LatestDataDate([array]$Items) {
  $latest = ""
  foreach ($sleeve in $Items) {
    foreach ($date in @(
      (Get-IsoDate $sleeve.releaseDate),
      (Get-IsoDate $sleeve.releaseYear)
    )) {
      if ($date -and ($latest -eq "" -or $date -gt $latest)) { $latest = $date }
    }
    foreach ($row in @($sleeve.weeklyPrices)) {
      if ($null -eq $row) { continue }
      $date = Get-IsoDate $row.week
      if ($date -and ($latest -eq "" -or $date -gt $latest)) { $latest = $date }
    }
    foreach ($row in @($sleeve.monthlyPrices)) {
      if ($null -eq $row) { continue }
      $date = Get-IsoDate $row.month
      if ($date -and ($latest -eq "" -or $date -gt $latest)) { $latest = $date }
    }
    foreach ($row in @($sleeve.yearlyPrices)) {
      if ($null -eq $row) { continue }
      $date = Get-IsoDate $row.year
      if ($date -and ($latest -eq "" -or $date -gt $latest)) { $latest = $date }
    }
  }
  if ($latest) { return $latest }
  return Get-Date -Format "yyyy-MM-dd"
}

function Append-PageShellStart([System.Text.StringBuilder]$Html, [string]$TitleHtml, [string]$DescriptionHtml, [string]$CanonicalUrl, [string]$BaseHref = "../") {
  [void]$Html.AppendLine('<!DOCTYPE html>')
  [void]$Html.AppendLine('<html lang="ja">')
  [void]$Html.AppendLine('<head>')
  [void]$Html.AppendLine(("  <base href=""{0}"" />" -f (ConvertTo-HtmlText $BaseHref)))
  [void]$Html.AppendLine('  <meta charset="UTF-8" />')
  [void]$Html.AppendLine('  <meta name="viewport" content="width=device-width, initial-scale=1" />')
  [void]$Html.AppendLine(("  <title>{0}</title>" -f $TitleHtml))
  [void]$Html.AppendLine(("  <meta name=""description"" content=""{0}"" />" -f $DescriptionHtml))
  [void]$Html.AppendLine(("  <meta property=""og:title"" content=""{0}"" />" -f $TitleHtml))
  [void]$Html.AppendLine(("  <meta property=""og:description"" content=""{0}"" />" -f $DescriptionHtml))
  [void]$Html.AppendLine('  <meta property="og:image" content="https://pokesuri-navi.com/assets/favicon.svg" />')
  [void]$Html.AppendLine(("  <meta property=""og:url"" content=""{0}"" />" -f (ConvertTo-HtmlText $CanonicalUrl)))
  [void]$Html.AppendLine(("  <link rel=""canonical"" href=""{0}"" />" -f (ConvertTo-HtmlText $CanonicalUrl)))
  [void]$Html.AppendLine('  <link rel="stylesheet" href="./assets/site.css?v=20260901a" />')
  [void]$Html.AppendLine('  <style>')
  [void]$Html.AppendLine('    body { background: #f7f9fd; color: #0f172a; }')
  [void]$Html.AppendLine('    .index-wrap { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 48px; }')
  [void]$Html.AppendLine('    .breadcrumb { margin-bottom: 16px; }')
  [void]$Html.AppendLine('    .index-hero { display: grid; gap: 8px; margin-bottom: 22px; }')
  [void]$Html.AppendLine('    .index-hero h1 { margin: 0; font-size: clamp(28px, 4vw, 44px); letter-spacing: 0; }')
  [void]$Html.AppendLine('    .index-hero p { margin: 0; color: #64748b; line-height: 1.8; }')
  [void]$Html.AppendLine('    .index-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }')
  [void]$Html.AppendLine('    .index-action-link { display: inline-flex; align-items: center; min-height: 36px; padding: 0 12px; border: 1px solid #dbe4f0; border-radius: 8px; background: #fff; color: #0f172a; font-weight: 800; text-decoration: none; }')
  [void]$Html.AppendLine('    .sleeve-index-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; padding: 0; margin: 0; list-style: none; }')
  [void]$Html.AppendLine('    .sleeve-index-item a { min-height: 148px; display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 12px; padding: 12px; border: 1px solid #dbe4f0; border-radius: 8px; background: #fff; color: inherit; text-decoration: none; }')
  [void]$Html.AppendLine('    .sleeve-index-item a:hover { border-color: #94a3b8; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08); }')
  [void]$Html.AppendLine('    .sleeve-index-thumb { width: 76px; aspect-ratio: 1 / 1; display: grid; place-items: center; overflow: hidden; border-radius: 7px; background: #f1f5f9; }')
  [void]$Html.AppendLine('    .sleeve-index-thumb img { width: 100%; height: 100%; object-fit: contain; }')
  [void]$Html.AppendLine('    .sleeve-index-body { display: grid; align-content: start; gap: 6px; min-width: 0; }')
  [void]$Html.AppendLine('    .sleeve-index-name { font-weight: 900; line-height: 1.35; }')
  [void]$Html.AppendLine('    .sleeve-index-meta { display: grid; gap: 3px; color: #64748b; font-size: 13px; line-height: 1.45; }')
  [void]$Html.AppendLine('    .sleeve-index-meta span { overflow-wrap: anywhere; }')
  [void]$Html.AppendLine('    .index-pager { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin: 22px 0 0; }')
  [void]$Html.AppendLine('    .index-pager a { min-width: 36px; min-height: 36px; display: inline-flex; align-items: center; justify-content: center; padding: 0 10px; border: 1px solid #dbe4f0; border-radius: 8px; background: #fff; color: #0f172a; font-weight: 800; text-decoration: none; }')
  [void]$Html.AppendLine('    .index-pager [aria-current="page"] { border-color: #0f172a; background: #0f172a; color: #fff; }')
  [void]$Html.AppendLine('    @media (max-width: 560px) { .sleeve-index-list { grid-template-columns: 1fr; } .sleeve-index-item a { grid-template-columns: 70px minmax(0, 1fr); } }')
  [void]$Html.AppendLine('  </style>')
  [void]$Html.AppendLine('</head>')
  [void]$Html.AppendLine('<body class="page-market-list" data-hide-global-header="1">')
  [void]$Html.AppendLine('  <div id="site-header"></div>')
  [void]$Html.AppendLine('  <div class="dashboard-shell">')
  [void]$Html.AppendLine('    <aside class="dashboard-sidebar" aria-label="&#12469;&#12452;&#12489;&#12496;&#12540;">')
  [void]$Html.AppendLine('      <div id="dashboardSidebarSlot" data-dashboard-sidebar-active="zukan"></div>')
  [void]$Html.AppendLine('    </aside>')
  [void]$Html.AppendLine('    <main class="dashboard-main">')
  [void]$Html.AppendLine('      <header class="dashboard-topbar">')
  [void]$Html.AppendLine('        <div id="dashboardTopbarSlot"></div>')
  [void]$Html.AppendLine('      </header>')
  [void]$Html.AppendLine('      <div class="dashboard-content">')
  [void]$Html.AppendLine('        <div class="index-wrap">')
}

function Append-PageShellEnd([System.Text.StringBuilder]$Html) {
  [void]$Html.AppendLine('        </div>')
  [void]$Html.AppendLine('        <div id="site-footer"></div>')
  [void]$Html.AppendLine('      </div>')
  [void]$Html.AppendLine('    </main>')
  [void]$Html.AppendLine('  </div>')
  [void]$Html.AppendLine('  <script src="./assets/common.js?v=20260901a"></script>')
  [void]$Html.AppendLine('  <script>')
  [void]$Html.AppendLine('    document.addEventListener("DOMContentLoaded", async () => {')
  [void]$Html.AppendLine('      if (window.common && typeof window.common.setupDashboardChrome === "function") {')
  [void]$Html.AppendLine('        await window.common.setupDashboardChrome({ sidebarActive: "zukan" });')
  [void]$Html.AppendLine('      }')
  [void]$Html.AppendLine('    });')
  [void]$Html.AppendLine('  </script>')
  [void]$Html.AppendLine('</body>')
  [void]$Html.AppendLine('</html>')
}

function Append-Breadcrumb([System.Text.StringBuilder]$Html, [string]$CurrentLabelHtml) {
  [void]$Html.AppendLine('          <nav class="breadcrumb" aria-label="breadcrumb">')
  [void]$Html.AppendLine('            <a href="./">&#12507;&#12540;&#12512;</a>')
  [void]$Html.AppendLine('            <span class="breadcrumb-sep" aria-hidden="true">&gt;</span>')
  [void]$Html.AppendLine('            <a href="./sleeves/">&#22259;&#37969;</a>')
  [void]$Html.AppendLine('            <span class="breadcrumb-sep" aria-hidden="true">&gt;</span>')
  [void]$Html.AppendLine(("            <span class=""breadcrumb-current"" aria-current=""page"">{0}</span>" -f $CurrentLabelHtml))
  [void]$Html.AppendLine('          </nav>')
}

function Append-ItemList([System.Text.StringBuilder]$Html, [array]$Items) {
  [void]$Html.AppendLine('          <ul class="sleeve-index-list">')
  foreach ($sleeve in $Items) {
    $href = Get-SleeveHref $sleeve
    $name = ConvertTo-HtmlText $sleeve.name
    $imageUrl = ConvertTo-HtmlText $sleeve.imageUrl
    $releaseDate = Get-DateText $sleeve.releaseDate
    $firstPrice = Get-YenText $sleeve.firstPrice
    $latestPrice = Get-LatestPriceValue $sleeve
    $currentPrice = Get-YenText $latestPrice "&#20385;&#26684;&#12487;&#12540;&#12479;&#12394;&#12375;"
    [void]$Html.AppendLine('            <li class="sleeve-index-item">')
    [void]$Html.AppendLine(("              <a href=""{0}"">" -f (ConvertTo-HtmlText $href)))
    [void]$Html.AppendLine('                <span class="sleeve-index-thumb">')
    if (-not [string]::IsNullOrWhiteSpace($imageUrl)) {
      [void]$Html.AppendLine(("                  <img src=""{0}"" alt=""{1}"" loading=""lazy"" referrerpolicy=""no-referrer"" />" -f $imageUrl, $name))
    }
    [void]$Html.AppendLine('                </span>')
    [void]$Html.AppendLine('                <span class="sleeve-index-body">')
    [void]$Html.AppendLine(("                  <span class=""sleeve-index-name"">{0}</span>" -f $name))
    [void]$Html.AppendLine('                  <span class="sleeve-index-meta">')
    [void]$Html.AppendLine(("                    <span>&#30330;&#22770;&#26085; {0}</span>" -f $releaseDate))
    [void]$Html.AppendLine(("                    <span>&#30330;&#22770;&#26178;&#20385;&#26684; {0}</span>" -f $firstPrice))
    [void]$Html.AppendLine(("                    <span>&#29694;&#22312;&#30456;&#22580; {0}</span>" -f $currentPrice))
    [void]$Html.AppendLine('                  </span>')
    [void]$Html.AppendLine('                </span>')
    [void]$Html.AppendLine('              </a>')
    [void]$Html.AppendLine('            </li>')
  }
  [void]$Html.AppendLine('          </ul>')
}

function Append-Pager([System.Text.StringBuilder]$Html, [int]$CurrentPage, [int]$TotalPages) {
  if ($TotalPages -le 1) { return }
  [void]$Html.AppendLine('          <nav class="index-pager" aria-label="&#12506;&#12540;&#12472;&#36865;&#12426;">')
  if ($CurrentPage -gt 1) {
    $prevHref = Get-PageHref ($CurrentPage - 1)
    [void]$Html.AppendLine(("            <a href=""{0}"" rel=""prev"">&#21069;&#12408;</a>" -f $prevHref))
  }
  for ($page = 1; $page -le $TotalPages; $page++) {
    $href = Get-PageHref $page
    if ($page -eq $CurrentPage) {
      [void]$Html.AppendLine(("            <a href=""{0}"" aria-current=""page"">{1}</a>" -f $href, $page))
    } else {
      [void]$Html.AppendLine(("            <a href=""{0}"">{1}</a>" -f $href, $page))
    }
  }
  if ($CurrentPage -lt $TotalPages) {
    $nextHref = Get-PageHref ($CurrentPage + 1)
    [void]$Html.AppendLine(("            <a href=""{0}"" rel=""next"">&#27425;&#12408;</a>" -f $nextHref))
  }
  [void]$Html.AppendLine('          </nav>')
}

function Write-TextIfChanged([string]$Path, [string]$Text) {
  $resolvedPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
  $dir = Split-Path -Path $resolvedPath -Parent
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  $content = $Text.TrimEnd("`r", "`n") + "`r`n"
  if ((Test-Path -LiteralPath $resolvedPath) -and ([System.IO.File]::ReadAllText($resolvedPath) -eq $content)) {
    return $false
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
  [System.IO.File]::WriteAllText($resolvedPath, $content, $utf8NoBom)
  return $true
}

function Build-AllIndexHtml([array]$Items, [int]$TotalPages, [string]$LastUpdated) {
  $title = "&#20840;&#12473;&#12522;&#12540;&#12502;&#32034;&#24341; | &#12509;&#12465;&#12473;&#12522;&#30456;&#22580;&#12490;&#12499;"
  $description = "&#12509;&#12465;&#12514;&#12531;&#12459;&#12540;&#12489;&#12398;&#12473;&#12522;&#12540;&#12502;&#35443;&#32048;&#12506;&#12540;&#12472;&#12434;&#19968;&#35239;&#12391;&#25506;&#12379;&#12427;&#32034;&#24341;&#12506;&#12540;&#12472;&#12391;&#12377;&#12290;"
  $html = New-Object System.Text.StringBuilder
  $canonicalUrl = ConvertTo-AbsoluteUrl "/sleeves/all.html"
  Append-PageShellStart $html $title $description $canonicalUrl "../"
  Append-Breadcrumb $html "&#20840;&#12473;&#12522;&#12540;&#12502;&#32034;&#24341;"
  [void]$html.AppendLine('          <section class="index-hero" aria-labelledby="pageTitle">')
  [void]$html.AppendLine('            <h1 id="pageTitle">&#20840;&#12473;&#12522;&#12540;&#12502;&#32034;&#24341;</h1>')
  [void]$html.AppendLine(("            <p>{0} &#20214;&#12398;&#12473;&#12522;&#12540;&#12502;&#35443;&#32048;&#12506;&#12540;&#12472;&#12434;&#19968;&#35239;&#12391;&#30906;&#35469;&#12391;&#12365;&#12414;&#12377;&#12290;&#26368;&#32066;&#12487;&#12540;&#12479;&#26356;&#26032;: {1}</p>" -f $Items.Count, (ConvertTo-HtmlText $LastUpdated)))
  [void]$html.AppendLine('            <div class="index-actions">')
  [void]$html.AppendLine('              <a class="index-action-link" href="/sleeves/">&#26908;&#32034;&#12391;&#12365;&#12427;&#22259;&#37969;&#12408;</a>')
  [void]$html.AppendLine('              <a class="index-action-link" href="/sleeves/page/1/">&#12506;&#12540;&#12472;&#20998;&#21106;&#19968;&#35239;&#12408;</a>')
  [void]$html.AppendLine('            </div>')
  [void]$html.AppendLine('          </section>')
  Append-ItemList $html $Items
  Append-PageShellEnd $html
  return $html.ToString()
}

function Build-PageIndexHtml([array]$Items, [int]$PageNumber, [int]$TotalPages, [int]$TotalItems, [string]$LastUpdated) {
  $start = (($PageNumber - 1) * $PageSize) + 1
  $end = [math]::Min($PageNumber * $PageSize, $TotalItems)
  $title = "&#12473;&#12522;&#12540;&#12502;&#19968;&#35239; $PageNumber &#12506;&#12540;&#12472;&#30446; | &#12509;&#12465;&#12473;&#12522;&#30456;&#22580;&#12490;&#12499;"
  $description = "&#12509;&#12465;&#12514;&#12531;&#12459;&#12540;&#12489;&#12398;&#12473;&#12522;&#12540;&#12502;&#12539;&#12487;&#12483;&#12461;&#12471;&#12540;&#12523;&#19968;&#35239; $PageNumber &#12506;&#12540;&#12472;&#30446;&#12391;&#12377;&#12290;$start-$end &#20214;&#30446;&#12398;&#20491;&#21029;&#12506;&#12540;&#12472;&#12408;&#31227;&#21205;&#12391;&#12365;&#12414;&#12377;&#12290;"
  $pageHref = Get-PageHref $PageNumber
  $canonicalUrl = ConvertTo-AbsoluteUrl $pageHref
  $html = New-Object System.Text.StringBuilder
  Append-PageShellStart $html $title $description $canonicalUrl "../../../"
  Append-Breadcrumb $html "&#12473;&#12522;&#12540;&#12502;&#19968;&#35239; $PageNumber &#12506;&#12540;&#12472;&#30446;"
  [void]$html.AppendLine('          <section class="index-hero" aria-labelledby="pageTitle">')
  [void]$html.AppendLine(("            <h1 id=""pageTitle"">&#12473;&#12522;&#12540;&#12502;&#19968;&#35239; {0} &#12506;&#12540;&#12472;&#30446;</h1>" -f $PageNumber))
  [void]$html.AppendLine(("            <p>&#20840; {0} &#20214;&#20013; {1}-{2} &#20214;&#30446;&#12434;&#34920;&#31034;&#12375;&#12390;&#12356;&#12414;&#12377;&#12290;&#26368;&#32066;&#12487;&#12540;&#12479;&#26356;&#26032;: {3}</p>" -f $TotalItems, $start, $end, (ConvertTo-HtmlText $LastUpdated)))
  [void]$html.AppendLine('            <div class="index-actions">')
  [void]$html.AppendLine('              <a class="index-action-link" href="/sleeves/">&#26908;&#32034;&#12391;&#12365;&#12427;&#22259;&#37969;&#12408;</a>')
  [void]$html.AppendLine('              <a class="index-action-link" href="/sleeves/all.html">&#20840;&#12487;&#12483;&#12461;&#12471;&#12540;&#12523;&#19968;&#35239;&#12408;</a>')
  [void]$html.AppendLine('            </div>')
  [void]$html.AppendLine('          </section>')
  Append-ItemList $html $Items
  Append-Pager $html $PageNumber $TotalPages
  Append-PageShellEnd $html
  return $html.ToString()
}

Assert-Exists -Path $DataPath -Label "Data file"
if ($PageSize -lt 1) { throw "PageSize must be 1 or greater." }

$data = Get-Content -LiteralPath $DataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$items = @($data.sleeves) |
  Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.id) } |
  Sort-Object @{ Expression = { Get-IsoDate $_.releaseDate }; Descending = $true }, @{ Expression = { [string]$_.name }; Ascending = $true }

$lastUpdated = Get-LatestDataDate $items
$totalPages = [int][math]::Ceiling($items.Count / $PageSize)
if ($totalPages -lt 1) { $totalPages = 1 }

$changed = @()
$allIndexHtml = Build-AllIndexHtml $items $totalPages $lastUpdated
if (Write-TextIfChanged $OutputPath $allIndexHtml) {
  $changed += $OutputPath
}

for ($page = 1; $page -le $totalPages; $page++) {
  $pageItems = @($items | Select-Object -Skip (($page - 1) * $PageSize) -First $PageSize)
  $pagePath = Join-Path -Path $PageOutputRoot -ChildPath (Join-Path -Path ([string]$page) -ChildPath "index.html")
  $pageIndexHtml = Build-PageIndexHtml $pageItems $page $totalPages $items.Count $lastUpdated
  if (Write-TextIfChanged $pagePath $pageIndexHtml) {
    $changed += $pagePath
  }
}

Write-Output ("Generated all index and {0} paginated index pages ({1} items)." -f $totalPages, $items.Count)
if ($changed.Count -gt 0) {
  Write-Output ("Changed files: " + ($changed -join ", "))
} else {
  Write-Output "No generated files changed."
}
