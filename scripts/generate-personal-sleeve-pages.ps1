param(
  [string]$DataPath = "data.json",
  [string]$TemplatePath = "detail.html",
  [string]$OutputRoot = "sleeve",
  [switch]$All
)

$ErrorActionPreference = "Stop"

$itemsJson = @'
[
  { "id": "290478", "name": "\u30de\u30c3\u30c9\u30d1\u30fc\u30c6\u30a3" },
  { "id": "431079", "name": "\u3069\u3093\u3069\u3093 \u3069\u3093\u304b\u3093 \u3084\u3041\u3093\uff1f" },
  { "id": "330549", "name": "pokemon \u3074\u304b\u3074\u304b\u30d5\u30ec\u30f3\u30ba" },
  { "id": "427188", "name": "\u30dd\u30b1\u7d0b \u30ad\u30bf\u30ab\u30df\u306e\u91cc" },
  { "id": "301495", "name": "TAIKI-BANSEI" },
  { "id": "283708", "name": "\u30dd\u30ea\u30b4\u30f3\u30e1\u30fc\u30ab\u30fc" },
  { "id": "306254", "name": "\u30d0\u30f3\u30ae\u30e9\u30b9" },
  { "id": "2005001", "name": "\u30aa\u30d5\u30a3\u30b7\u30e3\u30eb\u30d7\u30ec\u30a4\u30e4\u30fc\u30ba\u3000\u30c7\u30c3\u30ad\u30b7\u30fc\u30eb\u30c9\u3008\u30ec\u30c3\u30c9\u3009" },
  { "id": "2005002", "name": "\u30aa\u30d5\u30a3\u30b7\u30e3\u30eb\u30d7\u30ec\u30a4\u30e4\u30fc\u30ba\u3000\u30c7\u30c3\u30ad\u30b7\u30fc\u30eb\u30c9\u3008\u30db\u30ef\u30a4\u30c8\u3009" },
  { "id": "319100", "name": "Pokemon Yurutto\u30af\u30c3\u30b7\u30e7\u30f3\u3067\u307e\u3063\u305f\u308a" },
  { "id": "306407", "name": "\u30d0\u30b7\u30e3\u30fc\u30e2" },
  { "id": "373171", "name": "\u30ed\u30b3\u30f3(\u30a2\u30ed\u30fc\u30e9\u306e\u3059\u304c\u305f)" },
  { "id": "125527", "name": "\u30d0\u30c1\u30e5\u30eb" },
  { "id": "427249", "name": "\u306a\u304b\u3088\u3057\u30d5\u30ec\u30f3\u30ba" },
  { "id": "236483", "name": "SECRET TEAM F" },
  { "id": "374581", "name": "\u30e9\u30c6\u30a3\u30a2\u30b9\u30fb\u30e9\u30c6\u30a3\u30aa\u30b9 \u591c\u666f" },
  { "id": "431994", "name": "\u30e1\u30ac\u30eb\u30ab\u30ea\u30aa" },
  { "id": "432151", "name": "with elegance \u30e1\u30ac\u30a2\u30d6\u30bd\u30eb" },
  { "id": "432144", "name": "with elegance \u30e1\u30ac\u30af\u30c1\u30fc\u30c8" },
  { "id": "432120", "name": "PJCS2025" },
  { "id": "432052", "name": "\u30c8\u30a6\u30b3" },
  { "id": "432090", "name": "\u30c4\u30bf\u30fc\u30b8\u30e3\uff06\u30dd\u30ab\u30d6\uff06\u30df\u30b8\u30e5\u30de\u30eb" },
  { "id": "432113", "name": "PSYCHO CYBER \u30e6\u30cb\u30e9\u30f3 \u30c0\u30d6\u30e9\u30f3 \u30e9\u30f3\u30af\u30eb\u30b9" },
  { "id": "431383", "name": "\u30ec\u30b7\u30e9\u30e0" },
  { "id": "431376", "name": "\u30bc\u30af\u30ed\u30e0" },
  { "id": "431789", "name": "\u3064\u306a\u304c\u308b\u305b\u304b\u3044 -\u3072\u307f\u3064\u306e\u304b\u3044\u3060\u3093-" },
  { "id": "427256", "name": "\u30ed\u30b1\u30c3\u30c8\u56e3\u306e\u6804\u5149" },
  { "id": "431802", "name": "\u30ac\u30fc\u30c7\u30a3\uff06\u30d0\u30f3\u30ae\u30e9\u30b9\uff06\u30c7\u30f3\u30ea\u30e5\u30a6" },
  { "id": "431819", "name": "\u30df\u30df\u30c3\u30ad\u30e5\uff06\u30bd\u30fc\u30ca\u30f3\u30b9" },
  { "id": "431796", "name": "\u30d5\u30a1\u30a4\u30e4\u30fc\uff06\u30b5\u30f3\u30c0\u30fc\uff06\u30d5\u30ea\u30fc\u30b6\u30fc" },
  { "id": "431772", "name": "Night Arcade" },
  { "id": "431826", "name": "\u9032\u5316\u306e\u8ecc\u8de1 \u30af\u30ed\u30d0\u30c3\u30c8" },
  { "id": "431208", "name": "\u30da\u30d1\u30fc\uff06\u30de\u30d5\u30a3\u30c6\u30a3\u30d5" },
  { "id": "319094", "name": "Pok\u00e9mon Yurutto \u5bdd\u305d\u3079\u308a" },
  { "id": "292090", "name": "\u58a8\u7d75\u5217\u4f1d \u30d4\u30ab\u30c1\u30e5\u30a6" },
  { "id": "298726", "name": "24\u3058\u304b\u3093\u30dd\u30b1\u30e2\u30f3CHU \u30d4\u30ab\u30c1\u30e5\u30a6" },
  { "id": "298740", "name": "24\u3058\u304b\u3093\u30dd\u30b1\u30e2\u30f3CHU \u30e8\u30fc\u30ae\u30e9\u30b9" },
  { "id": "226859", "name": "\u30eb\u30b6\u30df\u30fc\u30cd\u30d5\u30a1\u30df\u30ea\u30fc" },
  { "id": "265032", "name": "\u30d4\u30ab\u30c1\u30e5\u30a6\u3000\u30b8\u30e5\u30a8\u30eb" }
]
'@

$labelsJson = @'
{
  "siteName": "\u30dd\u30b1\u30b9\u30ea\u76f8\u5834\u30ca\u30d3",
  "personal": "\u500b\u4eba",
  "sealed": "\u672a\u958b\u5c01",
  "deckShield": "\u30c7\u30c3\u30ad\u30b7\u30fc\u30eb\u30c9",
  "series": "\u30b7\u30ea\u30fc\u30ba",
  "condition": "\u72b6\u614b",
  "type": "\u7a2e\u5225",
  "priceMissing": "\u4fa1\u683c\u30c7\u30fc\u30bf\u672a\u767b\u9332",
  "descriptionSuffix": "\u306e\u4fa1\u683c\u63a8\u79fb\u30da\u30fc\u30b8\u3067\u3059\u3002",
  "yen": "\u5186",
  "latestObserved": "\u6700\u7d42\u89b3\u6e2c\u65e5",
  "tradeCount": "\u53d6\u5f15\u4ef6\u6570",
  "countSuffix": "\u4ef6"
}
'@

function Get-SleeveRouteId([string]$Id) {
  $sleeveId = ([string]$Id).Trim()
  if ($sleeveId -match '^\d{6,7}$') { return "4521329$sleeveId" }
  return $sleeveId
}

function ConvertTo-HtmlText([object]$Value) {
  return [System.Net.WebUtility]::HtmlEncode([string]$Value)
}

function ConvertTo-JsJson([object]$Value) {
  return ConvertTo-Json $Value -Compress -Depth 100
}

function Get-TextValue([object]$Value) {
  if ($null -eq $Value) { return "" }
  return ([string]$Value).Trim()
}

function Get-LatestTrade([object]$Sleeve) {
  $rows = @($Sleeve.weeklyPrices) | Where-Object {
    $null -ne $_.price -and [double]$_.price -gt 0
  } | Sort-Object { [datetime]$_.week }
  if ($rows.Count -gt 0) { return $rows[-1] }
  return $null
}

function Replace-Required([string]$Content, [string]$Pattern, [string]$Replacement) {
  $next = [regex]::Replace($Content, $Pattern, $Replacement, 1)
  if ($next -eq $Content) { throw "Template pattern not found: $Pattern" }
  return $next
}

if (-not (Test-Path -LiteralPath $TemplatePath)) {
  throw "Template not found: $TemplatePath"
}
if (-not (Test-Path -LiteralPath $DataPath)) {
  throw "Data not found: $DataPath"
}
if (-not (Test-Path -LiteralPath $OutputRoot)) {
  New-Item -ItemType Directory -Path $OutputRoot | Out-Null
}

$items = $itemsJson | ConvertFrom-Json
$labels = $labelsJson | ConvertFrom-Json
$data = Get-Content -LiteralPath $DataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$sleevesById = @{}
foreach ($s in @($data.sleeves)) {
  $sid = Get-TextValue $s.id
  if ($sid) { $sleevesById[$sid] = $s }
}
if ($All) {
  $items = @($data.sleeves | Where-Object { (Get-TextValue $_.id) -and (Get-TextValue $_.name) } | ForEach-Object {
    [pscustomobject]@{
      id = Get-TextValue $_.id
      name = Get-TextValue $_.name
    }
  })
}
$template = Get-Content -LiteralPath $TemplatePath -Raw -Encoding UTF8
$fallbackImage = "https://pokesuri-navi.com/assets/favicon.svg"

foreach ($item in @($items)) {
  $id = [string]$item.id
  $routeId = Get-SleeveRouteId $id
  $encodedRouteId = [System.Uri]::EscapeDataString($routeId)
  $canonical = "https://pokesuri-navi.com/sleeve/$encodedRouteId/"

  if ($sleevesById.ContainsKey($id)) {
    $sleeve = $sleevesById[$id]
  } else {
    $sleeve = [ordered]@{
      id = $id
      name = [string]$item.name
      imageUrl = $fallbackImage
      releaseDate = ""
      releaseYear = ""
      series = $labels.personal
      condition = $labels.sealed
      type = $labels.deckShield
      feature = $labels.deckShield
      acquisitionType = ""
      illustrator = ""
      note = ""
      category1 = ""
      category2 = ""
      category3 = ""
      category4 = ""
      category5 = ""
      category6 = ""
      category7 = ""
      category8 = ""
      category9 = ""
      pokemonCategories = @()
      trainerCategories = @()
      categoryTags = @()
      categories = @($labels.personal)
      weeklyPrices = @()
      monthlyPrices = @()
      yearlyPrices = @()
      pricesByYear = @{}
    }
  }

  $name = Get-TextValue $sleeve.name
  if (-not $name) { $name = [string]$item.name }
  $imageUrl = Get-TextValue $sleeve.imageUrl
  if (-not $imageUrl) { $imageUrl = $fallbackImage }
  if (-not (Get-TextValue $sleeve.imageUrl)) {
    $sleeve | Add-Member -NotePropertyName imageUrl -NotePropertyValue $imageUrl -Force
  }
  $series = Get-TextValue $sleeve.series
  $condition = Get-TextValue $sleeve.condition
  $type = Get-TextValue $sleeve.type
  $releaseYear = Get-TextValue $sleeve.releaseYear

  $title = "$name | $($labels.siteName)"
  $descParts = @($name, $series, $type, $releaseYear) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }
  $description = (($descParts | Select-Object -Unique) -join " / ") + $labels.descriptionSuffix
  $inlineScript = '  <script>window.__SLEEVE_PAGE_ID = ' + (ConvertTo-JsJson $id) + ';window.__SLEEVE_PAGE_DATA = ' + (ConvertTo-JsJson $sleeve) + ';</script>'
  $badgeValues = @($series, $condition, $type) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | Select-Object -Unique
  if ($badgeValues.Count -eq 0) { $badgeValues = @($labels.personal, $labels.deckShield) }
  $badges = '<div id="badges" class="badges">' + (($badgeValues | ForEach-Object { '<span class="badge">' + (ConvertTo-HtmlText $_) + '</span>' }) -join '') + '</div>'
  $infoRows = @()
  foreach ($pair in @(
    @($labels.series, $series),
    @($labels.condition, $condition),
    @($labels.type, $type),
    @("releaseYear", $releaseYear),
    @("releaseDate", (Get-TextValue $sleeve.releaseDate)),
    @("acquisitionType", (Get-TextValue $sleeve.acquisitionType)),
    @("illustrator", (Get-TextValue $sleeve.illustrator))
  )) {
    if (-not [string]::IsNullOrWhiteSpace([string]$pair[1])) {
      $infoRows += '<div class="detail-info-row"><span>' + (ConvertTo-HtmlText $pair[0]) + '</span><strong>' + (ConvertTo-HtmlText $pair[1]) + '</strong></div>'
    }
  }
  $info = if ($infoRows.Count) { '<div id="detailInfo" class="detail-info-card">' + ($infoRows -join '') + '</div>' } else { '<div id="detailInfo" class="detail-info-card" hidden></div>' }
  $tagValues = @($sleeve.categories) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | Select-Object -Unique
  $tags = if ($tagValues.Count) {
    '<div id="detailTags" class="detail-tag-list">' + (($tagValues | ForEach-Object { '<a class="detail-tag" href="./sleeves/?tag=' + [System.Uri]::EscapeDataString([string]$_) + '">' + (ConvertTo-HtmlText $_) + '</a>' }) -join '') + '</div>'
  } else {
    '<div id="detailTags" class="detail-tag-list" hidden></div>'
  }
  $latestTrade = Get-LatestTrade $sleeve
  $latestPriceText = if ($latestTrade) { ([double]$latestTrade.price).ToString("N0") + $labels.yen } else { "-" }
  $weeklyCountText = if ($latestTrade) {
    $week = Get-TextValue $latestTrade.week
    $count = Get-TextValue $latestTrade.count
    if ($count) { "$($labels.latestObserved): $week / $($labels.tradeCount): $count $($labels.countSuffix)" } else { "$($labels.latestObserved): $week" }
  } else {
    $labels.priceMissing
  }

  $content = $template
  $content = Replace-Required $content '<head>' "<head>`r`n  <base href=""../../"" />"
  $content = Replace-Required $content '<title>.*?</title>' ('<title>' + (ConvertTo-HtmlText $title) + '</title>')
  $content = Replace-Required $content '(?m)^\s*<meta name="description".*$' ('  <meta name="description" content="' + (ConvertTo-HtmlText $description) + '" />')
  $content = Replace-Required $content '(?m)^\s*<meta property="og:title".*$' ('  <meta property="og:title" content="' + (ConvertTo-HtmlText $title) + '" />')
  $content = Replace-Required $content '(?m)^\s*<meta property="og:description".*$' ('  <meta property="og:description" content="' + (ConvertTo-HtmlText $description) + '" />')
  $content = Replace-Required $content '(?m)^\s*<meta property="og:image".*$' ('  <meta property="og:image" content="' + (ConvertTo-HtmlText $imageUrl) + '" />')
  $content = Replace-Required $content '(?m)^\s*<meta property="og:url".*$' ('  <meta property="og:url" content="' + $canonical + '" />' + "`r`n  " + '<link rel="canonical" href="' + $canonical + '" />')
  $content = Replace-Required $content '<script src="\./assets/common\.js(?:\?[^"]*)?"></script>' ($inlineScript + "`r`n`r`n" + '$0')
  $content = Replace-Required $content '<span id="breadcrumbCurrent" class="breadcrumb-current" aria-current="page">.*?</span>' ('<span id="breadcrumbCurrent" class="breadcrumb-current" aria-current="page">' + (ConvertTo-HtmlText $name) + '</span>')
  $content = Replace-Required $content '<h2 id="name" class="name">.*?</h2>' ('<h2 id="name" class="name">' + (ConvertTo-HtmlText $name) + '</h2>')
  $content = $content.Replace('<div id="badges" class="badges"></div>', $badges)
  $content = $content.Replace('<div id="detailInfo" class="detail-info-card" hidden></div>', $info)
  $content = $content.Replace('<div id="detailTags" class="detail-tag-list" hidden></div>', $tags)
  $content = $content.Replace('<div id="latestWeekly" class="value">-</div>', '<div id="latestWeekly" class="value">' + (ConvertTo-HtmlText $latestPriceText) + '</div>')
  $content = Replace-Required $content '<div id="weeklyCount" class="meta" style="margin-top:6px;">.*?</div>' ('<div id="weeklyCount" class="meta" style="margin-top:6px;">' + (ConvertTo-HtmlText $weeklyCountText) + '</div>')

  $targetDir = Join-Path $OutputRoot $routeId
  if (-not (Test-Path -LiteralPath $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
  }
  Set-Content -LiteralPath (Join-Path $targetDir "index.html") -Value $content -Encoding UTF8
  Write-Output "generated sleeve/$routeId/index.html"
}
