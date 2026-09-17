param(
  [string]$DataPath = "data.json",
  [string]$TemplatePath = "detail.html",
  [string]$OutputRoot = "sleeve"
)

$ErrorActionPreference = "Stop"

$generator = Join-Path $PSScriptRoot "generate-sleeve-pages.ps1"
$categoryGenerator = Join-Path $PSScriptRoot "generate-category-pages.ps1"
$sitemapGenerator = Join-Path $PSScriptRoot "generate-sitemap.ps1"
foreach ($requiredGenerator in @($categoryGenerator, $generator, $sitemapGenerator)) {
  if (-not (Test-Path -LiteralPath $requiredGenerator)) {
    throw "Generator not found: $requiredGenerator"
  }
}

& $categoryGenerator -DataPath $DataPath
& $generator -DataPath $DataPath -TemplatePath $TemplatePath -OutputRoot $OutputRoot
& $sitemapGenerator -DataPath $DataPath
