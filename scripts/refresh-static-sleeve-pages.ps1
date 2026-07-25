param(
  [string]$DataPath = "data.json",
  [string]$TemplatePath = "detail.html",
  [string]$OutputRoot = "sleeve"
)

$ErrorActionPreference = "Stop"

$generator = Join-Path $PSScriptRoot "generate-sleeve-pages.ps1"
if (-not (Test-Path -LiteralPath $generator)) {
  throw "Generator not found: $generator"
}

& $generator -DataPath $DataPath -TemplatePath $TemplatePath -OutputRoot $OutputRoot
