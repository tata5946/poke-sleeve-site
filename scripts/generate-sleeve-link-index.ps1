param(
  [string]$DataPath = "data.json",
  [string]$OutputPath = "sleeves/all.html"
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

function Get-SleeveRouteId([string]$Id) {
  $sleeveId = ([string]$Id).Trim()
  if ($sleeveId -match '^\d{6,7}$') { return "4521329$sleeveId" }
  return $sleeveId
}

function Get-LatestPriceText([object]$Sleeve) {
  $weekly = @($Sleeve.weeklyPrices) | Where-Object {
    $null -ne $_.price -and [double]$_.price -gt 0
  }
  if ($weekly.Count -gt 0) {
    return ("&#26368;&#26032; {0:N0}&#20870;" -f [double]$weekly[-1].price)
  }

  $yearly = @($Sleeve.yearlyPrices) | Where-Object {
    $null -ne $_.price -and [double]$_.price -gt 0
  }
  if ($yearly.Count -gt 0) {
    return ("&#24180;&#27425; {0:N0}&#20870;" -f [double]$yearly[-1].price)
  }

  if ($Sleeve.pricesByYear) {
    $pricesByYear = @($Sleeve.pricesByYear.PSObject.Properties) |
      Where-Object { $null -ne $_.Value -and [double]$_.Value -gt 0 } |
      Sort-Object { [int]$_.Name }
    if ($pricesByYear.Count -gt 0) {
      return ("&#24180;&#27425; {0:N0}&#20870;" -f [double]$pricesByYear[-1].Value)
    }
  }

  $monthly = @($Sleeve.monthlyPrices) | Where-Object {
    $null -ne $_.price -and [double]$_.price -gt 0
  }
  if ($monthly.Count -gt 0) {
    return ("&#26376;&#27425; {0:N0}&#20870;" -f [double]$monthly[-1].price)
  }

  return "&#20385;&#26684;&#12487;&#12540;&#12479;&#12394;&#12375;"
}

Assert-Exists -Path $DataPath -Label "Data file"

$data = Get-Content -LiteralPath $DataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$today = Get-Date -Format "yyyy-MM-dd"
$outputDir = Split-Path -Path $OutputPath -Parent
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$items = @($data.sleeves) |
  Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.id) } |
  Sort-Object @{ Expression = { [string]$_.releaseYear }; Descending = $true }, @{ Expression = { [string]$_.name }; Ascending = $true }

$html = New-Object System.Text.StringBuilder
[void]$html.AppendLine('<!DOCTYPE html>')
[void]$html.AppendLine('<html lang="ja">')
[void]$html.AppendLine('<head>')
[void]$html.AppendLine('  <base href="../" />')
[void]$html.AppendLine('  <meta charset="UTF-8" />')
[void]$html.AppendLine('  <meta name="viewport" content="width=device-width, initial-scale=1" />')
[void]$html.AppendLine('  <title>&#20840;&#12473;&#12522;&#12540;&#12502;&#32034;&#24341; | &#12509;&#12465;&#12473;&#12522;&#30456;&#22580;&#12490;&#12499;</title>')
[void]$html.AppendLine('  <meta name="description" content="&#12509;&#12465;&#12514;&#12531;&#12459;&#12540;&#12489;&#12398;&#12473;&#12522;&#12540;&#12502;&#35443;&#32048;&#12506;&#12540;&#12472;&#12434;&#19968;&#35239;&#12391;&#25506;&#12379;&#12427;&#32034;&#24341;&#12506;&#12540;&#12472;&#12391;&#12377;&#12290;" />')
[void]$html.AppendLine('  <meta property="og:title" content="&#20840;&#12473;&#12522;&#12540;&#12502;&#32034;&#24341; | &#12509;&#12465;&#12473;&#12522;&#30456;&#22580;&#12490;&#12499;" />')
[void]$html.AppendLine('  <meta property="og:description" content="&#12509;&#12465;&#12514;&#12531;&#12459;&#12540;&#12489;&#12398;&#12473;&#12522;&#12540;&#12502;&#35443;&#32048;&#12506;&#12540;&#12472;&#12434;&#19968;&#35239;&#12391;&#25506;&#12379;&#12427;&#32034;&#24341;&#12506;&#12540;&#12472;&#12391;&#12377;&#12290;" />')
[void]$html.AppendLine('  <meta property="og:image" content="https://pokesuri-navi.com/assets/favicon.svg" />')
[void]$html.AppendLine('  <meta property="og:url" content="https://pokesuri-navi.com/sleeves/all.html" />')
[void]$html.AppendLine('  <link rel="canonical" href="https://pokesuri-navi.com/sleeves/all.html" />')
[void]$html.AppendLine('  <link rel="stylesheet" href="./assets/site.css?v=20260816f" />')
[void]$html.AppendLine('  <style>')
[void]$html.AppendLine('    body { background: #f7f9fd; color: #0f172a; }')
[void]$html.AppendLine('    .index-wrap { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 48px; }')
[void]$html.AppendLine('    .breadcrumb { margin-bottom: 16px; }')
[void]$html.AppendLine('    .index-hero { display: grid; gap: 8px; margin-bottom: 22px; }')
[void]$html.AppendLine('    .index-hero h1 { margin: 0; font-size: clamp(28px, 4vw, 44px); letter-spacing: 0; }')
[void]$html.AppendLine('    .index-hero p { margin: 0; color: #64748b; line-height: 1.8; }')
[void]$html.AppendLine('    .sleeve-index-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; padding: 0; margin: 0; list-style: none; }')
[void]$html.AppendLine('    .sleeve-index-item a { min-height: 96px; display: grid; gap: 7px; padding: 14px; border: 1px solid #dbe4f0; border-radius: 8px; background: #fff; color: inherit; text-decoration: none; }')
[void]$html.AppendLine('    .sleeve-index-item a:hover { border-color: #94a3b8; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08); }')
[void]$html.AppendLine('    .sleeve-index-name { font-weight: 800; line-height: 1.35; }')
[void]$html.AppendLine('    .sleeve-index-meta { color: #64748b; font-size: 13px; line-height: 1.5; }')
[void]$html.AppendLine('  </style>')
[void]$html.AppendLine('</head>')
[void]$html.AppendLine('<body class="page-market-list" data-hide-global-header="1">')
[void]$html.AppendLine('  <div id="site-header"></div>')
[void]$html.AppendLine('  <div class="dashboard-shell">')
[void]$html.AppendLine('    <aside class="dashboard-sidebar" aria-label="&#12469;&#12452;&#12489;&#12496;&#12540;">')
[void]$html.AppendLine('      <div id="dashboardSidebarSlot" data-dashboard-sidebar-active="zukan"></div>')
[void]$html.AppendLine('    </aside>')
[void]$html.AppendLine('    <main class="dashboard-main">')
[void]$html.AppendLine('      <header class="dashboard-topbar">')
[void]$html.AppendLine('        <div id="dashboardTopbarSlot"></div>')
[void]$html.AppendLine('      </header>')
[void]$html.AppendLine('      <div class="dashboard-content">')
[void]$html.AppendLine('        <div class="index-wrap">')
[void]$html.AppendLine('    <nav class="breadcrumb" aria-label="breadcrumb">')
[void]$html.AppendLine('      <a href="./">&#12507;&#12540;&#12512;</a>')
[void]$html.AppendLine('      <span class="breadcrumb-sep" aria-hidden="true">&gt;</span>')
[void]$html.AppendLine('      <a href="./sleeves/">&#22259;&#37969;</a>')
[void]$html.AppendLine('      <span class="breadcrumb-sep" aria-hidden="true">&gt;</span>')
[void]$html.AppendLine('      <span class="breadcrumb-current" aria-current="page">&#20840;&#12473;&#12522;&#12540;&#12502;&#32034;&#24341;</span>')
[void]$html.AppendLine('    </nav>')
[void]$html.AppendLine('    <section class="index-hero" aria-labelledby="pageTitle">')
[void]$html.AppendLine('      <h1 id="pageTitle">&#20840;&#12473;&#12522;&#12540;&#12502;&#32034;&#24341;</h1>')
[void]$html.AppendLine(("      <p>{0} &#20214;&#12398;&#12473;&#12522;&#12540;&#12502;&#35443;&#32048;&#12506;&#12540;&#12472;&#12434;&#19968;&#35239;&#12391;&#12365;&#12414;&#12377;&#12290;&#26368;&#32066;&#26356;&#26032;: {1}</p>" -f $items.Count, $today))
[void]$html.AppendLine('    </section>')
[void]$html.AppendLine('    <ul class="sleeve-index-list">')

foreach ($sleeve in $items) {
  $id = [string]$sleeve.id
  $routeId = Get-SleeveRouteId $id
  $href = "./sleeve/" + [System.Uri]::EscapeDataString($routeId) + "/"
  $name = ConvertTo-HtmlText $sleeve.name
  $releaseYear = ConvertTo-HtmlText $sleeve.releaseYear
  $series = ConvertTo-HtmlText $sleeve.series
  $priceText = Get-LatestPriceText $sleeve
  $meta = @()
  if ($releaseYear) { $meta += $releaseYear }
  if ($series) { $meta += $series }
  $meta += $priceText
  [void]$html.AppendLine('      <li class="sleeve-index-item">')
  [void]$html.AppendLine(("        <a href=""{0}"">" -f $href))
  [void]$html.AppendLine(("          <span class=""sleeve-index-name"">{0}</span>" -f $name))
  [void]$html.AppendLine(("          <span class=""sleeve-index-meta"">{0}</span>" -f (($meta | Where-Object { $_ }) -join " / ")))
  [void]$html.AppendLine('        </a>')
  [void]$html.AppendLine('      </li>')
}

[void]$html.AppendLine('    </ul>')
[void]$html.AppendLine('        </div>')
[void]$html.AppendLine('        <div id="site-footer"></div>')
[void]$html.AppendLine('      </div>')
[void]$html.AppendLine('    </main>')
[void]$html.AppendLine('  </div>')
[void]$html.AppendLine('  <script src="./assets/common.js?v=20260831a"></script>')
[void]$html.AppendLine('  <script>')
[void]$html.AppendLine('    document.addEventListener("DOMContentLoaded", async () => {')
[void]$html.AppendLine('      if (window.common && typeof window.common.setupDashboardChrome === "function") {')
[void]$html.AppendLine('        await window.common.setupDashboardChrome({ sidebarActive: "zukan" });')
[void]$html.AppendLine('      }')
[void]$html.AppendLine('    });')
[void]$html.AppendLine('  </script>')
[void]$html.AppendLine('</body>')
[void]$html.AppendLine('</html>')

$resolvedOutputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
[System.IO.File]::WriteAllText(
  $resolvedOutputPath,
  $html.ToString().TrimEnd("`r", "`n") + "`r`n",
  [System.Text.UTF8Encoding]::new($false)
)
Write-Output "Generated $OutputPath"

