param(
  [string]$DataPath = "data.json",
  [string]$PagePath = "index-market.html"
)
$ErrorActionPreference = "Stop"

function NumberOrNull([object]$Value) {
  if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) { return $null }
  $number = 0.0
  if ([double]::TryParse(([string]$Value).Replace(',', ''), [ref]$number) -and $number -gt 0) { return $number }
  return $null
}
function IsoDate([object]$Value) {
  $text = ([string]$Value).Trim()
  if (-not $text) { return '' }
  try { return ([datetime]$text).ToString('yyyy-MM-dd') } catch { return '' }
}
function IsWeeklyPeriod([string]$Period) { return $Period -match '^\d{4}-\d{2}-(?!01$)\d{2}$' }
function FormatDate([string]$Value) {
  $date = [datetime]$Value
  return '{0}/{1}/{2}' -f $date.Year,$date.Month,$date.Day
}
function JsRound([double]$Value) { return [math]::Floor($Value + 0.5) }
function FormatYen([double]$Value) { return (JsRound $Value).ToString('N0') + '&#20870;' }
function FormatSignedYen([double]$Value) {
  $sign = if($Value -gt 0){'+'}elseif($Value -lt 0){'-'}else{''}
  return $sign + ([math]::Abs((JsRound $Value))).ToString('N0') + '&#20870;'
}
function FormatPercent([double]$Value) {
  $sign = if($Value -gt 0){'+'}elseif($Value -lt 0){'-'}else{'&plusmn;'}
  return $sign + [math]::Abs($Value).ToString('0.0') + '%'
}
function TrendClass([double]$Value) { if($Value -gt 0){'up'}elseif($Value -lt 0){'down'}else{'flat'} }
function ReplaceElement([string]$Html,[string]$Id,[string]$Content,[string]$ClassName='') {
  $pattern='(?s)(<(?<tag>[a-z0-9]+)\s+id="'+[regex]::Escape($Id)+'"[^>]*>).*?(</\k<tag>>)'
  return [regex]::Replace($Html,$pattern,{param($m)
    $open=$m.Groups[1].Value
    if($ClassName){$open=[regex]::Replace($open,'class="[^"]*"','class="'+$ClassName+'"')}
    return $open+$Content+$m.Groups[2].Value
  },1)
}
function FindPrior([array]$Rows,[datetime]$LatestDate,[int]$Days) {
  $cutoff=$LatestDate.AddDays(-$Days)
  return @($Rows|Where-Object{$_.date -le $cutoff}|Select-Object -Last 1)
}
function ChangeInfo([object]$Latest,[object]$Base) {
  if($null -eq $Latest -or $null -eq $Base -or $Base.avgPrice -le 0){return $null}
  $amount=$Latest.avgPrice-$Base.avgPrice
  return [pscustomobject]@{amount=$amount;rate=($amount/$Base.avgPrice)*100;week=$Base.week}
}

if(-not(Test-Path -LiteralPath $DataPath)){throw "Data file not found: $DataPath"}
if(-not(Test-Path -LiteralPath $PagePath)){throw "Market page not found: $PagePath"}
$data=Get-Content -LiteralPath $DataPath -Raw -Encoding UTF8|ConvertFrom-Json
$sleeves=@($data.sleeves)
if(-not $sleeves.Count){throw 'No sleeve data found'}

$periodSet=@{}
$timelines=New-Object System.Collections.Generic.List[object]
foreach($sleeve in $sleeves){
  $timeline=New-Object System.Collections.Generic.List[object]
  foreach($row in @($sleeve.weeklyPrices)){
    $period=IsoDate $row.week
    if(-not $period -or -not(IsWeeklyPeriod $period)){continue}
    $periodSet[$period]=$true
    $price=NumberOrNull $row.price
    if($null -ne $price){$timeline.Add([pscustomobject]@{period=$period;date=[datetime]$period;price=$price})}
  }
  if($timeline.Count){$timelines.Add(@($timeline|Sort-Object date))}
}
$periods=@($periodSet.Keys|Sort-Object)
if($periods.Count -lt 2){throw 'Not enough weekly periods to generate the market index'}

$rows=New-Object System.Collections.Generic.List[object]
$cursors=@();for($i=0;$i -lt $timelines.Count;$i++){$cursors+=-1}
foreach($period in $periods){
  $periodDate=[datetime]$period;$total=0.0;$target=0;$updated=0
  for($timelineIndex=0;$timelineIndex -lt $timelines.Count;$timelineIndex++){
    $timeline=$timelines[$timelineIndex];$updatedThisPeriod=$false
    while($cursors[$timelineIndex]+1 -lt $timeline.Count -and $timeline[$cursors[$timelineIndex]+1].date -le $periodDate){
      $cursors[$timelineIndex]++
      if($timeline[$cursors[$timelineIndex]].period -eq $period){$updatedThisPeriod=$true}
    }
    if($cursors[$timelineIndex] -lt 0){continue}
    $latestForSleeve=$timeline[$cursors[$timelineIndex]]
    $total+=$latestForSleeve.price;$target++
    if($updatedThisPeriod){$updated++}
  }
  if($target){$rows.Add([pscustomobject]@{week=$period;date=$periodDate;avgPrice=$total/$target;targetCount=$target;updateCount=$updated})}
}
if(-not $rows.Count){throw 'No valid market rows generated'}
$latest=$rows[-1]
$prev=if($rows.Count -ge 2){$rows[-2]}else{$null}
$rowArray=@($rows|ForEach-Object{$_})
$monthBase=@(FindPrior $rowArray $latest.date 28);$monthBase=if($monthBase.Count){$monthBase[0]}else{$null}
$yearBase=@(FindPrior $rowArray $latest.date 365);$yearBase=if($yearBase.Count){$yearBase[0]}else{$null}
$prevChange=ChangeInfo $latest $prev
$monthChange=ChangeInfo $latest $monthBase
$yearChange=ChangeInfo $latest $yearBase

$html=Get-Content -LiteralPath $PagePath -Raw -Encoding UTF8
$html=ReplaceElement $html 'updatedAt' (FormatDate $latest.week)
$countText='&#23550;&#35937; '+$latest.targetCount.ToString('N0')+'&#31278;&#39006; / &#26356;&#26032; '+$latest.updateCount.ToString('N0')+'&#31278;&#39006;'
$html=ReplaceElement $html 'countInfo' $countText
$html=ReplaceElement $html 'kpiLatestPrice' (FormatYen $latest.avgPrice)
$html=ReplaceElement $html 'kpiLatestMeta' ('<span class="latest-date">'+(FormatDate $latest.week)+'</span>') 'metric-foot flat'
foreach($item in @(
  @{value='kpiPrevChange';pct='kpiPrevPct';change=$prevChange},
  @{value='kpiMonthChange';pct='kpiMonthPct';change=$monthChange},
  @{value='kpiYearChange';pct='kpiYearPct';change=$yearChange}
)){
  if($null -eq $item.change){$value='--';$pct='--';$cls='flat'}else{$value=FormatSignedYen $item.change.amount;$pct=FormatPercent $item.change.rate;$cls=TrendClass $item.change.amount}
  $html=ReplaceElement $html $item.value $value ('metric-value '+$cls)
  $html=ReplaceElement $html $item.pct $pct ('metric-foot '+$cls)
}

$latestRate=if($prevChange){$prevChange.rate}else{$null}
$trend=if($null -eq $latestRate){'&#12411;&#12412;&#27178;&#12400;&#12356;&#12391;&#12377;'}elseif($latestRate -ge 2){'&#24375;&#12367;&#19978;&#26119;&#12375;&#12390;&#12356;&#12414;&#12377;'}elseif($latestRate -le -2){'&#19979;&#33853;&#12375;&#12390;&#12356;&#12414;&#12377;'}elseif($latestRate -ge .8){'&#19978;&#26119;&#12375;&#12390;&#12356;&#12414;&#12377;'}elseif($latestRate -le -.8){'&#12420;&#12420;&#36575;&#35519;&#12391;&#12377;'}else{'&#12411;&#12412;&#27178;&#12400;&#12356;&#12391;&#12377;'}
function ChangeSentence([string]$Label,[object]$Change){
  if($null -eq $Change){return $Label+'&#12399;&#27604;&#36611;&#12487;&#12540;&#12479;&#12364;&#19981;&#36275;&#12375;&#12390;&#12356;&#12414;&#12377;'}
  return $Label+'&#12399;'+(FormatSignedYen $Change.amount)+'&#65288;'+(FormatPercent $Change.rate)+'&#65289;'
}
$updateRate=if($latest.targetCount -gt 0){($latest.updateCount/$latest.targetCount)*100}else{$null}
$updatedSentence='&#20170;&#36913;&#12399;'+$latest.updateCount.ToString('N0')+'&#31278;&#39006;&#12364;&#26356;&#26032;&#12373;&#12428;&#12289;&#23550;&#35937;'+$latest.targetCount.ToString('N0')+'&#31278;&#39006;&#12398;&#12358;&#12385;'+$updateRate.ToString('0.0')+'%&#12395;&#26032;&#12375;&#12356;&#30456;&#22580;&#12364;&#20837;&#12426;&#12414;&#12375;&#12383;'
$comment='&#26368;&#26032;&#12398;&#20840;&#12473;&#12522;&#12540;&#12502;&#24179;&#22343;&#30456;&#22580;&#12399;'+(FormatYen $latest.avgPrice)+'&#12391;&#12289;&#21069;&#22238;&#27604;&#12391;&#12399;'+$trend+'&#12290;'+(ChangeSentence '&#21069;&#22238;&#27604;' $prevChange)+'&#12289;'+(ChangeSentence '&#26376;&#38291;' $monthChange)+'&#12289;'+(ChangeSentence '&#24180;&#38291;' $yearChange)+'&#12391;&#12377;&#12290;'+$updatedSentence+'&#12290;'
$html=ReplaceElement $html 'aiCommentWeek' ('&#23550;&#35937;&#36913;: '+(FormatDate $latest.week))
$html=ReplaceElement $html 'aiCommentBody' $comment

[System.IO.File]::WriteAllText((Resolve-Path $PagePath),$html,[System.Text.UTF8Encoding]::new($false))

$written=Get-Content -LiteralPath $PagePath -Raw -Encoding UTF8
$expected=@{
  updatedAt=(FormatDate $latest.week);kpiLatestPrice=(FormatYen $latest.avgPrice);
  kpiPrevChange=$(if($prevChange){FormatSignedYen $prevChange.amount}else{'--'});
  kpiMonthChange=$(if($monthChange){FormatSignedYen $monthChange.amount}else{'--'});
  kpiYearChange=$(if($yearChange){FormatSignedYen $yearChange.amount}else{'--'})
}
$mismatches=0
foreach($id in $expected.Keys){$match=[regex]::Match($written,'(?s)<[a-z0-9]+\s+id="'+$id+'"[^>]*>(.*?)</[a-z0-9]+>');if(-not$match.Success -or $match.Groups[1].Value -ne $expected[$id]){$mismatches++}}
if($mismatches){throw "Static market validation failed ($mismatches mismatches)"}
Write-Output ('Generated and validated market index: week={0}, target={1}, updated={2}, average={3}, mismatches=0' -f $latest.week,$latest.targetCount,$latest.updateCount,(JsRound $latest.avgPrice))
