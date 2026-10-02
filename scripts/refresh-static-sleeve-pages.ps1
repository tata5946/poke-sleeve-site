param(
  [string]$DataPath = "data.json",
  [string]$TemplatePath = "detail.html",
  [string]$OutputRoot = "sleeve"
)

$ErrorActionPreference = "Stop"

$generator = Join-Path $PSScriptRoot "generate-sleeve-pages.ps1"
$categoryGenerator = Join-Path $PSScriptRoot "generate-category-pages.ps1"
$linkIndexGenerator = Join-Path $PSScriptRoot "generate-sleeve-link-index.ps1"
$rankingGenerator = Join-Path $PSScriptRoot "generate-ranking-static-content.ps1"
$marketIndexGenerator = Join-Path $PSScriptRoot "generate-market-index-static-content.ps1"
$articleGenerator = Join-Path $PSScriptRoot "generate-article-pages.ps1"
$duplicateSeoUpdater = Join-Path $PSScriptRoot "update-duplicate-sleeve-seo.ps1"
$sitemapGenerator = Join-Path $PSScriptRoot "generate-sitemap.ps1"
$homeGenerator = Join-Path $PSScriptRoot "generate-home-static-content.mjs"
foreach ($requiredGenerator in @($categoryGenerator, $generator, $duplicateSeoUpdater, $linkIndexGenerator, $rankingGenerator, $marketIndexGenerator, $articleGenerator, $sitemapGenerator, $homeGenerator)) {
  if (-not (Test-Path -LiteralPath $requiredGenerator)) {
    throw "Generator not found: $requiredGenerator"
  }
}

& $categoryGenerator -DataPath $DataPath
& $generator -DataPath $DataPath -TemplatePath $TemplatePath -OutputRoot $OutputRoot
& $duplicateSeoUpdater -DataPath $DataPath -OutputRoot $OutputRoot
& $linkIndexGenerator -DataPath $DataPath
& $rankingGenerator -DataPath $DataPath
& $marketIndexGenerator -DataPath $DataPath
& $articleGenerator
& $sitemapGenerator -DataPath $DataPath
& node $homeGenerator --data $DataPath
if ($LASTEXITCODE -ne 0) { throw "Home static generation failed." }
