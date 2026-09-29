param([string]$DataPath = 'data.json', [string]$OutputRoot = 'sleeve')
$ErrorActionPreference = 'Stop'
$utf8 = [System.Text.UTF8Encoding]::new($false)
function Route([string]$Id) { if ($Id -match '^\d{6,7}$') { return "4521329$Id" }; return $Id }
function Enc([string]$Value) { return [System.Net.WebUtility]::HtmlEncode($Value) }
$data = Get-Content -LiteralPath $DataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$changed = 0
foreach ($group in @($data.sleeves | Where-Object { ([string]$_.name).Trim() } | Group-Object { ([string]$_.name).Trim() } | Where-Object Count -gt 1)) {
  $used = @{}
  foreach ($item in @($group.Group | Sort-Object id)) {
    $year = ([string]$item.releaseYear).Trim(); $series = ([string]$item.series).Trim(); $date = ([string]$item.releaseDate).Trim()
    $parts = @(); if ($year) { $parts += "${year}年発売" }; if ($series -and $series -ne '公式') { $parts += $series }
    $q = $parts -join '・'; if (-not $q -or $used.ContainsKey($q)) { if ($date) { $q = "${date}発売" } }
    if (-not $q -or $used.ContainsKey($q)) { $q = "商品ID $([string]$item.id)" }; $used[$q] = $true
    $path = Join-Path $OutputRoot (Join-Path (Route ([string]$item.id)) 'index.html')
    if (-not (Test-Path -LiteralPath $path)) { throw "Generated sleeve page not found: $path" }
    $html = Get-Content -LiteralPath $path -Raw -Encoding UTF8
    $name = ([string]$item.name).Trim(); $qualified = "${name}（${q}）"
    $title = "${qualified}｜デッキシールドの相場・価格推移｜ポケスリ相場ナビ"
    $subject = if ($name -match 'デッキシールド') { "ポケモンカード公式「${qualified}」" } else { "ポケモンカード公式デッキシールド「${qualified}」" }
    $release = if ($year) { "${year}年発売時" } else { '発売時' }
    $desc = "${subject}の相場・価格推移を掲載。${release}の定価や発売日などの商品情報も確認できます。ポケカスリーブの購入・売却時の相場確認にもご活用ください。"
    $html = [regex]::Replace($html, '<title>.*?</title>', "<title>$(Enc $title)</title>", 1)
    $html = [regex]::Replace($html, '<meta name="description" content=".*?"\s*/>', "<meta name=`"description`" content=`"$(Enc $desc)`" />", 1)
    $html = [regex]::Replace($html, '<meta property="og:title" content=".*?"\s*/>', "<meta property=`"og:title`" content=`"$(Enc $title)`" />", 1)
    $html = [regex]::Replace($html, '<meta property="og:description" content=".*?"\s*/>', "<meta property=`"og:description`" content=`"$(Enc $desc)`" />", 1)
    [System.IO.File]::WriteAllText($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($path), $html, $utf8)
    $changed++
  }
}
Write-Output "Updated duplicate-name SEO metadata in $changed sleeve pages."
