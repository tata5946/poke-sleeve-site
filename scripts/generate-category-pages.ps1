param(
  [string]$DataPath = "data.json",
  [string]$SlugMapPath = "data/category-slugs.json",
  [string]$OutputRoot = "sleeves",
  [string]$ManifestPath = "data/category-page-manifest.json",
  [string]$BrowserMapPath = "assets/category-page-map.js",
  [string]$SiteOrigin = "https://pokesuri-navi.com"
)
$ErrorActionPreference = "Stop"

function Html([object]$Value) { [System.Net.WebUtility]::HtmlEncode([string]$Value) }
function RouteId([object]$Value) {
  $id = ([string]$Value).Trim()
  if ($id -match '^\d{6,7}$') { return "4521329$id" }
  return $id
}
function NumberOrNull([object]$Value) {
  if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) { return $null }
  $number = 0.0
  if ([double]::TryParse([string]$Value, [ref]$number)) { return $number }
  return $null
}
function LatestPrice([object]$Sleeve) {
  foreach ($spec in @(@('weeklyPrices','week'), @('monthlyPrices','month'), @('yearlyPrices','year'))) {
    $rows = @($Sleeve.($spec[0])) | Where-Object { $null -ne (NumberOrNull $_.price) -and (NumberOrNull $_.price) -gt 0 } | Sort-Object { [string]$_.($spec[1]) }
    if ($rows.Count) { return NumberOrNull $rows[-1].price }
  }
  if ($Sleeve.pricesByYear) {
    $rows = @($Sleeve.pricesByYear.PSObject.Properties) | Where-Object { $null -ne (NumberOrNull $_.Value) -and (NumberOrNull $_.Value) -gt 0 } | Sort-Object { [int]$_.Name }
    if ($rows.Count) { return NumberOrNull $rows[-1].Value }
  }
  return $null
}
function Yen([object]$Value, [string]$Fallback = "未取得") {
  $number = NumberOrNull $Value
  if ($null -eq $number) { return $Fallback }
  return ('{0:N0}円' -f [math]::Round($number))
}
function StableSlug([string]$Group, [string]$Label) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes("$Group`:$Label")
    $hash = [System.BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant().Substring(0, 12)
    return "$Group-$hash"
  } finally { $sha.Dispose() }
}
function WriteText([string]$Path, [string]$Text) {
  $full = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
  $dir = Split-Path $full -Parent
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  [System.IO.File]::WriteAllText($full, $Text.TrimEnd("`r","`n") + "`r`n", [System.Text.UTF8Encoding]::new($false))
}
function CategoryEntries([array]$Sleeves, [string]$Group, [string]$Property) {
  $buckets = @{}
  foreach ($sleeve in $Sleeves) {
    foreach ($raw in @($sleeve.$Property)) {
      $label = ([string]$raw).Trim()
      if (-not $label) { continue }
      if (-not $buckets.ContainsKey($label)) { $buckets[$label] = New-Object 'System.Collections.Generic.List[object]' }
      $buckets[$label].Add($sleeve)
    }
  }
  return @($buckets.GetEnumerator() | Sort-Object Name | ForEach-Object {
    $items = @($_.Value | ForEach-Object { $_ })
    [pscustomobject]@{ group=$Group; label=$_.Name; items=$items }
  })
}
function BreadcrumbJson([string]$Group, [string]$GroupLabel, [string]$Label, [string]$Url) {
  $data = [ordered]@{
    '@context'='https://schema.org'; '@type'='BreadcrumbList'; itemListElement=@(
      [ordered]@{'@type'='ListItem';position=1;name='トップ';item="$SiteOrigin/"},
      [ordered]@{'@type'='ListItem';position=2;name='デッキシールド図鑑';item="$SiteOrigin/sleeves/"},
      [ordered]@{'@type'='ListItem';position=3;name="${GroupLabel}から探す";item="$SiteOrigin/sleeves/?group=$Group"},
      [ordered]@{'@type'='ListItem';position=4;name=$Label;item=$Url}
    )
  }
  return ($data | ConvertTo-Json -Depth 10 -Compress).Replace('</script','<\/script')
}
function CardHtml([object]$Sleeve, [int]$Index) {
  $id = RouteId $Sleeve.id
  $name = Html $Sleeve.name
  $image = Html $Sleeve.imageUrl
  $date = ([string]$Sleeve.releaseDate).Trim()
  if (-not $date) { $date = ([string]$Sleeve.releaseYear).Trim() }
  $latest = LatestPrice $Sleeve
  $first = NumberOrNull $Sleeve.firstPrice
  $dateKey = if ($date -match '^\d{4}') { $date } else { '0000-00-00' }
  $imageHtml = if ($image) { '<img src="' + $image + '" alt="' + $name + '" loading="lazy" referrerpolicy="no-referrer" />' } else { '' }
  $priceKey = if ($null -ne $latest) { [string]$latest } else { '' }
  $dateText = if ($date) { $date } else { '未取得' }
  return @"
      <li class="category-card" data-index="$Index" data-price="$(Html $priceKey)" data-date="$(Html $dateKey)">
        <a href="/sleeve/$(Html $id)/">
          <span class="category-card-image">$imageHtml</span>
          <span class="category-card-body">
            <span class="category-card-name">$name</span>
            <span class="category-card-meta"><span>発売日 $(Html $dateText)</span><span>発売時価格 $(Html (Yen $first))</span><span>現在相場 $(Html (Yen $latest '価格データなし'))</span></span>
          </span>
        </a>
      </li>
"@
}
function PageHtml([object]$Entry, [string]$Slug) {
  $groupLabel = if ($Entry.group -eq 'pokemon') { 'ポケモン' } else { 'トレーナー' }
  $label = [string]$Entry.label
  $count = @($Entry.items).Count
  $url = "$($SiteOrigin.TrimEnd('/'))/sleeves/$($Entry.group)/$Slug/"
  $title = "${label}のデッキシールド一覧｜歴代${count}種類・相場価格 | ポケスリ相場ナビ"
  $description = "${label}が描かれた歴代デッキシールド${count}種類を一覧で掲載。現在相場や発売時価格、価格推移を確認できます。"
  $cards = New-Object System.Text.StringBuilder
  $i = 0
  foreach ($sleeve in @($Entry.items | Sort-Object @{Expression={[string]$_.releaseDate};Descending=$true}, @{Expression={[string]$_.name};Ascending=$true})) {
    [void]$cards.Append((CardHtml $sleeve $i)); $i++
  }
  $json = BreadcrumbJson $Entry.group $groupLabel $label $url
  return @"
<!DOCTYPE html>
<html lang="ja">
<head>
  <base href="../../../" />
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>$(Html $title)</title>
  <meta name="description" content="$(Html $description)" />
  <meta property="og:title" content="$(Html $title)" />
  <meta property="og:description" content="$(Html $description)" />
  <meta property="og:url" content="$(Html $url)" />
  <link rel="canonical" href="$(Html $url)" />
  <link rel="stylesheet" href="./assets/site.css?v=20260917m" />
  <link rel="stylesheet" href="./assets/category-pages.css?v=20260917a" />
  <script type="application/ld+json">$json</script>
</head>
<body class="page-market-list" data-hide-global-header="1">
  <div id="site-header"></div>
  <div class="dashboard-shell">
    <aside class="dashboard-sidebar" aria-label="サイドバー"><div id="dashboardSidebarSlot" data-dashboard-sidebar-active="zukan"></div></aside>
    <main class="dashboard-main">
      <header class="dashboard-topbar"><div id="dashboardTopbarSlot"></div></header>
      <div class="dashboard-content">
        <div class="category-page-wrap">
          <nav class="breadcrumb" aria-label="パンくず"><a href="/">トップ</a><span class="breadcrumb-sep">&gt;</span><a href="/sleeves/">デッキシールド図鑑</a><span class="breadcrumb-sep">&gt;</span><a href="/sleeves/?group=$($Entry.group)">${groupLabel}から探す</a><span class="breadcrumb-sep">&gt;</span><span class="breadcrumb-current" aria-current="page">$(Html $label)</span></nav>
          <section class="category-page-hero"><h1>$(Html $label)のデッキシールド一覧</h1><p>$(Html $description)</p></section>
          <div class="category-sort"><label>並び替え<select id="categorySort"><option value="default">おすすめ・既定順</option><option value="priceDesc">価格が高い順</option><option value="priceAsc">価格が安い順</option><option value="newest">新しい順</option><option value="oldest">古い順</option></select></label></div>
          <ul id="categoryCards" class="category-card-grid">$cards</ul>
        </div>
        <div id="site-footer"></div>
      </div>
    </main>
  </div>
  <script src="./assets/common.js?v=20260917a"></script>
  <script>
    document.addEventListener('DOMContentLoaded', async () => {
      if (window.common?.setupDashboardChrome) await window.common.setupDashboardChrome({ sidebarActive: 'zukan' });
      const list = document.getElementById('categoryCards');
      document.getElementById('categorySort')?.addEventListener('change', (event) => {
        const mode = event.target.value;
        const cards = Array.from(list.children);
        cards.sort((a,b) => {
          if (mode === 'priceDesc' || mode === 'priceAsc') {
            const ap = a.dataset.price === '' ? -1 : Number(a.dataset.price);
            const bp = b.dataset.price === '' ? -1 : Number(b.dataset.price);
            return mode === 'priceDesc' ? bp-ap : ap-bp;
          }
          if (mode === 'newest' || mode === 'oldest') {
            const d=String(b.dataset.date).localeCompare(String(a.dataset.date));
            return mode === 'newest' ? d : -d;
          }
          return Number(a.dataset.index)-Number(b.dataset.index);
        });
        cards.forEach(card => list.appendChild(card));
      });
    });
  </script>
</body>
</html>
"@
}

if (-not (Test-Path -LiteralPath $DataPath)) { throw "Data not found: $DataPath" }
if (-not (Test-Path -LiteralPath $SlugMapPath)) { throw "Slug map not found: $SlugMapPath" }
$data = Get-Content -LiteralPath $DataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$slugData = Get-Content -LiteralPath $SlugMapPath -Raw -Encoding UTF8 | ConvertFrom-Json
$previous = if (Test-Path -LiteralPath $ManifestPath) { Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json } else { @() }
$entries = @((CategoryEntries @($data.sleeves) 'pokemon' 'pokemonCategories') + (CategoryEntries @($data.sleeves) 'trainer' 'trainerCategories'))
$used = @{}
$manifest = New-Object 'System.Collections.Generic.List[object]'
foreach ($entry in $entries) {
  $map = $slugData.($entry.group)
  $property = $map.PSObject.Properties[[string]$entry.label]
  $slug = if ($property) { [string]$property.Value } else { '' }
  if (-not $slug) {
    $slug = StableSlug $entry.group $entry.label
    $map | Add-Member -NotePropertyName $entry.label -NotePropertyValue $slug
  }
  $key = "$($entry.group)/$slug"
  if ($used.ContainsKey($key)) { throw "Duplicate category slug: $key" }
  $used[$key] = $true
  $path = Join-Path $OutputRoot (Join-Path $entry.group (Join-Path $slug 'index.html'))
  WriteText $path (PageHtml $entry $slug)
  $manifest.Add([pscustomobject]@{group=$entry.group;label=$entry.label;slug=$slug;count=@($entry.items).Count;path="/sleeves/$($entry.group)/$slug/"})
}
foreach ($old in $previous) {
  $key = "$($old.group)/$($old.slug)"
  if ($used.ContainsKey($key)) { continue }
  $fallback = "/sleeves/?group=$($old.group)&tag=$([System.Uri]::EscapeDataString([string]$old.label))"
  $path = Join-Path $OutputRoot (Join-Path $old.group (Join-Path $old.slug 'index.html'))
  $retired = '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="robots" content="noindex, follow"><link rel="canonical" href="' + $SiteOrigin + $fallback + '"><meta http-equiv="refresh" content="0;url=' + $fallback + '"><title>カテゴリページを移動しました</title></head><body><p><a href="' + $fallback + '">絞り込み結果へ移動</a></p></body></html>'
  WriteText $path $retired
}
WriteText $SlugMapPath ($slugData | ConvertTo-Json -Depth 10)
WriteText $ManifestPath ($manifest | ConvertTo-Json -Depth 6)
$browserMap = @{}
foreach ($item in $manifest) {
  if (-not $browserMap.ContainsKey($item.group)) { $browserMap[$item.group]=@{} }
  $browserMap[$item.group][$item.label]=$item.path
}
WriteText $BrowserMapPath ('window.__CATEGORY_PAGE_MAP__ = ' + ($browserMap | ConvertTo-Json -Depth 6 -Compress) + ';')
$pokemonCount = @($manifest | Where-Object group -eq 'pokemon').Count
$trainerCount = @($manifest | Where-Object group -eq 'trainer').Count
Write-Output "Generated $($manifest.Count) category pages (pokemon=$pokemonCount, trainer=$trainerCount)."
