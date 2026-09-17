param(
  [string]$DataPath = "data.json",
  [string]$TemplatePath = "sleeves/index.html",
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
      [ordered]@{'@type'='ListItem';position=3;name="${GroupLabel}から探す";item="$SiteOrigin/sleeves/$Group/"},
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
  $groupLabel = switch ($Entry.group) {
    'pokemon' { 'ポケモン' }
    'trainer' { 'トレーナー' }
    default { 'シリーズ' }
  }
  $label = [string]$Entry.label
  $count = @($Entry.items).Count
  $url = "$($SiteOrigin.TrimEnd('/'))/sleeves/$($Entry.group)/$Slug/"
  $heading = if ($label.EndsWith('デッキシールド')) { "${label}一覧" } else { "${label}のデッキシールド一覧" }
  $title = "${heading}｜歴代${count}種類・相場価格 | ポケスリ相場ナビ"
  $description = if ($Entry.group -eq 'series') {
    "${label}に該当する歴代デッキシールドを一覧で掲載。現在、ポケスリ相場ナビでは${count}種類を掲載しています。現在相場や発売時価格、価格推移を確認できます。"
  } else {
    "${label}が描かれた歴代デッキシールドを一覧で掲載。現在、ポケスリ相場ナビでは${count}種類を掲載しています。現在相場や発売時価格、価格推移を確認できます。"
  }
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
          <nav class="breadcrumb" aria-label="パンくず"><a href="/">トップ</a><span class="breadcrumb-sep">&gt;</span><a href="/sleeves/">デッキシールド図鑑</a><span class="breadcrumb-sep">&gt;</span><a href="/sleeves/$($Entry.group)/">${groupLabel}から探す</a><span class="breadcrumb-sep">&gt;</span><span class="breadcrumb-current" aria-current="page">$(Html $label)</span></nav>
          <section class="category-page-hero"><h1>$(Html $heading)</h1><p>$(Html $description)</p></section>
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
      const chromeReady = window.common?.setupDashboardChrome
        ? window.common.setupDashboardChrome({ sidebarActive: 'zukan' })
        : Promise.resolve();
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

function ZukanCategoryPageHtml([object]$Entry, [string]$Slug, [string]$Template) {
  $groupLabel = switch ($Entry.group) { 'pokemon' { 'ポケモン' } 'trainer' { 'トレーナー' } default { 'シリーズ' } }
  $label = [string]$Entry.label
  $count = @($Entry.items).Count
  $url = "$($SiteOrigin.TrimEnd('/'))/sleeves/$($Entry.group)/$Slug/"
  $heading = if ($label.EndsWith('デッキシールド')) { "${label}一覧" } else { "${label}のデッキシールド一覧" }
  $title = "${heading}｜歴代${count}種類・相場価格 | ポケスリ相場ナビ"
  $description = if ($Entry.group -eq 'series') {
    "${label}に該当する歴代デッキシールドを一覧で掲載。現在、ポケスリ相場ナビでは${count}種類を掲載しています。現在相場や発売時価格、価格推移を確認できます。"
  } else {
    "${label}が描かれた歴代デッキシールドを一覧で掲載。現在、ポケスリ相場ナビでは${count}種類を掲載しています。現在相場や発売時価格、価格推移を確認できます。"
  }
  $breadcrumbJson = BreadcrumbJson $Entry.group $groupLabel $label $url
  $configJson = ([ordered]@{ group=[string]$Entry.group; tag=$label } | ConvertTo-Json -Compress).Replace('</script','<\/script')
  $staticLinks = New-Object System.Text.StringBuilder
  foreach ($sleeve in @($Entry.items)) {
    $routeId = RouteId $sleeve.id
    [void]$staticLinks.Append('<li><a href="/sleeve/' + (Html $routeId) + '/">' + (Html $sleeve.name) + '</a></li>')
  }
  $breadcrumbMarkup = '<nav class="breadcrumb" aria-label="パンくず"><a href="/">ホーム</a><span class="breadcrumb-sep" aria-hidden="true">&gt;</span><a href="/sleeves/">デッキシールド図鑑</a><span class="breadcrumb-sep" aria-hidden="true">&gt;</span><a href="/sleeves/' + $Entry.group + '/">' + (Html $groupLabel) + 'から探す</a><span class="breadcrumb-sep" aria-hidden="true">&gt;</span><span class="breadcrumb-current" aria-current="page">' + (Html $label) + '</span></nav>'
  $html = $Template
  $html = $html.Replace('<base href="../" />', '<base href="../../../" />')
  $html = [regex]::Replace($html, '<title>.*?</title>', '<title>' + (Html $title) + '</title>', 1)
  $html = [regex]::Replace($html, '<meta name="description" content="[^"]*"\s*/>', '<meta name="description" content="' + (Html $description) + '" />', 1)
  $html = [regex]::Replace($html, '<meta property="og:title" content="[^"]*"\s*/>', '<meta property="og:title" content="' + (Html $title) + '" />', 1)
  $html = [regex]::Replace($html, '<meta property="og:description" content="[^"]*"\s*/>', '<meta property="og:description" content="' + (Html $description) + '" />', 1)
  $html = [regex]::Replace($html, '<meta property="og:url" content="[^"]*"\s*/>', '<meta property="og:url" content="' + (Html $url) + '" />', 1)
  $html = [regex]::Replace($html, '<link rel="canonical" href="[^"]*"\s*/>', '<link rel="canonical" href="' + (Html $url) + '" />', 1)
  $html = [regex]::Replace($html, '<script id="sleevesCollectionStructuredData" type="application/ld\+json">.*?</script>', '<script id="sleevesCollectionStructuredData" type="application/ld+json">' + $breadcrumbJson + '</script>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $html = [regex]::Replace($html, '<nav class="breadcrumb" aria-label="パンくず">.*?</nav>', $breadcrumbMarkup, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $html = [regex]::Replace($html, '<h1 class="zukan-title">.*?</h1>', '<h1 class="zukan-title">' + (Html $heading) + '</h1>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $html = [regex]::Replace($html, '<p class="zukan-lead">.*?</p>', '<p class="zukan-lead">' + (Html $description) + '</p>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $noscript = '<noscript><div class="zukan-noscript"><p>掲載中のデッキシールド一覧</p><ul>' + $staticLinks.ToString() + '</ul></div></noscript>'
  $html = [regex]::Replace($html, '<noscript>.*?</noscript>', $noscript, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $configScript = '<script>window.__SLEEVE_CATEGORY_PAGE__ = ' + $configJson + ';</script>' + "`r`n  "
  $html = $html.Replace('<script src="./assets/category-page-map.js?v=20260917a"></script>', $configScript + '<script src="./assets/category-page-map.js?v=20260917a"></script>')
  return $html
}

function KanaBucket([string]$Label) {
  if (-not $Label) { return 'その他' }
  $first = $Label.Substring(0, 1)
  if ($first -match '[あいうえおアイウエオヴ]') { return 'あ' }
  if ($first -match '[かきくけこがぎぐげごカキクケコガギグゲゴ]') { return 'か' }
  if ($first -match '[さしすせそざじずぜぞサシスセソザジズゼゾ]') { return 'さ' }
  if ($first -match '[たちつてとだぢづでどタチツテトダヂヅデド]') { return 'た' }
  if ($first -match '[なにぬねのナニヌネノ]') { return 'な' }
  if ($first -match '[はひふへほばびぶべぼぱぴぷぺぽハヒフヘホバビブベボパピプペポ]') { return 'は' }
  if ($first -match '[まみむめもマミムメモ]') { return 'ま' }
  if ($first -match '[やゆよヤユヨ]') { return 'や' }
  if ($first -match '[らりるれろラリルレロ]') { return 'ら' }
  if ($first -match '[わをんワヲン]') { return 'わ' }
  return '英数・その他'
}

function IndexPageHtml([string]$Group, [array]$Items) {
  $groupLabel = switch ($Group) { 'pokemon' { 'ポケモン' } 'trainer' { 'トレーナー' } default { 'シリーズ' } }
  $heading = "${groupLabel}からデッキシールドを探す"
  $description = "ポケスリ相場ナビに掲載している${groupLabel}別のデッキシールドを一覧から探せます。各カテゴリーの現在相場や発売時価格を確認できます。"
  $url = "$($SiteOrigin.TrimEnd('/'))/sleeves/$Group/"
  $title = "$heading | ポケスリ相場ナビ"
  $jsonData = [ordered]@{
    '@context'='https://schema.org'; '@type'='BreadcrumbList'; itemListElement=@(
      [ordered]@{'@type'='ListItem';position=1;name='トップ';item="$SiteOrigin/"},
      [ordered]@{'@type'='ListItem';position=2;name='デッキシールド図鑑';item="$SiteOrigin/sleeves/"},
      [ordered]@{'@type'='ListItem';position=3;name=$heading;item=$url}
    )
  }
  $json = ($jsonData | ConvertTo-Json -Depth 10 -Compress).Replace('</script','<\/script')
  $sections = New-Object System.Text.StringBuilder
  $buckets = [ordered]@{}
  foreach ($item in @($Items | Sort-Object label)) {
    $bucket = KanaBucket ([string]$item.label)
    if (-not $buckets.Contains($bucket)) { $buckets[$bucket] = New-Object 'System.Collections.Generic.List[object]' }
    $buckets[$bucket].Add($item)
  }
  $order = @('あ','か','さ','た','な','は','ま','や','ら','わ','英数・その他')
  $nav = New-Object System.Text.StringBuilder
  foreach ($bucket in $order) {
    if (-not $buckets.Contains($bucket)) { continue }
    $id = if ($bucket -eq '英数・その他') { 'other' } else { "kana-$bucket" }
    [void]$nav.Append('<a href="/sleeves/' + $Group + '/#' + $id + '">' + (Html $bucket) + '</a>')
    $list = New-Object System.Text.StringBuilder
    foreach ($item in $buckets[$bucket]) {
      [void]$list.Append('<li class="category-index-item" data-category-name="' + (Html ([string]$item.label).ToLowerInvariant()) + '"><a href="' + (Html $item.path) + '"><span>' + (Html $item.label) + '</span><span class="category-index-count">' + (Html $item.count) + '件</span></a></li>')
    }
    [void]$sections.Append('<section id="' + $id + '" class="category-index-section"><h2>' + (Html $bucket) + '</h2><ul class="category-index-list">' + $list.ToString() + '</ul></section>')
  }
  return @"
<!DOCTYPE html>
<html lang="ja">
<head>
  <base href="../../" />
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>$(Html $title)</title>
  <meta name="description" content="$(Html $description)" />
  <link rel="canonical" href="$(Html $url)" />
  <link rel="stylesheet" href="./assets/site.css?v=20260917m" />
  <link rel="stylesheet" href="./assets/category-pages.css?v=20260917b" />
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
          <nav class="breadcrumb" aria-label="パンくず"><a href="/">トップ</a><span class="breadcrumb-sep">&gt;</span><a href="/sleeves/">デッキシールド図鑑</a><span class="breadcrumb-sep">&gt;</span><span class="breadcrumb-current" aria-current="page">$(Html $groupLabel)から探す</span></nav>
          <section class="category-page-hero"><h1>$(Html $heading)</h1><p>$(Html $description)</p></section>
          <div class="category-index-tools">
            <input id="categoryIndexSearch" class="category-index-search" type="search" placeholder="$(Html $groupLabel)名を検索" aria-label="$(Html $groupLabel)名を検索" />
            <nav class="category-index-kana" aria-label="五十音索引">$($nav.ToString())</nav>
          </div>
          <div id="categoryIndexSections">$($sections.ToString())</div>
          <p id="categoryIndexEmpty" class="category-index-empty" hidden>該当するカテゴリーがありません。</p>
        </div>
        <div id="site-footer"></div>
      </div>
    </main>
  </div>
  <script src="./assets/common.js?v=20260917c"></script>
  <script>
    document.addEventListener('DOMContentLoaded', async () => {
      if (window.common?.setupDashboardChrome) await window.common.setupDashboardChrome({ sidebarActive: 'zukan' });
      const input = document.getElementById('categoryIndexSearch');
      const items = Array.from(document.querySelectorAll('.category-index-item'));
      const sections = Array.from(document.querySelectorAll('.category-index-section'));
      const empty = document.getElementById('categoryIndexEmpty');
      input?.addEventListener('input', () => {
        const query = input.value.trim();
        const queryVariants = window.common?.buildSearchVariants
          ? window.common.buildSearchVariants(query)
          : [query.toLocaleLowerCase('ja')];
        let visible = 0;
        items.forEach((item) => {
          const nameVariants = window.common?.buildSearchVariants
            ? window.common.buildSearchVariants(item.dataset.categoryName)
            : [item.dataset.categoryName];
          item.hidden = query !== '' && !queryVariants.some((needle) => nameVariants.some((name) => name.includes(needle)));
          if (!item.hidden) visible += 1;
        });
        sections.forEach((section) => { section.hidden = !section.querySelector('.category-index-item:not([hidden])'); });
        empty.hidden = visible !== 0;
      });
      document.querySelectorAll('.category-index-kana a').forEach((link) => {
        link.addEventListener('click', (event) => {
          const targetId = decodeURIComponent(link.hash.slice(1));
          const target = document.getElementById(targetId);
          if (!target) return;
          event.preventDefault();
          if (target.hidden) {
            input.value = '';
            input.dispatchEvent(new Event('input'));
          }
          const scrollToTarget = () => {
            target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' });
            requestAnimationFrame(() => {
              const topbarBottom = Math.max(0, document.querySelector('.dashboard-topbar')?.getBoundingClientRect().bottom || 0);
              const delta = target.getBoundingClientRect().top - topbarBottom - 16;
              if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: 'auto' });
            });
          };
          scrollToTarget();
          chromeReady.then(scrollToTarget, scrollToTarget);
          history.replaceState(null, '', `#${encodeURIComponent(targetId)}`);
        });
      });
      await chromeReady.catch((error) => console.error('Dashboard chrome setup failed:', error));
    });
  </script>
</body>
</html>
"@
}

if (-not (Test-Path -LiteralPath $DataPath)) { throw "Data not found: $DataPath" }
if (-not (Test-Path -LiteralPath $SlugMapPath)) { throw "Slug map not found: $SlugMapPath" }
if (-not (Test-Path -LiteralPath $TemplatePath)) { throw "Template not found: $TemplatePath" }
$data = Get-Content -LiteralPath $DataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$slugData = Get-Content -LiteralPath $SlugMapPath -Raw -Encoding UTF8 | ConvertFrom-Json
$zukanTemplate = Get-Content -LiteralPath $TemplatePath -Raw -Encoding UTF8
$previous = if (Test-Path -LiteralPath $ManifestPath) { Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json } else { @() }
$entries = @(
  (CategoryEntries @($data.sleeves) 'pokemon' 'pokemonCategories') +
  (CategoryEntries @($data.sleeves) 'trainer' 'trainerCategories') +
  (CategoryEntries @($data.sleeves) 'series' 'categoryTags')
)
$used = @{}
$manifest = New-Object 'System.Collections.Generic.List[object]'
foreach ($entry in $entries) {
  $map = $slugData.($entry.group)
  if (-not $map) {
    $slugData | Add-Member -NotePropertyName $entry.group -NotePropertyValue ([pscustomobject]@{})
    $map = $slugData.($entry.group)
  }
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
  WriteText $path (ZukanCategoryPageHtml $entry $slug $zukanTemplate)
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
foreach ($group in @('pokemon','trainer','series')) {
  $groupItems = @($manifest | Where-Object group -eq $group)
  WriteText (Join-Path $OutputRoot (Join-Path $group 'index.html')) (IndexPageHtml $group $groupItems)
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
$seriesCount = @($manifest | Where-Object group -eq 'series').Count
Write-Output "Generated $($manifest.Count) category pages (pokemon=$pokemonCount, trainer=$trainerCount, series=$seriesCount)."
