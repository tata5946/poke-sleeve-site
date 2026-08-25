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
      period = $row.week
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
      period = $row.year
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
        period = $row.Name
        observedText = "年次データ: " + ([string]$row.Name)
      }
    }
  }

  return $null
}

function Test-SleeveNameHasDeckShield([string]$Name) {
  return ([string]$Name) -match 'デッキシールド'
}

function Get-SleeveDisplayName([object]$Sleeve) {
  return ([string]$Sleeve.name).Trim()
}

function Get-SleeveSeoProductName([object]$Sleeve) {
  $name = Get-SleeveDisplayName $Sleeve
  if ([string]::IsNullOrWhiteSpace($name)) { return "ポケモンカード スリーブ" }
  if (Test-SleeveNameHasDeckShield $name) { return $name }
  return "$name デッキシールド"
}

function Get-SleeveSeoTitle([object]$Sleeve) {
  $name = Get-SleeveDisplayName $Sleeve
  if ([string]::IsNullOrWhiteSpace($name)) {
    return "ポケモンカード スリーブ｜デッキシールドの相場・価格推移｜ポケスリ相場ナビ"
  }
  return "${name}｜デッキシールドの相場・価格推移｜ポケスリ相場ナビ"
}

function Get-SleeveReleaseYearText([object]$Sleeve) {
  $year = ([string]$Sleeve.releaseYear).Trim()
  if ([string]::IsNullOrWhiteSpace($year)) { return "" }
  return "${year}年"
}

function Get-SleeveDescriptionSubject([object]$Sleeve) {
  $name = ([string]$Sleeve.name).Trim()
  if ([string]::IsNullOrWhiteSpace($name)) {
    return "ポケモンカードのスリーブ・デッキシールド"
  }
  if (Test-SleeveNameHasDeckShield $name) {
    return "ポケモンカード公式「${name}」"
  }
  return "ポケモンカード公式デッキシールド「${name}」"
}

function Get-SleeveReleasePrefix([object]$Sleeve) {
  $yearText = Get-SleeveReleaseYearText $Sleeve
  if ([string]::IsNullOrWhiteSpace($yearText)) { return "" }
  return "${yearText}に発売された"
}

function Get-SleeveMetaDescription([object]$Sleeve) {
  $prefix = Get-SleeveReleasePrefix $Sleeve
  $subject = Get-SleeveDescriptionSubject $Sleeve
  $lead = if ($prefix) { "${prefix}${subject}" } else { $subject }
  return "${lead}の相場・価格情報。現在相場、過去の価格推移、商品情報を掲載しています。ポケカスリーブの購入・売却時の価格確認にご利用ください。"
}

function Get-SleeveIntroText([object]$Sleeve) {
  $name = Get-SleeveDisplayName $Sleeve
  if ([string]::IsNullOrWhiteSpace($name)) {
    return "ポケモンカード公式デッキシールドの現在相場や過去の価格推移、商品情報を掲載しています。ポケカのスリーブの購入・売却時の価格目安として利用できます。"
  }
  $releaseYear = Get-SleeveReleaseYearText $Sleeve
  $yearText = if ([string]::IsNullOrWhiteSpace($releaseYear)) { "" } else { "${releaseYear}に発売された" }
  $productText = if (Test-SleeveNameHasDeckShield $name) {
    "ポケモンカード公式「${name}」"
  } else {
    "ポケモンカード公式デッキシールド「${name}」"
  }
  return "${productText}は${yearText}ポケカのスリーブです。現在の相場や過去の価格推移、商品情報を掲載しています。"
}

function ConvertTo-JsonLdScript([string]$Id, [object]$Data) {
  $json = ($Data | ConvertTo-Json -Depth 20 -Compress).Replace("</script", "<\/script")
  return '<script id="' + (ConvertTo-HtmlText $Id) + '" type="application/ld+json">' + $json + '</script>'
}

function Get-StaticSleeveStructuredDataHtml([object]$Sleeve, [string]$RouteId, [string]$CanonicalUrl, [string]$ImageUrl, [object]$LatestTrade) {
  $productName = Get-SleeveSeoProductName $Sleeve
  $description = Get-SleeveMetaDescription $Sleeve
  $additionalProperty = New-Object System.Collections.Generic.List[object]

  if (-not [string]::IsNullOrWhiteSpace($RouteId)) {
    $additionalProperty.Add([ordered]@{
      "@type" = "PropertyValue"
      name = "JANコード"
      value = $RouteId
    })
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$Sleeve.releaseDate)) {
    $additionalProperty.Add([ordered]@{
      "@type" = "PropertyValue"
      name = "発売日"
      value = [string]$Sleeve.releaseDate
    })
  } elseif (-not [string]::IsNullOrWhiteSpace([string]$Sleeve.releaseYear)) {
    $additionalProperty.Add([ordered]@{
      "@type" = "PropertyValue"
      name = "発売年"
      value = [string]$Sleeve.releaseYear
    })
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$Sleeve.series)) {
    $additionalProperty.Add([ordered]@{
      "@type" = "PropertyValue"
      name = "公式/非公式"
      value = [string]$Sleeve.series
    })
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$Sleeve.type)) {
    $additionalProperty.Add([ordered]@{
      "@type" = "PropertyValue"
      name = "種類"
      value = [string]$Sleeve.type
    })
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$Sleeve.illustrator)) {
    $additionalProperty.Add([ordered]@{
      "@type" = "PropertyValue"
      name = "イラストレーター"
      value = [string]$Sleeve.illustrator
    })
  }
  if ($LatestTrade) {
    $additionalProperty.Add([ordered]@{
      "@type" = "PropertyValue"
      name = "相場価格"
      value = [double]$LatestTrade.price
      unitText = "JPY"
      description = "メルカリの売買成立価格平均"
    })
    if (-not [string]::IsNullOrWhiteSpace([string]$LatestTrade.period)) {
      $additionalProperty.Add([ordered]@{
        "@type" = "PropertyValue"
        name = "直近観測期間"
        value = [string]$LatestTrade.period
      })
    }
    if ($null -ne $LatestTrade.count -and [double]$LatestTrade.count -gt 0) {
      $additionalProperty.Add([ordered]@{
        "@type" = "PropertyValue"
        name = "直近観測件数"
        value = [int]$LatestTrade.count
      })
    }
  }

  $product = [ordered]@{
    "@context" = "https://schema.org"
    "@type" = "Product"
    name = $productName
    description = $description
    url = $CanonicalUrl
    category = "ポケモンカード デッキシールド"
  }
  if (-not [string]::IsNullOrWhiteSpace($ImageUrl)) { $product.Add("image", $ImageUrl) }
  if (-not [string]::IsNullOrWhiteSpace($RouteId)) {
    $product.Add("sku", $RouteId)
    if ($RouteId -match '^\d{13}$') { $product.Add("gtin13", $RouteId) }
    if ($RouteId -match '^\d{14}$') { $product.Add("gtin14", $RouteId) }
  }
  if ($additionalProperty.Count -gt 0) { $product.Add("additionalProperty", [object]@($additionalProperty.ToArray())) }

  $breadcrumb = [ordered]@{
    "@context" = "https://schema.org"
    "@type" = "BreadcrumbList"
    itemListElement = @(
      [ordered]@{
        "@type" = "ListItem"
        position = 1
        name = "ホーム"
        item = "https://pokesuri-navi.com/"
      },
      [ordered]@{
        "@type" = "ListItem"
        position = 2
        name = "ポケモンカードのスリーブ・デッキシールド一覧"
        item = "https://pokesuri-navi.com/sleeves/"
      },
      [ordered]@{
        "@type" = "ListItem"
        position = 3
        name = $productName
        item = $CanonicalUrl
      }
    )
  }

  return "  " + (ConvertTo-JsonLdScript "productStructuredData" $product) + "`r`n  " + (ConvertTo-JsonLdScript "breadcrumbStructuredData" $breadcrumb)
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
  $routeId = Get-SleeveRouteId ([string]$Sleeve.id)
  $pairs = @(
    @('JAN&#12467;&#12540;&#12489;', $routeId),
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
  $name = Get-SleeveDisplayName $sleeve
  $series = ([string]$sleeve.series).Trim()
  $condition = ([string]$sleeve.condition).Trim()
  $releaseYear = ([string]$sleeve.releaseYear).Trim()
  $ogTitle = Get-SleeveSeoTitle $sleeve
  $ogDescription = Get-SleeveMetaDescription $sleeve
  $rawImage = ([string]$sleeve.imageUrl).Trim()
  $ogImage = if ($rawImage) { $rawImage } else { $fallbackOgImage }
  $ogUrl = "https://pokesuri-navi.com/sleeve/$encodedId/"
  $canonicalTag = '  <link rel="canonical" href="https://pokesuri-navi.com/sleeve/' + $encodedId + '/" />'
  $latestTrade = Get-LatestTrade $sleeve
  $structuredDataHtml = Get-StaticSleeveStructuredDataHtml -Sleeve $sleeve -RouteId $routeId -CanonicalUrl $ogUrl -ImageUrl $ogImage -LatestTrade $latestTrade
  $inlinePageDataScript = '  <script>window.__SLEEVE_PAGE_ID = ' + $jsId + ';window.__SLEEVE_PAGE_DATA = ' + $jsSleeve + ';</script>'
  $latestPriceText = if ($latestTrade) { ([double]$latestTrade.price).ToString("N0") + "円" } else { "-" }
  $latestDateText = if ($latestTrade) { [string]$latestTrade.observedText } else { "最終観測日: -" }
  $latestCountText = if ($latestTrade -and $null -ne $latestTrade.count -and [double]$latestTrade.count -gt 0) { $latestDateText + " / 取引件数: " + ([string]$latestTrade.count) + "件" } else { $latestDateText }
  $seoNoteHeadingName = if ($name) { $name } else { "このデッキシールド" }

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
    '<link rel="canonical" href="[^"]*" />',
    {
      param($match)
      return $match.Value + "`r`n" + $structuredDataHtml
    },
    1
  )
  $content = [regex]::Replace(
    $content,
    '<script src="\./assets/common\.js(?:\?[^"]*)?"></script>',
    ($inlinePageDataScript + "`r`n`r`n" + '$0'),
    1
  )
  $content = $content.Replace('<span id="breadcrumbCurrent" class="breadcrumb-current" aria-current="page">読み込み中...</span>', '<span id="breadcrumbCurrent" class="breadcrumb-current" aria-current="page">' + (ConvertTo-HtmlText $name) + '</span>')
  $content = $content.Replace('<img id="img" class="thumb" alt="" />', '<img id="img" class="thumb" src="' + (ConvertTo-HtmlText $ogImage) + '" alt="' + (ConvertTo-HtmlText $name) + '" referrerpolicy="no-referrer" />')
  $content = $content.Replace('<h1 id="name" class="name">読み込み中...</h1>', '<h1 id="name" class="name">' + (ConvertTo-HtmlText $name) + '</h1>')
  $content = $content.Replace('<span id="sleeveSeoNoteName">このデッキシールド</span>', '<span id="sleeveSeoNoteName">' + (ConvertTo-HtmlText $seoNoteHeadingName) + '</span>')
  $content = $content.Replace('<p id="sleeveSeoLead" class="detail-seo-note-text">ポケモンカードのスリーブ・デッキシールドの現在相場と価格推移を確認できます。</p>', '<p id="sleeveSeoLead" class="detail-seo-note-text">' + (ConvertTo-HtmlText (Get-SleeveIntroText $sleeve)) + '</p>')
  $content = $content.Replace('<a class="btn primary" id="backLink" href="./sleeves/" aria-label="ポケモンカードのスリーブ・デッキシールド一覧へ戻る">← スリーブ・デッキシールド一覧へ</a>', '<a class="btn primary" id="backLink" href="./sleeves/" aria-label="ポケモンカードのスリーブ・デッキシールド一覧へ戻る">← スリーブ・デッキシールド一覧へ</a>')
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
