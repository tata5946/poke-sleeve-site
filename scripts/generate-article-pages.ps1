param(
  [string]$ArticlesPath = "articles.json",
  [string]$TemplatePath = "article.html",
  [string]$ListPagePath = "articles.html",
  [string]$OutputRoot = "articles",
  [string]$SiteOrigin = "https://pokesuri-navi.com"
)

$ErrorActionPreference = "Stop"
$utf8 = [System.Text.UTF8Encoding]::new($false)

function HtmlEncode([object]$Value) { return [System.Net.WebUtility]::HtmlEncode([string]$Value) }
function AttrEncode([object]$Value) { return (HtmlEncode $Value) }
function Absolute-Url([string]$Value) {
  if (-not $Value) { return "$($SiteOrigin.TrimEnd('/'))/assets/favicon.svg" }
  if ($Value -match '^https?://') { return $Value }
  return "$($SiteOrigin.TrimEnd('/'))/$($Value.TrimStart('.','/'))"
}
function Plain-Text([object]$Article) {
  $text = ([string]$Article.excerpt).Trim()
  if (-not $text) { $text = ([string]$Article.summary).Trim() }
  if (-not $text) {
    $text = [regex]::Replace([string]$Article.html, '<[^>]+>', ' ')
    $text = [System.Net.WebUtility]::HtmlDecode($text)
    $text = [regex]::Replace($text, '\s+', ' ').Trim()
  }
  if ($text.Length -gt 150) { $text = $text.Substring(0, 150).TrimEnd() + '…' }
  return $text
}

if (-not (Test-Path -LiteralPath $ArticlesPath)) { throw "Articles file not found: $ArticlesPath" }
if (-not (Test-Path -LiteralPath $TemplatePath)) { throw "Article template not found: $TemplatePath" }
if (-not (Test-Path -LiteralPath $ListPagePath)) { throw "Article list not found: $ListPagePath" }

$data = Get-Content -LiteralPath $ArticlesPath -Raw -Encoding UTF8 | ConvertFrom-Json
$published = @($data.articles) | Where-Object { ([string]$_.status).Trim() -ne 'draft' }
$dynamic = @($published | Where-Object { -not ([string]$_.linkUrl).Trim() })
$template = Get-Content -LiteralPath $TemplatePath -Raw -Encoding UTF8

foreach ($article in $dynamic) {
  $slug = ([string]$article.slug).Trim(); if (-not $slug) { $slug = ([string]$article.id).Trim() }
  if (-not $slug -or $slug -notmatch '^[A-Za-z0-9._-]+$') { throw "Unsafe article slug: $slug" }
  $title = ([string]$article.title).Trim()
  $titleHtml = HtmlEncode $title
  $separatorIndex = $title.IndexOf('｜')
  if ($separatorIndex -ge 0) {
    $titlePrefix = HtmlEncode $title.Substring(0, $separatorIndex)
    $titleTail = HtmlEncode $title.Substring($separatorIndex)
    $titleHtml = $titlePrefix + '<span class="article-title-tail">' + $titleTail + '</span>'
  }
  $pageTitle = "$title｜ポケスリ相場ナビ"
  $description = Plain-Text $article
  $canonical = "$($SiteOrigin.TrimEnd('/'))/articles/$([uri]::EscapeDataString($slug))/"
  $image = Absolute-Url ([string]$article.coverImage)
  $date = ([string]$article.publishedAt).Trim()
  $updated = ([string]$article.updatedAt).Trim(); if (-not $updated) { $updated = $date }
  $category = ([string]$article.category).Trim()
  $articleBody = [regex]::Replace([string]$article.html, '<h1(\s[^>]*)?>', '<h2$1>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $articleBody = [regex]::Replace($articleBody, '</h1>', '</h2>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

  $jsonLdObject = [ordered]@{
    '@context' = 'https://schema.org'; '@type' = 'Article'; headline = $title
    description = $description; image = @($image); datePublished = $date; dateModified = $updated
    mainEntityOfPage = $canonical; url = $canonical
    publisher = [ordered]@{ '@type'='Organization'; name='ポケスリ相場ナビ'; url="$($SiteOrigin.TrimEnd('/'))/"; logo=[ordered]@{'@type'='ImageObject';url="$($SiteOrigin.TrimEnd('/'))/assets/favicon.svg"} }
  }
  $jsonLd = ($jsonLdObject | ConvertTo-Json -Depth 8 -Compress) -replace '</script', '<\/script'

  $cover = ''
  if (([string]$article.coverImage).Trim()) {
    $cover = "`n            <img class=`"article-cover`" src=`"$(AttrEncode $article.coverImage)`" alt=`"$(AttrEncode $title)`" width=`"1600`" height=`"900`" decoding=`"async`">"
  }
  $explicitExcerpt = ([string]$article.excerpt).Trim()
  $excerpt = ''; if ($explicitExcerpt) { $excerpt = "`n              <p class=`"article-lead`">$(HtmlEncode $explicitExcerpt)</p>" }
  $staticArticle = @"
          <article class="article-detail" data-article-slug="$(AttrEncode $slug)">$cover
            <header class="article-head">
              <div class="article-meta"><span>$(HtmlEncode $category)</span><span>$(HtmlEncode $date)</span></div>
              <h1 class="article-detail-title">$titleHtml</h1>$excerpt
            </header>
            <div class="article-body">$articleBody</div>
          </article>
"@

  $html = $template
  $html = $html -replace '<head>', "<head>`r`n  <base href=`"../../`" />"
  $html = [regex]::Replace($html, '\s*<meta name="robots" content="noindex, follow"\s*/>', '', 1)
  $html = [regex]::Replace($html, '<title>.*?</title>', "<title>$(HtmlEncode $pageTitle)</title>", 1)
  $html = [regex]::Replace($html, '<meta name="description" content=".*?"\s*/>', "<meta name=`"description`" content=`"$(AttrEncode $description)`" />", 1)
  $html = [regex]::Replace($html, '<meta property="og:title" content=".*?"\s*/>', "<meta property=`"og:title`" content=`"$(AttrEncode $pageTitle)`" />", 1)
  $html = [regex]::Replace($html, '<meta property="og:description" content=".*?"\s*/>', "<meta property=`"og:description`" content=`"$(AttrEncode $description)`" />", 1)
  $html = [regex]::Replace($html, '<meta property="og:image" content=".*?"\s*/>', "<meta property=`"og:image`" content=`"$(AttrEncode $image)`" />", 1)
  $html = [regex]::Replace($html, '<meta property="og:url" content=".*?"\s*/>', "<meta property=`"og:url`" content=`"$(AttrEncode $canonical)`" />`r`n  <link rel=`"canonical`" href=`"$(AttrEncode $canonical)`" />`r`n  <script type=`"application/ld+json`">$jsonLd</script>", 1)
  $html = $html -replace '<body class="page-content-focus" data-hide-global-header="1">', "<body class=`"page-content-focus`" data-hide-global-header=`"1`" data-article-slug=`"$(AttrEncode $slug)`">"
  $html = $html.Replace('<span id="breadcrumbTitle" class="breadcrumb-current" aria-current="page">読み込み中</span>', '<span id="breadcrumbTitle" class="breadcrumb-current" aria-current="page">' + (HtmlEncode $title) + '</span>')
  $html = [regex]::Replace($html, '<div id="articleMount" class="article-page">.*?</div>\s*</main>', "<div id=`"articleMount`" class=`"article-page`">`r`n$staticArticle        </div>`r`n      </main>", [System.Text.RegularExpressions.RegexOptions]::Singleline)

  $dir = Join-Path $OutputRoot $slug
  [System.IO.Directory]::CreateDirectory($dir) | Out-Null
  [System.IO.File]::WriteAllText((Join-Path $dir 'index.html'), $html, $utf8)
}

$cards = foreach ($article in ($published | Sort-Object `
  @{ Expression = { [string]$_.publishedAt }; Descending = $true },
  @{ Expression = { [string]$_.updatedAt }; Descending = $true })) {
  $slug = ([string]$article.slug).Trim(); if (-not $slug) { $slug = ([string]$article.id).Trim() }
  $href = ([string]$article.linkUrl).Trim(); if (-not $href) { $href = "./articles/$([uri]::EscapeDataString($slug))/" }
  $description = Plain-Text $article
  $image = ([string]$article.coverImage).Trim(); if (-not $image) { $image = './assets/favicon.svg' }
@"
              <a class="article-card" href="$(AttrEncode $href)">
                <img class="article-thumb" src="$(AttrEncode $image)" alt="" width="1600" height="900" decoding="async">
                <div class="article-card-body"><div class="article-meta"><span>$(HtmlEncode $article.category)</span><span>$(HtmlEncode $article.publishedAt)</span></div><h2 class="article-card-title">$(HtmlEncode $article.title)</h2></div>
              </a>
"@
}
$listHtml = Get-Content -LiteralPath $ListPagePath -Raw -Encoding UTF8
$replacement = "<section id=`"articleGrid`" class=`"article-grid`" aria-label=`"記事一覧`">`r`n$($cards -join "`r`n")            </section>"
$listHtml = [regex]::Replace($listHtml, '<section id="articleGrid" class="article-grid" aria-label="記事一覧">.*?</section>', $replacement, [System.Text.RegularExpressions.RegexOptions]::Singleline)
$listHtml = $listHtml -replace 'loadArticles\(\)\.then\(\(articles\) => \{([\s\S]*?)\}\)\.catch\(\(\) => \{\s*renderArticles\(\[\]\);\s*\}\);', 'loadArticles().then((articles) => {$1}).catch(() => { /* Keep the static article cards. */ });'
[System.IO.File]::WriteAllText($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ListPagePath), $listHtml, $utf8)
Write-Output "Generated $($dynamic.Count) article pages and static article cards."
