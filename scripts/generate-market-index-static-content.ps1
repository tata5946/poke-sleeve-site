param([string]$DataPath = "data.json", [string]$PagePath = "index-market.html")
$ErrorActionPreference = "Stop"
& node (Join-Path $PSScriptRoot "generate-market-static.mjs") --data $DataPath --page $PagePath
if ($LASTEXITCODE -ne 0) { throw "Static market generation failed" }
