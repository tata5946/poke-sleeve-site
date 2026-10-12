$script:PricingFacts = $null
function Read-PricingCatalog([string]$DataPath) {
  $pricingTempPath = Join-Path (Split-Path $PSScriptRoot -Parent) '.tmp_pricing_catalog.json'
  & node (Join-Path $PSScriptRoot 'prepare-pricing-catalog.cjs') --data $DataPath --out $pricingTempPath
  if ($LASTEXITCODE -ne 0) { throw 'Pricing catalog preparation failed' }
  $catalog = Get-Content -LiteralPath $pricingTempPath -Raw -Encoding UTF8 | ConvertFrom-Json
  Remove-Item -LiteralPath $pricingTempPath -Force
  $script:PricingFacts = Get-Content -LiteralPath (Join-Path (Split-Path $PSScriptRoot -Parent) 'data/pricing-facts.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  return $catalog
}
function Get-PricingFact([object]$Sleeve) { return $script:PricingFacts.items.PSObject.Properties[[string]$Sleeve.id].Value }
function Get-ReferencePrice([object]$Sleeve) { return (Get-PricingFact $Sleeve).quote.price }
function Get-ReleasePriceLabel([object]$Sleeve) { return (Get-PricingFact $Sleeve).firstPrice.label }
