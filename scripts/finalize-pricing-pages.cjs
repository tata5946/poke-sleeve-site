const fs = require('fs');
const path = require('path');
const pricing = require('../assets/pricing.js');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8')).sleeves;
const revision = fs.readFileSync('assets/common.js', 'utf8').match(/CATALOG_CACHE_REVISION = "([^"]+)"/)?.[1];
const assetVersion = revision ? 'catalog-' + revision : pricing.VERSION;
const byRoute = new Map(data.map(s => [/^\d{6,7}$/.test(String(s.id)) ? '4521329' + s.id : String(s.id), s]));
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir || '.', { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const file = dir ? dir + '/' + entry.name : entry.name;
    if (entry.isDirectory() && ['sleeve', 'sleeves', 'articles'].includes(file.split('/')[0])) walk(file);
    else if (entry.isFile() && file.endsWith('.html')) files.push(file);
  }
}
walk('');
const adTag = /\s*<script\b[^>]*src=["']https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^"']*["'][^>]*>\s*<\/script>/gi;
for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  const original = html;
  const product = byRoute.get(file.match(/^sleeve\/([^/]+)\/index.html$/)?.[1]);
  const isSample = /^sleeves\/sample-\d+\.html$/.test(file);
  if (isSample) {
    html = '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, follow"><title>サンプルページの公開運用は終了しました｜ポケスリ相場ナビ</title></head><body><h1>サンプルページの公開運用は終了しました</h1><p>実際の相場情報は<a href="/sleeves/">デッキシールド図鑑</a>をご覧ください。</p></body></html>\n';
  }
  const initial = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const excluded = isSample || ['detail.html', 'article.html', '404.html', 'contact.html', 'contact-complete.html'].includes(file)
    || file.startsWith('admin-') || /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(initial)
    || (product && !pricing.quote(product));
  if (excluded) html = html.replace(adTag, '');
  if (isSample && !/name="robots"/.test(initial)) html = html.replace('</head>', '<meta name="robots" content="noindex, follow"></head>');
  // Templates remain available for legacy links, but are not search landing pages.
  if (['detail.html', '404.html'].includes(file) && !/name="robots"/.test(initial)) html = html.replace('</head>', '<meta name="robots" content="noindex, follow"></head>');
  if (html.includes('assets/common.js') && !/src="[^"]*assets\/pricing\.js/.test(html)) {
    html = html.replace(/(<script\b[^>]*src="([^"]*assets\/)common\.js[^" ]*"[^>]*><\/script>)/, (_, tag, prefix) => `<script src="${prefix}pricing.js?v=${assetVersion}"></script>\n` + tag);
  }
  if (html.includes('assets/common.js') && !html.includes('assets/pricing-quality.css')) html = html.replace('</head>', `<link rel="stylesheet" href="/assets/pricing-quality.css?v=${assetVersion}"></head>`);
  html = html.replace(/assets\/pricing\.js\?v=[^"\s]+/g, 'assets/pricing.js?v=' + assetVersion).replace(/assets\/pricing-quality\.css\?v=[^"\s]+/g, 'assets/pricing-quality.css?v=' + assetVersion);
  if (file.startsWith('sleeves/') || /^(ranking|surge|growth|access-ranking)\.html$/.test(file)) {
    html = html.replaceAll('&#29694;&#22312;&#20385;&#26684;', '&#21442;&#32771;&#30456;&#22580;')
      .replaceAll('&#29694;&#22312;&#30456;&#22580;', '&#21442;&#32771;&#30456;&#22580;');
    html = html.replace(/<p class="zukan-card-price-label">[^<]*<\/p>/g, '<p class="zukan-card-price-label">参考相場</p>');
  }
  // Index/ranking cards provide observation metadata without depending on JavaScript.
  if (/^(ranking|surge|growth|access-ranking)\.html$/.test(file)) {
    html = html.replace(/<small class="reference-card-meta" data-quality-ranking>.*?<\/small>/g, '');
    html = html.replace(/(<a\b[^>]*data-static-ranking-item[^>]*data-ranking-id="([^"]+)"[^>]*>[\s\S]*?<strong class="ranking-mobile-price[^" ]*(?:[^" ]| )*"[^>]*>[\s\S]*?<\/strong>)/g,
      (block, prefix, id) => { const sleeve = data.find(s => String(s.id) === id); return sleeve ? block + `<small class="reference-card-meta" data-quality-ranking>${pricing.summary(sleeve)}</small>` : block; });
  }
  html = html.replace(/[ \t]+(?=\r?$)/gm, '');
  if (html !== original) fs.writeFileSync(file, html);
}
const recommendations = data.map(sleeve => {
  const value = pricing.quote(sleeve);
  const weekly = pricing.observations(sleeve).filter(row => row.type === 'weekly');
  const known = [sleeve.name, sleeve.releaseDate, sleeve.imageUrl, sleeve.type].filter(Boolean).length;
  return { id: sleeve.id, name: sleeve.name, url: '/sleeve/' + (/^\d{6,7}$/.test(String(sleeve.id)) ? '4521329' : '') + sleeve.id + '/',
    classification: !value ? '有効な相場なし' : weekly.length === 0 ? '月次・年次補完' : weekly.length <= 3 ? '週次履歴少数' : '週次履歴あり',
    reference_source: value?.type || 'none', reference_date: value?.date || '', transaction_count: value?.count ?? '',
    first_price_status: pricing.firstPrice(sleeve).status, first_price_evidence: pricing.firstPrice(sleeve).evidence,
    sheet_count: pricing.sheetCount(sleeve) ?? '', sheet_count_evidence: sleeve.sheetCountEvidence || '',
    index_recommendation: value ? 'index維持・観測条件を明示' : sleeve.note && known >= 4 ? '資料価値を人が確認した上でindex維持を検討' : 'noindex候補・商品固有情報を人が評価',
    action_taken: '商品ページ維持。商品単位のnoindexを機械的に追加しない。相場なしは広告読込を除外。' };
});
const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
const keys = Object.keys(recommendations[0]);
fs.mkdirSync('reports/site-quality-2026-10-12', { recursive: true });
fs.writeFileSync('reports/site-quality-2026-10-12/product-recommendations.csv', '\uFEFF' + keys.map(quote).join(',') + '\r\n' + recommendations.map(row => keys.map(key => quote(row[key])).join(',')).join('\r\n'));
const previousOutliers = fs.readFileSync('reports/site-audit-2026-10-12/outlier-candidates.csv', 'utf8');
fs.writeFileSync('reports/site-quality-2026-10-12/outlier-source-review.csv', previousOutliers.trimEnd() + '\r\n');
fs.writeFileSync('reports/site-quality-2026-10-12/outlier-review-status.json', JSON.stringify({ reviewed_aggregate_candidates: 17,
  raw_transaction_verification: '未確認：公開JSONとGASコードは集計価格・件数のみ。原取引のURL、状態、送料、セット内容が含まれないため検証不能。',
  action: '価格は根拠なく削除・変更せず、少数件数・急変の注意表示を追加。元取引を人が照合するため元の17件のURLと集計記録を保存。' }, null, 2));
console.log('Finalized ' + files.length + ' HTML files; wrote individual index recommendations for ' + data.length + ' products.');
require('./review-outlier-aggregates.cjs');
