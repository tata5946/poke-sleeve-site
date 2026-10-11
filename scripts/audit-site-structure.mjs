import fs from 'node:fs';
import path from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dateArg = process.argv.indexOf('--date');
const date = dateArg >= 0 ? process.argv[dateArg + 1] : '2026-10-12';
const out = path.join(root, 'reports', `site-audit-${date}`);
fs.mkdirSync(out, { recursive: true });
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const origin = 'https://pokesuri-navi.com';
const decode = value => String(value ?? '').replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = value => decode(String(value ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const initial = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
const attr = (tag, name) => decode(tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] ?? '');
const element = (html, id) => text(html.match(new RegExp(`<([\\w-]+)\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'))?.[2]);
const route = id => /^\d{6,7}$/.test(String(id)) ? '4521329' + id : String(id);
const urlFor = file => origin + (file === 'index.html' ? '/' : '/' + file.replace(/index\.html$/, ''));
const fileFor = url => {
  const pathname = decodeURIComponent(new URL(url).pathname);
  return pathname.endsWith('/') ? pathname.slice(1) + 'index.html' : pathname.slice(1);
};
const csv = (name, rows) => {
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const quote = value => '"' + String(Array.isArray(value) ? value.join(' | ') : value ?? '').replaceAll('"', '""') + '"';
  fs.writeFileSync(path.join(out, name), '\uFEFF' + keys.map(quote).join(',') + '\r\n' + rows.map(row => keys.map(key => quote(row[key])).join(',')).join('\r\n') + '\r\n');
};
const data = JSON.parse(read('data.json')).sleeves;
const template = read('detail.html');
const source = [...template.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
  .find(match => !/\bsrc=/.test(match[1]) && match[2].includes('function buildAiMarketDiagnosis'))[2];
const elements = new Map();
const getEl = id => {
  if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', querySelector: () => null, classList: { add() {}, remove() {} } });
  return elements.get(id);
};
const context = createContext({ console, URL, URLSearchParams, Date, Intl, setTimeout, clearTimeout,
  window: { addEventListener() {}, matchMedia: () => ({ matches: false }), common: null },
  document: { getElementById: getEl, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], baseURI: origin + '/' },
  location: { href: origin + '/', pathname: '/', search: '' }, navigator: {},
  localStorage: { getItem: () => null }, fetch: () => { throw Error('Local audit must not fetch'); }
});
runInContext(source, context);
const functions = runInContext('({buildFullPeriodSeries,getSleeveLatestMarketPrice,buildAiMarketDiagnosis,getSeriesForMode,setPriceKpiFromSeries,getFirstPriceValue,getSleeveSheetCount})', context);
const commonSource = read('assets/common.js');
const commonContext = createContext({ console, URL, URLSearchParams, Date, Intl, setTimeout, clearTimeout,
  window: { addEventListener() {} }, document: { addEventListener() {}, querySelectorAll: () => [], getElementById: () => null },
  location: { href: origin + '/', pathname: '/', search: '' }, navigator: {}, localStorage: { getItem: () => null }, sessionStorage: { getItem: () => null } });
runInContext(commonSource.slice(0, commonSource.indexOf('/* ----- Auto-init')), commonContext);
commonContext.auditData = { sleeves: data };
const sanitized = runInContext('sanitizeDataPayload(auditData).sleeves', commonContext);
const marketSource = [...read('index-market.html').matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
  .find(match => !/\bsrc=/.test(match[1]) && match[2].includes('function buildMarketIndexView'))[2];
const marketContext = createContext({ console, URL, URLSearchParams, Date, Intl, setTimeout, clearTimeout,
  window: { matchMedia: () => ({ matches: false }) }, document: { getElementById: () => null }, location: { href: origin + '/' } });
runInContext(marketSource.slice(0, marketSource.lastIndexOf('    main();')), marketContext);
const marketFunctions = runInContext('({buildMarketIndexView,buildAveragePriceSeries,buildMarketCommentStats})', marketContext);
const marketCalculations = [];
for (const [label, sleeves] of [['raw-master', data], ['common-sanitized', sanitized]]) {
  const view = marketFunctions.buildMarketIndexView(sleeves, 'week');
  const series = marketFunctions.buildAveragePriceSeries(view.entries, view.periods, view.periodType);
  marketCalculations.push({ label, last_two_periods: series.slice(-2).map(row => ({ week: row.week, avgPrice: row.avgPrice, targetCount: row.targetCount, updateCount: row.updateCount })), comment_stats: marketFunctions.buildMarketCommentStats(series) });
}
const latestRows = sleeve => (sleeve.weeklyPrices || []).filter(row => row.price > 0).sort((a, b) => String(a.week).localeCompare(String(b.week)));
const globalWeek = data.flatMap(latestRows).map(row => row.week).sort().at(-1);
const age = observed => observed ? Math.round((Date.parse(date) - Date.parse(observed)) / 86400000) : null;
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const file = dir ? dir + '/' + entry.name : entry.name;
    if (entry.isDirectory() && ['sleeve', 'sleeves', 'articles'].includes(file.split('/')[0])) walk(file);
    else if (entry.isFile() && file.endsWith('.html')) files.push(file);
  }
}
walk('');
const sitemap = read('sitemap.xml');
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => decode(match[1]));
const sitemapSet = new Set(sitemapUrls);
const manifest = JSON.parse(read('data/category-page-manifest.json'));
const pages = [], links = [], jsonLdErrors = [], brokenAssets = [];
for (const file of files.sort()) {
  const html = read(file), body = initial(html), url = urlFor(file);
  const tags = [...body.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]);
  const canonicals = tags.filter(tag => attr(tag, 'rel') === 'canonical').map(tag => attr(tag, 'href'));
  const robots = [...body.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]).filter(tag => attr(tag, 'name') === 'robots').map(tag => attr(tag, 'content')).join(';');
  const baseTag = html.match(/<base\b[^>]*>/i)?.[0];
  const base = new URL(baseTag ? attr(baseTag, 'href') : url, url).href;
  const group = /sample-\d+\.html$/.test(file) ? 'サンプルページ' : file.startsWith('sleeve/') ? '個別商品' : file.startsWith('sleeves/page/') ? 'ページ送り一覧' : file.startsWith('sleeves/') && file !== 'sleeves/index.html' && file !== 'sleeves/all.html' && !/^sleeves\/(pokemon|trainer|series)\/index\.html$/.test(file) ? 'カテゴリ結果' : file.startsWith('articles/') ? '記事' : file.startsWith('admin-') ? '管理画面' : '入口・機能・補助';
  const adLoader = /<script\b[^>]*src=["'][^"']*pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/i.test(html);
  const adSlots = [...body.matchAll(/<ins\b[^>]*class=["'][^"']*adsbygoogle[^"']*["']/g)].length;
  const schemaTypes = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const schema = JSON.parse(match[1]);
      for (const entry of (Array.isArray(schema) ? schema : schema['@graph'] || [schema])) schemaTypes.push(entry['@type']);
    } catch (error) { jsonLdErrors.push({ file, url, error: error.message }); }
  }
  const parsedLinks = [...body.matchAll(/<(a|script|link|img)\b[^>]*>/gi)].map(match => ({ tag: match[0], kind: match[1].toLowerCase() }));
  // Include script dependencies while excluding JavaScript strings pretending to be HTML links.
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>/gi)) parsedLinks.push({ tag: match[0], kind: 'script' });
  let outgoing = 0;
  for (const { tag, kind } of parsedLinks) {
    const value = attr(tag, kind === 'a' || kind === 'link' ? 'href' : 'src');
    if (!value || /^(#|data:|mailto:|tel:|javascript:)/.test(value)) continue;
    try {
      const target = new URL(value, base);
      if (target.origin !== origin) continue;
      if (/\$\{|%7B|%7D/.test(target.href)) continue;
      const targetFile = fileFor(target.href);
      const exists = fs.existsSync(path.join(root, targetFile));
      if (kind === 'a') {
        outgoing++;
        links.push({ from: url, target: target.origin + target.pathname, exists, query: target.search });
      } else if (!exists) brokenAssets.push({ file, url, target: target.href, kind });
    } catch {}
  }
  const parsedText = text(body.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || body);
  pages.push({ file, url, group, title: element(html, '__not_a_real_id__') || text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]),
    canonical: canonicals.join(' | '), canonical_count: canonicals.length, robots, noindex: /noindex/i.test(robots), in_sitemap: sitemapSet.has(url),
    ad_loader: adLoader, ad_slots: adSlots, static_text_chars: parsedText.length, html_bytes: Buffer.byteLength(html),
    h1_count: [...body.matchAll(/<h1\b/gi)].length, static_svg_count: [...body.matchAll(/<svg\b/gi)].length,
    structured_data_types: schemaTypes.filter(Boolean), static_header: Boolean(body.match(/id=["']site-header["'][^>]*>\s*\S[^<]/)),
    static_price: element(html, 'latestWeekly'), static_observation: element(html, 'weeklyCount'),
    common_revision: html.match(/assets\/common\.js\?v=([^"\s]+)/)?.[1] || '', internal_links: outgoing,
    placeholders: [...parsedText.matchAll(/確認中|集計中|読み込み中|データを集計しています/g)].map(match => match[0]),
    html_sha256: createHash('sha256').update(html).digest('hex') });
}
const byUrl = new Map(pages.map(page => [page.url, page]));
const inbound = new Map();
for (const link of links) inbound.set(link.target, (inbound.get(link.target) || 0) + 1);
for (const page of pages) page.inbound_static_links = (inbound.get(page.url) || 0) + (page.file.endsWith('index.html') ? inbound.get(page.url + 'index.html') || 0 : 0);
const products = [], differences = [], zeroRetail = [], outliers = [];
for (const sleeve of data) {
  const rows = latestRows(sleeve), latest = rows.at(-1), previous = rows.at(-2);
  const series = functions.buildFullPeriodSeries(sleeve), detailLatest = series.at(-1);
  const runtimeMarketPrice = functions.getSleeveLatestMarketPrice(sleeve);
  functions.setPriceKpiFromSeries(series, sleeve);
  const weeklyPoints = functions.getSeriesForMode(sleeve, '3m');
  const page = byUrl.get(origin + '/sleeve/' + route(sleeve.id) + '/');
  const html = read(page.file);
  const embedded = html.match(/window\.__SLEEVE_PAGE_DATA = (.*?);<\/script>/)?.[1];
  const stale = age(latest?.week);
  const flags = [];
  const anyPrice = [...(sleeve.weeklyPrices || []), ...(sleeve.monthlyPrices || []), ...(sleeve.yearlyPrices || [])].some(row => row.price > 0) || Object.values(sleeve.pricesByYear || {}).some(price => price > 0);
  const tier = !detailLatest ? (anyPrice ? 'データあり・現行チャート採用履歴なし' : '価格データなし') : !rows.length ? '週次なし・補完データのみ' : rows.length < 4 ? '週次履歴1〜3点' : '週次履歴4点以上';
  if (!sleeve.imageUrl) flags.push('画像URLなし');
  if (!sleeve.releaseDate) flags.push('発売日なし');
  if (!sleeve.releaseYear) flags.push('発売年なし');
  if (sleeve.firstPrice === 0) flags.push('発売時価格0');
  if (stale > 90) flags.push('最終週次観測90日超');
  if (latest && !(latest.count > 0)) flags.push('最新価格に正の件数なし');
  if (!detailLatest) flags.push('表示可能価格なし');
  const normalizedMatch = embedded ? JSON.stringify(JSON.parse(embedded)) === JSON.stringify(sleeve) : false;
  const sheetCounts = [...new Set([...(sleeve.categories || []), ...(sleeve.categoryTags || [])].flatMap(tag => [...String(tag).matchAll(/(\d+)枚販売/g)].map(match => Number(match[1]))))];
  if (!normalizedMatch) flags.push('埋め込みデータ不一致');
  const record = { id: sleeve.id, name: sleeve.name, url: page.url, release_date: sleeve.releaseDate, release_year: sleeve.releaseYear,
    first_price: sleeve.firstPrice, image_url_present: Boolean(sleeve.imageUrl), note: sleeve.note || '',
    raw_weekly_points: rows.length, detail_series_points: series.length, recent_weekly_points: weeklyPoints.length,
    positive_monthly_points: (sleeve.monthlyPrices || []).filter(row => row.price > 0).length,
    positive_yearly_points: (sleeve.yearlyPrices || []).filter(row => row.price > 0).length,
    any_price_data: anyPrice,
    declared_sheet_count: sheetCounts.length === 1 ? sheetCounts[0] : null,
    unit_price_sheet_count: functions.getSleeveSheetCount(sleeve),
    recent_weekly_transactions: weeklyPoints.reduce((sum, point) => sum + (point.count > 0 ? point.count : 0), 0),
    raw_latest_price: latest?.price ?? null, raw_latest_week: latest?.week || '', latest_count: latest?.count ?? null,
    days_since_latest_week: stale, detail_runtime_price: detailLatest?.price ?? null, detail_runtime_date: detailLatest?.date || '',
    diagnosis_rank_price: runtimeMarketPrice, static_price_text: page.static_price, static_observation: page.static_observation,
    runtime_price_text: getEl('latestWeekly').textContent, runtime_observation: getEl('weeklyCount').textContent,
    observation_element_exists: /\bid="weeklyCount"/.test(initial(html)),
    embedded_matches_master: normalizedMatch, tier, flags, ad_loader: page.ad_loader, in_sitemap: page.in_sitemap };
  products.push(record);
  if ((latest?.price ?? null) !== (detailLatest?.price ?? null) || (latest?.price ?? null) !== runtimeMarketPrice) {
    record.difference_type = latest && Math.round(latest.price) === detailLatest?.price && Math.round(latest.price) === runtimeMarketPrice ? '小数の丸め方の差' : '補完元・採用価格の差';
    differences.push(record);
  }
  if (sleeve.firstPrice === 0) zeroRetail.push(record);
  if (latest && previous && latest.price / previous.price >= 2 && latest.count <= 2) outliers.push({ ...record, previous_price: previous.price, previous_week: previous.week, increase_pct: Math.round((latest.price / previous.price - 1) * 1000) / 10 });
}
const indexCards = [];
for (const file of files.filter(file => file.startsWith('sleeves/'))) {
  const html = read(file);
  for (const match of html.matchAll(/<div class="zukan-card-shell"[^>]*data-sleeve-id="([^"]+)"[\s\S]*?<p class="zukan-card-price">([\s\S]*?)<\/p>/g)) {
    const product = products.find(product => String(product.id) === match[1]);
    if (!product) continue;
    const displayed = text(match[2]);
    const value = /^[\d,.]+円$/.test(displayed) ? Number(displayed.replace(/[,円]/g, '')) : null;
    indexCards.push({ page_url: urlFor(file), id: product.id, displayed_price: displayed, numeric_price: value,
      raw_latest_price: product.raw_latest_price, detail_runtime_price: product.detail_runtime_price,
      mismatch_with_detail: value !== product.detail_runtime_price });
  }
}
const categoryChecks = manifest.map(category => {
  const url = origin + category.path, page = byUrl.get(url);
  return { url, group: category.group, label: category.label, count: category.count, exists: Boolean(page), noindex: page?.noindex, in_sitemap: sitemapSet.has(url), expected_noindex: category.count < 2 };
});
const groups = {};
for (const page of pages) { groups[page.group] ||= { total: 0, noindex: 0, sitemap: 0, ad_loader: 0 }; const group = groups[page.group]; group.total++; group.noindex += Number(page.noindex); group.sitemap += Number(page.in_sitemap); group.ad_loader += Number(page.ad_loader); }
const quality = {};
for (const product of products) quality[product.tier] = (quality[product.tier] || 0) + 1;
const duplicateTitles = Object.entries(Object.groupBy(pages.filter(page => !page.noindex), page => page.title)).filter(([title, items]) => title && items.length > 1).map(([title, items]) => ({ title, urls: items.map(item => item.url) }));
const canonicalDuplicates = Object.entries(Object.groupBy(pages.filter(page => !page.noindex && page.canonical), page => page.canonical)).filter(([, items]) => items.length > 1).map(([canonical, items]) => ({ canonical, urls: items.map(item => item.url) }));
const years = [...new Set(products.map(product => product.release_year).filter(Boolean))].sort((a, b) => a - b).map(year => {
  const all = products.filter(product => product.release_year === year);
  const prices = all.map(product => product.raw_latest_price).filter(price => price > 0).sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);
  return { release_year: year, listed: all.length, priced: prices.length, median: prices.length ? (prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2) : null,
    mean: prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : null,
    over_3000_pct: prices.length ? prices.filter(price => price >= 3000).length / prices.length * 100 : null };
});
const brokenLinks = links.filter(link => !link.exists);
const summary = { audit_date_jst: date, scope: 'Local HTML and source audit; Google review logs and browser rendering are not inferred.',
  total_html: pages.length, products: data.length, latest_week: globalWeek, groups, quality,
  price_disagreements: differences.length, fractional_latest_prices: products.filter(product => product.raw_latest_price % 1).length,
  price_disagreement_types: Object.fromEntries(Object.entries(Object.groupBy(differences, row => row.difference_type)).map(([key, values]) => [key, values.length])),
  static_runtime_price_disagreements: products.filter(product => {
    const value = Number(product.static_price_text.replace(/[,円]/g, ''));
    return product.static_price_text && product.static_price_text !== '-' && value !== product.detail_runtime_price;
  }).map(product => ({ url: product.url, static: product.static_price_text, runtime: product.runtime_price_text })),
  missing_observation_elements: products.filter(product => !product.observation_element_exists).length,
  sheet_count_mismatches: products.filter(product => product.declared_sheet_count && product.declared_sheet_count !== product.unit_price_sheet_count).length,
  zero_retail_products: zeroRetail.length, missing_image_urls: products.filter(product => !product.image_url_present).length,
  missing_release_dates: products.filter(product => !product.release_date).length, stale_over_90_days: products.filter(product => product.days_since_latest_week > 90).length,
  latest_weekly_without_positive_count: products.filter(product => product.raw_latest_week && !(product.latest_count > 0)).length,
  outlier_review_candidates: outliers.length, embedded_data_mismatches: products.filter(product => !product.embedded_matches_master).length,
  index_cards_checked: indexCards.length, index_card_disagreements: indexCards.filter(card => card.mismatch_with_detail).length,
  sitemap_urls: sitemapUrls.length, sitemap_duplicate_urls: sitemapUrls.length - sitemapSet.size,
  sitemap_missing_files: sitemapUrls.filter(url => !fs.existsSync(path.join(root, fileFor(url)))),
  sitemap_noindex_urls: pages.filter(page => page.in_sitemap && page.noindex).map(page => page.url),
  canonical_missing: pages.filter(page => !page.canonical).map(page => page.url),
  canonical_multiple: pages.filter(page => page.canonical_count > 1).map(page => page.url), canonical_duplicates: canonicalDuplicates,
  canonical_missing_target: pages.filter(page => page.canonical && !fs.existsSync(path.join(root, fileFor(page.canonical)))).map(page => page.url),
  duplicate_titles: duplicateTitles, jsonld_errors: jsonLdErrors, broken_assets: brokenAssets,
  broken_static_links_unique: [...new Set(brokenLinks.map(link => link.target))],
  ad_loader_pages: pages.filter(page => page.ad_loader).length, noindex_with_ad_loader: pages.filter(page => page.noindex && page.ad_loader).length,
  actual_ins_ad_slots: pages.reduce((sum, page) => sum + page.ad_slots, 0), ads_txt_exists: fs.existsSync(path.join(root, 'ads.txt')),
  category_noindex_mismatches: categoryChecks.filter(category => category.exists && category.noindex !== category.expected_noindex),
  article_data_count: JSON.parse(read('articles.json')).articles.length, article_html_count: files.filter(file => file.startsWith('articles/')).length,
  market_static: Object.fromEntries(['updatedAt', 'countInfo', 'kpiLatestPrice', 'aiCommentBody', 'subtitle', 'indexChart'].map(id => [id, element(read('index-market.html'), id)])),
  market_calculations: marketCalculations,
  top_static: Object.fromEntries(['homeSiteIntroSleeveCount', 'homeAboutSleeveCount', 'marketStatsGrid'].map(id => [id, element(read('index.html'), id)])) };
csv('pages.csv', pages);
csv('products.csv', products);
csv('price-disagreements.csv', differences);
csv('zero-retail.csv', zeroRetail);
csv('outlier-candidates.csv', outliers);
csv('index-cards.csv', indexCards);
csv('broken-links.csv', brokenLinks);
csv('categories.csv', categoryChecks);
csv('release-year-statistics.csv', years);
csv('static-runtime-price-disagreements.csv', products.filter(product => {
  const value = Number(product.static_price_text.replace(/[,円]/g, ''));
  return product.static_price_text && product.static_price_text !== '-' && value !== product.detail_runtime_price;
}));
const findings = [];
const addFinding = (url, classification, priority, code, evidence, action) => findings.push({ url, classification, priority, code, evidence, suggested_action: action });
for (const product of products) {
  if (!product.observation_element_exists) addFinding(product.url, '確定不具合', 'P1', 'OBSERVATION_TARGET_MISSING', '最終観測日の出力先 weeklyCount がDOMに存在しない', '現在価格の近くに観測日と最新週の件数を表示する');
  const staticPrice = Number(product.static_price_text.replace(/[,円]/g, ''));
  if (product.static_price_text !== '-' && product.static_price_text && staticPrice !== product.detail_runtime_price) addFinding(product.url, '確定不具合', 'P1', 'STATIC_RUNTIME_PRICE', `${product.static_price_text} → ${product.runtime_price_text}`, '静的生成と実行時の価格採用・補完条件を共通化する');
  if (product.raw_latest_price % 1) addFinding(product.url, '改善推奨', 'P2', 'ROUNDING', `図鑑 ${product.raw_latest_price}円 / 個別 ${product.detail_runtime_price}円`, '全表示面で小数価格の扱いを統一する');
  if (product.declared_sheet_count && product.declared_sheet_count !== product.unit_price_sheet_count) addFinding(product.url, '確定不具合', 'P2', 'UNIT_PRICE_SHEET_COUNT', `${product.declared_sheet_count}枚販売カテゴリの商品を${product.unit_price_sheet_count}枚で割る`, '実際の内容枚数を商品データに保持し単価計算に利用する');
  if (product.first_price === 0) addFinding(product.url, '審査リスク', 'P1', 'ZERO_RETAIL_SEMANTICS', '発売時価格0を表示。無料・セット収録・不明を区別する状態フィールドなし', '元データを確認し状態別の表示にする');
  if (!product.any_price_data) addFinding(product.url, '審査リスク', 'P1', 'NO_PRICE_HISTORY', '正の週次・月次・年次価格なし。index可能でAdSense読込コードあり', '資料価値を個別確認し、情報補強と広告対象の見直しを行う');
  else if (!product.detail_series_points) addFinding(product.url, '審査リスク', 'P1', 'UNUSED_PRICE_HISTORY', '価格データはあるが現行チャート採用点0', '発売前データ・年次のみデータ・月次カットオフを個別確認する');
  if (product.days_since_latest_week > 90) addFinding(product.url, '改善推奨', 'P2', 'STALE_OBSERVATION', `最終週次観測 ${product.raw_latest_week}（${product.days_since_latest_week}日前）`, '直近取引がないことを明示する');
}
for (const product of outliers) addFinding(product.url, '審査リスク', 'P1', 'OUTLIER_REVIEW', `前回比 +${product.increase_pct}% / 最新 ${product.latest_count}件。誤価格と断定せず要確認`, '元取引・商品状態・セット混入を確認し参考値の注意を表示する');
addFinding(origin + '/index-market.html', '確定不具合', 'P1', 'MARKET_RAW_SANITIZED', '静的生成は未補正master、実行時は発売前データ除去後。前回比とコメントが変わる', '同じ補正済み入力と同じ計算関数で静的・実行時を生成する');
addFinding(origin + '/index-market.html', '改善推奨', 'P2', 'STATIC_CHART_EMPTY', '主要数値は静的に存在するが indexChart は空', '初期HTMLにグラフまたは集計表を追加する');
for (const page of pages.filter(page => page.group === 'サンプルページ')) addFinding(page.url, '審査リスク', 'P1', 'PUBLISHED_SAMPLE', '固定のサンプル価格配列、重複タイトル、noindexなし、AdSense読込コードあり', '公開対象から外すか用途を明示し広告対象を見直す');
addFinding(origin + '/detail.html', '審査リスク', 'P1', 'PUBLIC_EMPTY_TEMPLATE', 'idなしではエラーとなる公開テンプレート。noindexなし、AdSense読込コードあり', 'テンプレート自体の公開・検索・広告対象を見直す');
addFinding(origin + '/articles/article-2026-10-03/', '改善推奨', 'P2', 'ARTICLE_YEAR_ANALYSIS', '発売年別比較の記事に年別の件数・中央値・分布の集計表なし', '基準日・対象条件を明示した独自統計表を追加する');
addFinding(origin + '/ads.txt', '改善推奨', 'P3', 'ADS_TXT_MISSING', 'ローカルなし、公開取得404。Google公式では必須ではなく推奨', 'AdSense管理画面の正式スニペットに従って設定する');
csv('findings.csv', findings);
summary.finding_rows = findings.length;
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ total_html: summary.total_html, groups, quality, price_disagreements: summary.price_disagreements,
  zero_retail: summary.zero_retail_products, stale_90: summary.stale_over_90_days, no_count: summary.latest_weekly_without_positive_count,
  outliers: summary.outlier_review_candidates, broken_links: summary.broken_static_links_unique,
  canonical_missing: summary.canonical_missing, sitemap_noindex: summary.sitemap_noindex_urls.length,
  jsonld_errors: summary.jsonld_errors.length, broken_assets: summary.broken_assets.length,
  output: out }, null, 2));
