param(
  [string]$DataPath = "data.json",
  # Zero preserves all eligible rows, matching the former client-rendered pages.
  [int]$Limit = 0,
  [ValidateSet('price', 'growth', 'surge', 'access')]
  [string[]]$Pages = @('price', 'growth', 'surge', 'access')
)
$ErrorActionPreference = "Stop"
$WeeklyCache = @{}

function Html([object]$Value) { [System.Net.WebUtility]::HtmlEncode([string]$Value) }
function NumberOrNull([object]$Value) {
  if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) { return $null }
  $number = 0.0
  if ([double]::TryParse([string]$Value, [ref]$number)) { return $number }
  return $null
}
function IsoDate([object]$Value) {
  $text = ([string]$Value).Trim()
  if (-not $text) { return '' }
  if ($text -match '^\d{4}-\d{2}-\d{2}$') { return $text }
  if ($text -match '^\d{4}-\d{2}$') { return "$text-01" }
  if ($text -match '^\d{4}$') { return "$text-01-01" }
  try { return ([datetime]$text).ToString('yyyy-MM-dd') } catch { return '' }
}
function RouteId([object]$Value) {
  $id = ([string]$Value).Trim()
  if ($id -match '^\d{6,7}$') { return "4521329$id" }
  return $id
}
function Yen([object]$Value) {
  $number = NumberOrNull $Value
  if ($null -eq $number) { return '&mdash;' }
  return $number.ToString('#,0.###', [System.Globalization.CultureInfo]::InvariantCulture) + '&#20870;'
}
function WeeklyRows([object]$Sleeve, [bool]$ExcludeLegacyMonthly = $false) {
  $cacheKey = ([string]$Sleeve.id) + '|' + $(if ($ExcludeLegacyMonthly) { '1' } else { '0' })
  if ($WeeklyCache.ContainsKey($cacheKey)) { return @($WeeklyCache[$cacheKey]) }
  $map = @{}
  foreach ($row in @($Sleeve.weeklyPrices)) {
    $week = IsoDate $row.week
    if (-not $week) { continue }
    if ($ExcludeLegacyMonthly -and $week.EndsWith('-01') -and $week -lt '2026-01-01') { continue }
    $price = NumberOrNull $row.price
    if ($null -eq $price -or $price -le 0) { continue }
    $map[$week] = [pscustomobject]@{ week=$week; price=$price; count=(NumberOrNull $row.count) }
  }
  $result = @($map.Values | Sort-Object week)
  $WeeklyCache[$cacheKey] = $result
  return $result
}
function LatestGlobalWeek([array]$Sleeves, [bool]$ExcludeLegacyMonthly) {
  $latest = ''
  foreach ($sleeve in $Sleeves) {
    $rows = @(WeeklyRows $sleeve $ExcludeLegacyMonthly)
    if ($rows.Count -and $rows[-1].week -gt $latest) { $latest = $rows[-1].week }
  }
  return $latest
}
function DetailHref([object]$Sleeve) { return '/sleeve/' + (Html (RouteId $Sleeve.id)) + '/' }
function MetaHtml([object]$Sleeve, [string]$ClassName) {
  $items = New-Object System.Collections.Generic.List[string]
  if ($Sleeve.releaseYear) { $items.Add((Html $Sleeve.releaseYear) + '&#24180;&#30330;&#22770;') }
  if ($Sleeve.series) { $items.Add((Html $Sleeve.series)) }
  if (-not $items.Count) { return '' }
  if ($ClassName -eq 'podium') { return ($items | ForEach-Object { '<span class="podium-chip">' + $_ + '</span>' }) -join '' }
  return '<div class="compact-meta">' + (($items | ForEach-Object { '<span class="compact-meta-item">' + $_ + '</span>' }) -join '') + '</div>'
}
function PodiumHtml([object]$Row, [int]$Rank, [string]$Type) {
  $s = $Row.s
  $headingTag = if ($Rank -eq 1) { 'h2' } else { 'h3' }
  $kicker = switch ($Type) { 'price' {'PRICE RANKING'} 'growth' {'HIGH RATE RANKING'} 'surge' {'PRICE UP RANKING'} default {'ACCESS RANKING'} }
  $metricHtml = switch ($Type) {
    'price' { '<div class="podium-metric"><span class="podium-metric-label">&#29694;&#22312;&#20385;&#26684;</span><div class="podium-price">' + (Yen $Row.price) + '</div></div><div class="podium-metric"><span class="podium-metric-label">&#21069;&#36913;&#27604;</span><div class="podium-diff ' + $Row.deltaClass + '">' + $Row.deltaText + '</div><div class="podium-rate ' + $Row.deltaClass + '">' + $Row.rateText + '</div></div>' }
    'growth' { '<div class="podium-metric"><span class="podium-metric-label">&#26368;&#26032;&#20385;&#26684;</span><div class="podium-price">' + (Yen $Row.latest) + '</div></div><div class="podium-metric"><span class="podium-metric-label">&#19978;&#26119;&#29575;</span><div class="podium-rate ' + $Row.deltaClass + '">' + $Row.rateText + '</div></div>' }
    'surge' { '<div class="podium-metric"><span class="podium-metric-label">&#29694;&#22312;&#20385;&#26684;</span><div class="podium-price">' + (Yen $Row.latest) + '</div></div><div class="podium-metric"><span class="podium-metric-label">&#21069;&#36913;&#27604;</span><div class="podium-diff">' + $Row.deltaText + '</div><div class="podium-rate ' + $Row.deltaClass + '">' + $Row.rateText + '</div></div>' }
    default { '<div class="podium-metric"><span class="podium-metric-label">&#26368;&#26032;&#20385;&#26684;</span><div class="podium-price">' + (Yen $Row.latest) + '</div></div><div class="podium-metric"><span class="podium-metric-label">&#26368;&#23433;&#20516;</span><div class="podium-price">' + (Yen $Row.min) + '</div></div><div class="podium-metric"><span class="podium-metric-label">&#26368;&#39640;&#20516;</span><div class="podium-price">' + (Yen $Row.max) + '</div></div>' }
  }
  $meta = MetaHtml $s 'podium'
  $graphHtml='<div class="podium-market-row">'+(RankingSparklineHtml $s)+'</div>'
  return @"
          <a class="podium-card ranking-card ranking-card--featured podium-card--rank$Rank" data-static-ranking-item data-ranking-rank="$Rank" data-ranking-id="$(Html $s.id)" data-ranking-current="$(Html $Row.latest)" data-ranking-compare="$(Html $Row.compare)" data-ranking-metric="$(Html $Row.metric)" data-sleeve-link="1" href="$(DetailHref $s)" aria-label="$(Html $s.name)&#12398;&#35443;&#32048;&#12434;&#35211;&#12427;">
            <div class="podium-badge">$Rank</div>
            <div class="podium-media"><img src="$(Html $s.imageUrl)" alt="$(Html $s.name)" loading="$(if($Rank -eq 1){'eager'}else{'lazy'})" referrerpolicy="no-referrer" onerror="this.onerror=null; this.style.display='none';"></div>
            <div class="podium-content">
              <div class="podium-kicker">$kicker</div>
              <$headingTag class="podium-title">$(Html $s.name)</$headingTag>
              <div class="podium-metrics">$metricHtml</div>
              $graphHtml
              <div class="podium-meta"><div class="podium-chip-group">$meta</div></div>
            </div>
          </a>
"@
}
function StandardHtml([object]$Row, [int]$Rank, [string]$Type) {
  $card = RankingMobileHtml $Row $Rank $Type
  $attributes = 'data-static-ranking-item data-ranking-rank="' + $Rank + '" data-ranking-id="' + (Html $Row.s.id) + '" data-ranking-current="' + (Html $Row.latest) + '" data-ranking-compare="' + (Html $Row.compare) + '" data-ranking-metric="' + (Html $Row.metric) + '"'
  return [regex]::Replace($card, 'data-ranking-mobile-item data-ranking-id="[^"]*" data-ranking-rank="[^"]*" data-ranking-current="[^"]*"', $attributes)
}
function PriceRows([array]$Sleeves) {
  $rows = foreach ($s in $Sleeves) {
    $weekly = @(WeeklyRows $s $false)
    if (-not $weekly.Count) { continue }
    $latest = $weekly[-1]
    $prev = if ($weekly.Count -ge 2) { $weekly[-2] } else { $null }
    $diff = if ($prev) { $latest.price - $prev.price } else { $null }
    $rate = if ($prev -and $prev.price -ne 0) { ($diff / $prev.price) * 100 } else { $null }
    $deltaClass = if ($null -eq $diff -or $diff -eq 0) {'flat'} elseif ($diff -gt 0) {'up'} else {'down'}
    $deltaText = if ($null -eq $diff) {'&#21069;&#36913;&#12487;&#12540;&#12479;&#12394;&#12375;'} elseif ($diff -gt 0) {'+' + [math]::Abs($diff).ToString('N0') + '&#20870;'} elseif ($diff -lt 0) {'-' + [math]::Abs($diff).ToString('N0') + '&#20870;'} else {'&plusmn;0&#20870;'}
    $rateText = if ($null -eq $rate) {'&mdash;'} else { $(if($rate -gt 0){'+'}else{''}) + $rate.ToString('0.0') + '%' }
    [pscustomobject]@{s=$s;price=$latest.price;latest=$latest.price;compare=$(if($prev){$prev.price}else{$null});metric=$latest.price;deltaClass=$deltaClass;deltaText=$deltaText;rateText=$rateText}
  }
  return @($rows | Sort-Object @{Expression={$_.price};Descending=$true}, @{Expression={[string]$_.s.name};Ascending=$true})
}
function GrowthRows([array]$Sleeves) {
  $globalWeek = LatestGlobalWeek $Sleeves $true
  $rows = foreach ($s in $Sleeves) {
    $weekly = @(WeeklyRows $s $true)
    if (-not $weekly.Count -or $weekly[-1].week -ne $globalWeek) { continue }
    $latest = $weekly[-1]
    $target = ([datetime]$latest.week).AddDays(-30).ToString('yyyy-MM-dd')
    $base = @($weekly | Where-Object { $_.week -le $target } | Select-Object -Last 1)
    if (-not $base.Count -or $base[0].price -eq 0) { continue }
    $diff = $latest.price - $base[0].price
    $rate = ($diff / $base[0].price) * 100
    if ([double]::IsNaN($rate) -or [double]::IsInfinity($rate)) { continue }
    $deltaClass = if($rate -gt 0){'up'}elseif($rate -lt 0){'down'}else{'flat'}
    $rateText = $(if($rate -gt 0){'+'}elseif($rate -lt 0){'-'}else{'&plusmn;'}) + [math]::Abs($rate).ToString('0.0') + '%'
    [pscustomobject]@{s=$s;latest=$latest.price;base=$base[0].price;compare=$base[0].price;diff=$diff;rate=$rate;metric=$rate;deltaClass=$deltaClass;rateText=$rateText}
  }
  return @($rows | Sort-Object @{Expression={$_.rate};Descending=$true}, @{Expression={$_.diff};Descending=$true})
}
function SurgeRows([array]$Sleeves) {
  $globalWeek = LatestGlobalWeek $Sleeves $true
  $rows = foreach ($s in $Sleeves) {
    $weekly = @(WeeklyRows $s $true)
    if ($weekly.Count -lt 2 -or $weekly[-1].week -ne $globalWeek) { continue }
    $latest=$weekly[-1]; $prev=$weekly[-2]; $diff=$latest.price-$prev.price
    if ($diff -le 0) { continue }
    $rate = if($prev.price -ne 0){($diff/$prev.price)*100}else{$null}
    $rateText = if($null -eq $rate){'&mdash;'}else{'+'+$rate.ToString('0.0')+'%'}
    [pscustomobject]@{s=$s;latest=$latest.price;previous=$prev.price;compare=$prev.price;diff=$diff;rate=$rate;metric=$diff;deltaClass='up';deltaText=('+'+$diff.ToString('N0')+'&#20870;');rateText=$rateText}
  }
  return @($rows | Sort-Object @{Expression={$_.diff};Descending=$true}, @{Expression={if($null -eq $_.rate){[double]::NegativeInfinity}else{$_.rate}};Descending=$true})
}
function RankingSparklineHtml([object]$Sleeve) {
  $weekly=@(WeeklyRows $Sleeve $false)
  $points=@($weekly|Select-Object -Last 12)
  $graph='<div class="sleeve-sparkline sleeve-sparkline--empty" aria-label="&#20385;&#26684;&#25512;&#31227;&#12487;&#12540;&#12479;&#19981;&#36275;"><span class="sleeve-sparkline-empty">&#20385;&#26684;&#25512;&#31227;&#12487;&#12540;&#12479;&#19981;&#36275;</span></div>'
  if($points.Count -ge 2){
    $minimum=($points|Measure-Object price -Minimum).Minimum;$maximum=($points|Measure-Object price -Maximum).Maximum;$range=$maximum-$minimum
    $coordinates=for($i=0;$i -lt $points.Count;$i++){$x=3+106*$i/($points.Count-1);$y=if($range -eq 0){20}else{37-34*($points[$i].price-$minimum)/$range};$x.ToString('0.0',[Globalization.CultureInfo]::InvariantCulture)+','+$y.ToString('0.0',[Globalization.CultureInfo]::InvariantCulture)}
    $line='M'+($coordinates -join ' L');$area=$line+' L109,40 L3,40 Z'
    $graph='<div class="sleeve-sparkline" aria-label="&#30452;&#36817;'+$points.Count+'&#36913;&#12398;&#20385;&#26684;&#25512;&#31227;"><svg viewBox="0 0 112 40" preserveAspectRatio="none" aria-hidden="true"><path class="sleeve-sparkline-area" d="'+$area+'"></path><path class="sleeve-sparkline-line" d="'+$line+'"></path></svg></div>'
  }
  return $graph
}
function RankingMobileHtml([object]$Row, [int]$Rank, [string]$Type) {
  $s=$Row.s
  $weekly=@(WeeklyRows $s $false)
  $delta=$null
  if($weekly.Count){$latest=$weekly[-1];$previousWeek=([datetime]$latest.week).AddDays(-7).ToString('yyyy-MM-dd');$previous=@($weekly|Where-Object{$_.week -eq $previousWeek});if($previous.Count){$delta=$latest.price-$previous[-1].price}}
  $direction=if($null -eq $delta -or $delta -eq 0){'flat'}elseif($delta -gt 0){'up'}else{'down'}
  $change=if($null -eq $delta){'&#12487;&#12540;&#12479;&#12394;&#12375;'}else{$prefix=if($delta -gt 0){'&#8599; +'}elseif($delta -lt 0){'&#8600; &#8722;'}else{'&#177;'};$prefix+[math]::Round([math]::Abs($delta),0,[MidpointRounding]::AwayFromZero).ToString('#,0',[Globalization.CultureInfo]::InvariantCulture)+'&#20870;'}
  $changeLabel='&#21069;&#36913;&#27604;'
  if($Type -eq 'growth'){$change=$Row.rateText;$changeLabel='30&#26085;&#21069;&#27604;';$direction=$Row.deltaClass}
  if($Type -eq 'surge'){$change='&#8599; '+$Row.deltaText;$changeLabel='&#21069;&#22238;&#27604;';$direction=$Row.deltaClass}
  $price=if($null -eq $Row.latest){'&#20385;&#26684;&#12394;&#12375;'}else{[math]::Round($Row.latest,0,[MidpointRounding]::AwayFromZero).ToString('#,0',[Globalization.CultureInfo]::InvariantCulture)+'&#20870;'}
  $graph=RankingSparklineHtml $s
  $badge=switch($Type){'price'{'&#26368;&#39640;&#20385;&#26684; No.1'}'growth'{'&#19978;&#26119;&#29575; No.1'}'surge'{'&#20516;&#19978;&#12364;&#12426;&#38989; No.1'}default{'&#27880;&#30446;&#24230; No.1'}}
  $popular=if($Rank -eq 1){'<span class="ranking-mobile-popular">'+$badge+'</span>'}else{''}
  $image=if($s.imageUrl){'<img src="'+(Html $s.imageUrl)+'" alt="'+(Html $s.name)+'" loading="'+$(if($Rank -eq 1){'eager'}else{'lazy'})+'" referrerpolicy="no-referrer" onerror="this.style.display=''none''">'}else{''}
  $year=if($s.releaseYear){(Html $s.releaseYear)+'&#24180;'}else{'&#19981;&#26126;'}
  $series=if($s.series){Html $s.series}else{'&#19981;&#26126;'}
  return @"
      <a class="ranking-mobile-card" data-ranking-mobile-item data-ranking-id="$(Html $s.id)" data-ranking-rank="$Rank" data-ranking-current="$(Html $Row.latest)" data-sleeve-link="1" href="$(DetailHref $s)" aria-label="$Rank &#20301; $(Html $s.name)&#12398;&#35443;&#32048;&#12434;&#35211;&#12427;">
        <span class="ranking-mobile-rank rank-$Rank">$Rank</span>
        <span class="ranking-mobile-image"><span aria-hidden="true">&#30011;&#20687;&#12394;&#12375;</span>$image</span>
        <div class="ranking-mobile-info">$popular<h3>$(Html $s.name)</h3><p class="ranking-mobile-meta">&#30330;&#22770;&#24180; $year &#65372; &#12471;&#12522;&#12540;&#12474; $series</p><div class="ranking-mobile-market"><strong class="ranking-mobile-price $direction">$price</strong><span class="ranking-mobile-change $direction"><small>$changeLabel</small>$change</span>$graph</div></div>
        <span class="ranking-mobile-chevron" aria-hidden="true">&#8250;</span>
      </a>
"@
}
function AccessRows([array]$Sleeves, [string]$PageHtml) {
  $byId=@{}; foreach($s in $Sleeves){$byId[[string]$s.id]=$s}
  $snapshot=[regex]::Match($PageHtml,'(?s)<script id="accessRankingSnapshot" type="application/json">(.*?)</script>')
  $ranking=if($snapshot.Success){@($snapshot.Groups[1].Value|ConvertFrom-Json)}else{@([regex]::Matches($PageHtml,'\{\s*id:\s*"([^"]+)"\s*,\s*access:\s*(\d+)\s*\}')|ForEach-Object{[pscustomobject]@{id=$_.Groups[1].Value;access=[int]$_.Groups[2].Value}})}
  $rows=foreach($item in $ranking){
    $id=[string]$item.id
    if(-not $byId.ContainsKey($id)){continue}
    $s=$byId[$id];$weekly=@(WeeklyRows $s $false)
    $latest=if($weekly.Count){$weekly[-1].price}else{$null}
    $prices=@($weekly|ForEach-Object{$_.price})
    $min=if($prices.Count){($prices|Measure-Object -Minimum).Minimum}else{$null}
    $max=if($prices.Count){($prices|Measure-Object -Maximum).Maximum}else{$null}
    $access=[int]$item.access
    [pscustomobject]@{s=$s;latest=$latest;compare=$null;min=$min;max=$max;access=$access;metric=$access}
  }
  return @($rows | Sort-Object @{Expression={$_.access};Descending=$true}, @{Expression={[string]$_.s.name};Ascending=$true})
}
function ReplaceRanking([string]$Path,[array]$Rows,[string]$Type) {
  if(-not(Test-Path $Path)){throw "Ranking page not found: $Path"}
  $html=Get-Content $Path -Raw -Encoding UTF8
  $selected=if($Type -eq 'access' -or $Limit -eq 0){@($Rows)}else{@($Rows|Select-Object -First $Limit)}
  if(-not$selected.Count){throw "No ranking rows generated: $Path"}
  $top=@();for($i=0;$i -lt [math]::Min(3,$selected.Count);$i++){$top+=PodiumHtml $selected[$i] ($i+1) $Type}
  $normal=@();for($i=3;$i -lt $selected.Count;$i++){$normal+=StandardHtml $selected[$i] ($i+1) $Type}
  $topMarkup='<section id="top3" class="ranking-top3" aria-label="&#12521;&#12531;&#12461;&#12531;&#12464;&#19978;&#20301;3&#20214;">' + "`r`n" + '        <!-- STATIC_RANKING_TOP3_START -->' + "`r`n" + '        <div id="top1">' + $top[0] + '        </div>' + "`r`n" + '        <div id="top2">' + $(if($top.Count -gt 1){$top[1]}else{''}) + '        </div>' + "`r`n" + '        <div id="top3Card">' + $(if($top.Count -gt 2){$top[2]}else{''}) + '        </div>' + "`r`n" + '        <!-- STATIC_RANKING_TOP3_END -->' + "`r`n" + '      </section>'
  $html=[regex]::Replace($html,'(?s)<section id="top3" class="ranking-top3"[^>]*>.*?</section>',{param($m)$topMarkup},1)
  $listClass=[regex]::Match($html,'<div id="list" class="([^"]+)">').Groups[1].Value
  $listMarkup='<div id="list" class="'+$listClass+'">' + "`r`n" + '          <!-- STATIC_RANKING_LIST_START -->' + "`r`n" + ($normal -join "`r`n") + '          <!-- STATIC_RANKING_LIST_END -->' + "`r`n" + '        </div>'
  $html=[regex]::Replace($html,'(?s)<div id="list" class="[^"]+">.*?</div>\s*</section>',{param($m)$listMarkup+"`r`n      </section>"},1)

  if($html -notmatch '<!-- STATIC_RANKING_MOBILE_START -->' -or $html -notmatch '<!-- STATIC_RANKING_MOBILE_END -->'){throw 'Static mobile ranking markers are missing'}
  # Only the podium needs separate mobile markup. Ranks 4+ reuse the identical
  # static cards in #list, avoiding a second copy of the full ranking in HTML.
  $mobile=@();for($i=0;$i -lt [math]::Min(3,$selected.Count);$i++){$mobile+=RankingMobileHtml $selected[$i] ($i+1) $Type}
  $mobileMarkup='<!-- STATIC_RANKING_MOBILE_START -->' + "`r`n" + '<div id="rankingMobileList" class="ranking-mobile-list" aria-label="&#12521;&#12531;&#12461;&#12531;&#12464;&#19968;&#35239;">' + "`r`n" + ($mobile -join "`r`n") + "`r`n" + '</div>' + "`r`n" + '<!-- STATIC_RANKING_MOBILE_END -->'
  $html=[regex]::Replace($html,'(?s)<!-- STATIC_RANKING_MOBILE_START -->.*?<!-- STATIC_RANKING_MOBILE_END -->',{param($m)$mobileMarkup},1)
  $html=[regex]::Replace($html,'<strong id="countInfo">.*?</strong>',{param($m)'<strong id="countInfo">'+$selected.Count+'&#20214;</strong>'},1)
  if($Type -ne 'access'){
    $latestWeek=LatestGlobalWeek $sleeves ($Type -ne 'price')
    $html=[regex]::Replace($html,'<strong id="updatedAt">.*?</strong>',{param($m)'<strong id="updatedAt">'+(Html $latestWeek)+'</strong>'},1)
  }


  # Preserve the former client-generated ItemList as static structured data.
  $schemaRows=@($selected|Select-Object -First 50)
  $items=for($i=0;$i -lt $schemaRows.Count;$i++){
    $s=$schemaRows[$i].s;$url='https://pokesuri-navi.com/sleeve/'+(RouteId $s.id)+'/'
    $item=[ordered]@{'@type'='Thing';name=[string]$s.name;url=$url}
    if($s.imageUrl){$item.image=[string]$s.imageUrl}
    [ordered]@{'@type'='ListItem';position=$i+1;url=$url;item=$item}
  }
  $schema=[ordered]@{'@context'='https://schema.org';'@type'='ItemList';name=[System.Net.WebUtility]::HtmlDecode([regex]::Match($html,'<h1[^>]*>(.*?)</h1>').Groups[1].Value);url=('https://pokesuri-navi.com/'+$Path);numberOfItems=$schemaRows.Count;itemListElement=@($items)}
  $schemaJson=($schema|ConvertTo-Json -Depth 8 -Compress).Replace('<','\u003c')
  $schemaMarkup='<script id="rankingItemListStructuredData" type="application/ld+json">'+$schemaJson+'</script>'
  if($html -match '<script id="rankingItemListStructuredData"'){
    $html=[regex]::Replace($html,'(?s)<script id="rankingItemListStructuredData"[^>]*>.*?</script>',{param($m)$schemaMarkup},1)
  }else{$html=$html.Replace('</head>',$schemaMarkup+"`r`n</head>")}
  [System.IO.File]::WriteAllText((Resolve-Path $Path),$html,[System.Text.UTF8Encoding]::new($false))
  $written=Get-Content $Path -Raw -Encoding UTF8
  $cards=[regex]::Matches($written,'data-static-ranking-item\s+data-ranking-rank="(\d+)"\s+data-ranking-id="([^"]*)"\s+data-ranking-current="([^"]*)"\s+data-ranking-compare="([^"]*)"\s+data-ranking-metric="([^"]*)"')
  $mismatches=0
  if($cards.Count -ne $selected.Count){$mismatches++}
  for($i=0;$i -lt [math]::Min($cards.Count,$selected.Count);$i++){
    $expected=$selected[$i];$actual=$cards[$i]
    $expectedValues=@([string]($i+1),[string]$expected.s.id,[string]$expected.latest,[string]$expected.compare,[string]$expected.metric)
    for($field=0;$field -lt $expectedValues.Count;$field++){if($actual.Groups[$field+1].Value -ne $expectedValues[$field]){$mismatches++}}
  }
  if($mismatches){throw "Static ranking validation failed ($mismatches mismatches): $Path"}

  $mobileCards=[regex]::Matches($written,'data-ranking-mobile-item\s+data-ranking-id="([^"]*)"\s+data-ranking-rank="(\d+)"')
  if($mobileCards.Count -ne [math]::Min(3,$selected.Count)){throw 'Static mobile podium count does not match desktop'}
  for($i=0;$i -lt $mobileCards.Count;$i++){if($mobileCards[$i].Groups[1].Value -ne [string]$selected[$i].s.id -or [int]$mobileCards[$i].Groups[2].Value -ne $i+1){throw 'Static mobile ranking order does not match desktop'}}
  Write-Output "Generated and validated $($selected.Count) static ranking items (0 mismatches): $Path"
}

if($Limit -lt 0){throw 'Limit must be nonnegative (0 generates all rows)'}
$data=Get-Content $DataPath -Raw -Encoding UTF8|ConvertFrom-Json
$sleeves=@($data.sleeves)
if('price' -in $Pages){ReplaceRanking 'ranking.html' (PriceRows $sleeves) 'price'}
if('growth' -in $Pages){ReplaceRanking 'growth.html' (GrowthRows $sleeves) 'growth'}
if('surge' -in $Pages){ReplaceRanking 'surge.html' (SurgeRows $sleeves) 'surge'}
if('access' -in $Pages){$accessHtml=Get-Content 'access-ranking.html' -Raw -Encoding UTF8;ReplaceRanking 'access-ranking.html' (AccessRows $sleeves $accessHtml) 'access'}
