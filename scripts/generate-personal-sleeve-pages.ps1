param(
  [string]$TemplatePath = "detail.html",
  [string]$OutputRoot = "sleeve"
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
  { "id": "306254", "name": "\u30d0\u30f3\u30ae\u30e9\u30b9" }
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
  "descriptionSuffix": "\u306e\u4fa1\u683c\u63a8\u79fb\u30da\u30fc\u30b8\u3067\u3059\u3002"
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

function Replace-Required([string]$Content, [string]$Pattern, [string]$Replacement) {
  $next = [regex]::Replace($Content, $Pattern, $Replacement, 1)
  if ($next -eq $Content) { throw "Template pattern not found: $Pattern" }
  return $next
}

if (-not (Test-Path -LiteralPath $TemplatePath)) {
  throw "Template not found: $TemplatePath"
}
if (-not (Test-Path -LiteralPath $OutputRoot)) {
  New-Item -ItemType Directory -Path $OutputRoot | Out-Null
}

$items = $itemsJson | ConvertFrom-Json
$labels = $labelsJson | ConvertFrom-Json
$template = Get-Content -LiteralPath $TemplatePath -Raw -Encoding UTF8
$fallbackImage = "https://pokesuri-navi.com/assets/favicon.svg"

foreach ($item in @($items)) {
  $id = [string]$item.id
  $name = [string]$item.name
  $routeId = Get-SleeveRouteId $id
  $encodedRouteId = [System.Uri]::EscapeDataString($routeId)
  $canonical = "https://pokesuri-navi.com/sleeve/$encodedRouteId/"

  $sleeve = [ordered]@{
    id = $id
    name = $name
    imageUrl = "https://pokesuri-navi.com/assets/favicon.svg"
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

  $title = "$name | $($labels.siteName)"
  $description = "$name / $($labels.personal) / $($labels.deckShield)$($labels.descriptionSuffix)"
  $inlineScript = '  <script>window.__SLEEVE_PAGE_ID = ' + (ConvertTo-JsJson $id) + ';window.__SLEEVE_PAGE_DATA = ' + (ConvertTo-JsJson $sleeve) + ';</script>'
  $badges = '<div id="badges" class="badges"><span class="badge">' + (ConvertTo-HtmlText $labels.personal) + '</span><span class="badge">' + (ConvertTo-HtmlText $labels.sealed) + '</span><span class="badge">' + (ConvertTo-HtmlText $labels.deckShield) + '</span></div>'
  $info = '<div id="detailInfo" class="detail-info-card">' +
    '<div class="detail-info-row"><span>' + (ConvertTo-HtmlText $labels.series) + '</span><strong>' + (ConvertTo-HtmlText $labels.personal) + '</strong></div>' +
    '<div class="detail-info-row"><span>' + (ConvertTo-HtmlText $labels.condition) + '</span><strong>' + (ConvertTo-HtmlText $labels.sealed) + '</strong></div>' +
    '<div class="detail-info-row"><span>' + (ConvertTo-HtmlText $labels.type) + '</span><strong>' + (ConvertTo-HtmlText $labels.deckShield) + '</strong></div>' +
    '</div>'
  $tags = '<div id="detailTags" class="detail-tag-list"><a class="detail-tag" href="./sleeves/?group=type&amp;tag=%E5%80%8B%E4%BA%BA">' + (ConvertTo-HtmlText $labels.personal) + '</a></div>'

  $content = $template
  $content = Replace-Required $content '<head>' "<head>`r`n  <base href=""../../"" />"
  $content = Replace-Required $content '<title>.*?</title>' ('<title>' + (ConvertTo-HtmlText $title) + '</title>')
  $content = Replace-Required $content '(?m)^\s*<meta name="description".*$' ('  <meta name="description" content="' + (ConvertTo-HtmlText $description) + '" />')
  $content = Replace-Required $content '(?m)^\s*<meta property="og:title".*$' ('  <meta property="og:title" content="' + (ConvertTo-HtmlText $title) + '" />')
  $content = Replace-Required $content '(?m)^\s*<meta property="og:description".*$' ('  <meta property="og:description" content="' + (ConvertTo-HtmlText $description) + '" />')
  $content = Replace-Required $content '(?m)^\s*<meta property="og:image".*$' ('  <meta property="og:image" content="' + $fallbackImage + '" />')
  $content = Replace-Required $content '(?m)^\s*<meta property="og:url".*$' ('  <meta property="og:url" content="' + $canonical + '" />' + "`r`n  " + '<link rel="canonical" href="' + $canonical + '" />')
  $content = Replace-Required $content '<script src="\./assets/common\.js(?:\?[^"]*)?"></script>' ($inlineScript + "`r`n`r`n" + '$0')
  $content = Replace-Required $content '<span id="breadcrumbCurrent" class="breadcrumb-current" aria-current="page">.*?</span>' ('<span id="breadcrumbCurrent" class="breadcrumb-current" aria-current="page">' + (ConvertTo-HtmlText $name) + '</span>')
  $content = Replace-Required $content '<h2 id="name" class="name">.*?</h2>' ('<h2 id="name" class="name">' + (ConvertTo-HtmlText $name) + '</h2>')
  $content = $content.Replace('<div id="badges" class="badges"></div>', $badges)
  $content = $content.Replace('<div id="detailInfo" class="detail-info-card" hidden></div>', $info)
  $content = $content.Replace('<div id="detailTags" class="detail-tag-list" hidden></div>', $tags)
  $content = Replace-Required $content '<div id="weeklyCount" class="meta" style="margin-top:6px;">.*?</div>' ('<div id="weeklyCount" class="meta" style="margin-top:6px;">' + (ConvertTo-HtmlText $labels.priceMissing) + '</div>')

  $targetDir = Join-Path $OutputRoot $routeId
  if (-not (Test-Path -LiteralPath $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
  }
  Set-Content -LiteralPath (Join-Path $targetDir "index.html") -Value $content -Encoding UTF8
  Write-Output "generated sleeve/$routeId/index.html"
}
