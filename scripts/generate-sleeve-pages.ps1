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

function ConvertTo-HtmlText([object]$Value) {
  return [System.Net.WebUtility]::HtmlEncode([string]$Value)
}

function Get-LatestTrade([object]$Sleeve) {
  $rows = @($Sleeve.weeklyPrices) | Where-Object {
    $null -ne $_.price -and [double]$_.price -gt 0
  } | Sort-Object { [datetime]$_.week }
  if ($rows.Count -gt 0) {
    $row = $rows[-1]
    $dateText = ([string]$row.week).Substring(0, [Math]::Min(10, ([string]$row.week).Length))
    return [pscustomobject]@{
      price = $row.price
      count = $row.count
      observedText = "最終観測日: " + $dateText
    }
  }

  $yearly = @($Sleeve.yearlyPrices) | Where-Object {
    $null -ne $_.price -and [double]$_.price -gt 0
  } | Sort-Object { [int]$_.year }
  if ($yearly.Count -gt 0) {
    $row = $yearly[-1]
    return [pscustomobject]@{
      price = $row.price
      count = $row.count
      observedText = "年次データ: " + ([string]$row.year)
    }
  }

  if ($Sleeve.pricesByYear) {
    $pricesByYear = @($Sleeve.pricesByYear.PSObject.Properties) |
      Where-Object { $null -ne $_.Value -and [double]$_.Value -gt 0 } |
      Sort-Object { [int]$_.Name }
    if ($pricesByYear.Count -gt 0) {
      $row = $pricesByYear[-1]
      return [pscustomobject]@{
        price = $row.Value
        count = $null
        observedText = "年次データ: " + ([string]$row.Name)
      }
    }
  }

  return $null
}

function Get-StaticSleeveBadges([object]$Sleeve) {
  $values = @($Sleeve.series, $Sleeve.condition, $Sleeve.type) |
    Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } |
    Select-Object -Unique
  if ($values.Count -eq 0) { return '<div id="badges" class="badges"></div>' }
  $items = $values | ForEach-Object {
    '<span class="badge">' + (ConvertTo-HtmlText $_) + '</span>'
  }
  return '<div id="badges" class="badges">' + ($items -join '') + '</div>'
}

function Get-StaticSleeveInfo([object]$Sleeve) {
  $pairs = @(
    @('&#30330;&#22770;&#26085;', $Sleeve.releaseDate),
    @('&#30330;&#22770;&#24180;', $Sleeve.releaseYear),
    @('&#12471;&#12522;&#12540;&#12474;', $Sleeve.series),
    @('&#29366;&#24907;', $Sleeve.condition),
    @('&#31278;&#21029;', $Sleeve.type),
    @('&#12452;&#12521;&#12473;&#12488;&#12524;&#12540;&#12479;&#12540;', $Sleeve.illustrator),
    @('&#20837;&#25163;&#21306;&#20998;', $Sleeve.acquisitionType)
  )
  $lines = @()
  foreach ($pair in $pairs) {
    if (-not [string]::IsNullOrWhiteSpace([string]$pair[1])) {
      $lines += '<div class="detail-info-row"><span>' + $pair[0] + '</span><strong>' + (ConvertTo-HtmlText $pair[1]) + '</strong></div>'
    }
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$Sleeve.note)) {
    $lines += '<div class="detail-note-box">' + (ConvertTo-HtmlText $Sleeve.note) + '</div>'
  }
  if ($lines.Count -eq 0) { return '<div id="detailInfo" class="detail-info-card" hidden></div>' }
  return '<div id="detailInfo" class="detail-info-card">' + ($lines -join '') + '</div>'
}

function Get-StaticSleeveTags([object]$Sleeve) {
  $values = @($Sleeve.categories) |
    Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } |
    Select-Object -Unique
  if ($values.Count -eq 0) { return '<div id="detailTags" class="detail-tag-list" hidden></div>' }
  $items = $values | ForEach-Object {
    '<a class="detail-tag" href="./sleeves/?tag=' + [System.Uri]::EscapeDataString([string]$_) + '">' + (ConvertTo-HtmlText $_) + '</a>'
  }
  return '<div id="detailTags" class="detail-tag-list">' + ($items -join '') + '</div>'
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
  $canonicalTag = '  <link rel="canonical" href="https://pokesuri-navi.com/sleeve/' + $encodedId + '/" />'
  $inlinePageDataScript = '  <script>window.__SLEEVE_PAGE_ID = ' + $jsId + ';window.__SLEEVE_PAGE_DATA = ' + $jsSleeve + ';</script>'
  $latestTrade = Get-LatestTrade $sleeve
  $latestPriceText = if ($latestTrade) { ([double]$latestTrade.price).ToString("N0") + "円" } else { "-" }
  $latestDateText = if ($latestTrade) { [string]$latestTrade.observedText } else { "最終観測日: -" }
  $latestCountText = if ($latestTrade -and $null -ne $latestTrade.count -and [double]$latestTrade.count -gt 0) { $latestDateText + " / 取引件数: " + ([string]$latestTrade.count) + "件" } else { $latestDateText }

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
  $content = $content.Replace('<span id="breadcrumbCurrent" class="breadcrumb-current" aria-current="page">読み込み中...</span>', '<span id="breadcrumbCurrent" class="breadcrumb-current" aria-current="page">' + (ConvertTo-HtmlText $name) + '</span>')
  $content = $content.Replace('<img id="img" class="thumb" alt="" />', '<img id="img" class="thumb" src="' + (ConvertTo-HtmlText $ogImage) + '" alt="' + (ConvertTo-HtmlText $name) + '" referrerpolicy="no-referrer" />')
  $content = $content.Replace('<h2 id="name" class="name">読み込み中...</h2>', '<h2 id="name" class="name">' + (ConvertTo-HtmlText $name) + '</h2>')
  $content = $content.Replace('<div id="badges" class="badges"></div>', (Get-StaticSleeveBadges $sleeve))
  $content = $content.Replace('<div id="detailInfo" class="detail-info-card" hidden></div>', (Get-StaticSleeveInfo $sleeve))
  $content = $content.Replace('<div id="detailTags" class="detail-tag-list" hidden></div>', (Get-StaticSleeveTags $sleeve))
  $content = $content.Replace('<div id="latestWeekly" class="value">-</div>', '<div id="latestWeekly" class="value">' + (ConvertTo-HtmlText $latestPriceText) + '</div>')
  $content = $content.Replace('<div id="weeklyDelta" class="delta" style="margin-top:6px;"></div>', '<div id="weeklyDelta" class="delta flat" style="margin-top:6px;">価格推移データを掲載</div>')
  $content = $content.Replace('<div id="weeklyCount" class="meta" style="margin-top:6px;">最終観測日: -</div>', '<div id="weeklyCount" class="meta" style="margin-top:6px;">' + (ConvertTo-HtmlText $latestCountText) + '</div>')

  $targetDir = Join-Path $OutputRoot $routeId
  if (-not (Test-Path -LiteralPath $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
  }

  $targetPath = Join-Path $targetDir "index.html"
  Set-Content -LiteralPath $targetPath -Value $content -Encoding UTF8
}

Write-Output "Generated sleeve pages in $OutputRoot"
