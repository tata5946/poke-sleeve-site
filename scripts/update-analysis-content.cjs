const fs = require('fs');
const pricing = require('../assets/pricing.js');
const dataFile = process.argv.indexOf('--data') >= 0 ? process.argv[process.argv.indexOf('--data') + 1] : 'data.json';
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8')).sleeves;
const articles = JSON.parse(fs.readFileSync('articles.json', 'utf8'));
const years = [...new Set(data.map(s => s.releaseYear).filter(Boolean))].sort((a, b) => a - b);
const quoted = data.map(sleeve => ({ sleeve, quote: pricing.quote(sleeve) }));
const latest = quoted.filter(item => item.quote?.type === 'weekly').map(item => item.quote.date).sort().at(-1);
const rows = years.map(year => {
  const items = quoted.filter(item => item.sleeve.releaseYear === year);
  const prices = items.filter(item => item.quote).map(item => item.quote.price).sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  const median = prices.length ? prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2 : null;
  return { year, count: items.length, priced: prices.length, median, highRate: prices.length ? prices.filter(value => value >= 3000).length / prices.length * 100 : null };
});
const table = `<section class="independent-year-analysis" data-quality-year-analysis="1"><h2>発売年別に、掲載数と相場を比較</h2>
<p>掲載852商品のうち、発売前の記録を除いた有効な価格を持つ商品を集計しました。基準となる最新の週次データは${latest}週です。各商品の最終観測期間は異なり、週次がない場合は月次・年次を補完に使います。価格未取得の商品は価格統計の分母から除外します。</p>
<div class="analysis-table-wrap"><table><thead><tr><th>発売年</th><th>掲載商品数</th><th>相場取得商品数</th><th>相場中央値</th><th>3,000円以上の割合</th></tr></thead><tbody>${rows.map(row => `<tr><td>${row.year}年</td><td>${row.count}</td><td>${row.priced}</td><td>${pricing.yen(row.median)}</td><td>${row.highRate == null ? '-' : row.highRate.toFixed(1) + '%'}</td></tr>`).join('')}</tbody></table></div>
<p>中央値は商品ごとの参考相場を小さい順に並べた中央の値です。取引数で重みを付けた取引価格の中央値ではありません。3,000円以上の割合は、相場取得商品数を分母にしています。</p>
<p>古い発売年には高価格の商品が含まれますが、同じ年代でも相場は幅広く、価格未取得の商品もあります。年代だけで価格を判断せず、商品ごとの観測期間と件数も確認してください。この集計だけから、古いことが価格上昇の原因だとはいえません。</p>
<p><a href="/pricing-method.html">採用条件と補完データの見方</a></p></section>`;
const target = articles.articles.find(article => article.slug === 'article-2026-10-03');
if (!target) throw Error('Release-year article missing');
const before = target.html;
target.html = /<section class="independent-year-analysis"[\s\S]*?<\/section>/.test(target.html)
  ? target.html.replace(/<section class="independent-year-analysis"[\s\S]*?<\/section>/, () => table) : table + target.html;
// Replace display cards' zero retail prices only; dated narrative examples are retained.
for (const article of articles.articles) {
  article.html = article.html.replace(/(<[^>]*data-sleeve-id="([^" ]+)"[^>]*>[\s\S]*?)(?=<[^>]*data-sleeve-id=|$)/g, (block, prefix, id) => {
    const sleeve = data.find(sleeve => String(sleeve.id) === id);
    if (!sleeve || sleeve.firstPrice > 0) return block;
    return block.replace(/(発売時価格(?:<[^>]*>|\s|：|:)*)(?:0円|0&#20870;)/g, '$1' + pricing.firstPrice(sleeve).label);
  });
}
if (before !== target.html) target.updatedAt = '2026-10-12T00:00:00.000Z';
fs.writeFileSync('articles.json', JSON.stringify(articles, null, 2) + '\n');
fs.mkdirSync('reports/site-quality-2026-10-12', { recursive: true });
fs.writeFileSync('reports/site-quality-2026-10-12/release-year-statistics.json', JSON.stringify({ latestWeek: latest, conditions: 'Shared reference quotes; valid latest observation per product; unpriced products excluded from price denominators.', rows }, null, 2));
fs.writeFileSync('reports/site-quality-2026-10-12/article-opportunities.json', JSON.stringify(articles.articles.filter(article => /相場|価格|高騰|リザードン|シロナ/.test(article.title)).map(article => ({ slug: article.slug, title: article.title, suggestion: article === target ? '発売年別の実データ集計を追加済み' : '観測期間・対象商品数・取引件数の追記、対象商品の中央値との比較を編集者が検討。価格変動の原因は推測しない。' })), null, 2));
console.log('Updated the existing year-analysis article with observed statistics; retained dated narrative examples.');
