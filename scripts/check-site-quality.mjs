import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pricing = createRequire(import.meta.url)('../assets/pricing.js');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const data = JSON.parse(read('data.json')).sleeves;
const origin = 'https://pokesuri-navi.com';
const files = [];
function walk(dir = '') {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const file = dir ? dir + '/' + entry.name : entry.name;
    if (entry.isDirectory() && ['sleeve', 'sleeves', 'articles'].includes(file.split('/')[0])) walk(file);
    else if (entry.isFile() && file.endsWith('.html')) files.push(file);
  }
}
walk();
const route = id => /^\d{6,7}$/.test(String(id)) ? '4521329' + id : String(id);
const decode = value => String(value ?? '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const attr = (tag, name) => decode(tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`))?.[1] || '');
const fileFor = url => decodeURIComponent(url.pathname).slice(1) + (url.pathname.endsWith('/') ? 'index.html' : '');
const problems = [], pages = [], cards = [];
const issue = (file, code, detail) => problems.push({ file, code, detail });
const byRoute = new Map(data.map(sleeve => [route(sleeve.id), sleeve]));
const indexedTitles = new Map();
const sitemapUrls = [...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(match => decode(match[1]));
const sitemapSet = new Set(sitemapUrls);
assert.equal(sitemapSet.size, sitemapUrls.length, 'Unique sitemap URLs');
for (const url of sitemapUrls) if (!fs.existsSync(path.join(root, fileFor(new URL(url))))) issue('sitemap.xml', 'MISSING_TARGET', url);
for (const file of files) {
  const html = read(file);
  const initial = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const url = new URL(file === 'index.html' ? '/' : '/' + file.replace(/index\.html$/, ''), origin);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1];
  if (!title) issue(file, 'TITLE_MISSING', 'Page title missing');
  const noindex = /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(initial);
  const canonicalTag = initial.match(/<link\b[^>]*rel="canonical"[^>]*>/)?.[0];
  const canonical = canonicalTag ? attr(canonicalTag, 'href') : '';
  if (!noindex && !canonical) issue(file, 'CANONICAL_MISSING', 'Indexable page has no canonical');
  if (canonical && !fs.existsSync(path.join(root, fileFor(new URL(canonical))))) issue(file, 'CANONICAL_TARGET', canonical);
  if (noindex && sitemapSet.has(url.href)) issue(file, 'SITEMAP_NOINDEX', url.href);
  const ad = /<script\b[^>]*src="https:\/\/pagead2\.googlesyndication\.com/.test(html);
  const sleeve = byRoute.get(file.match(/^sleeve\/([^/]+)\/index.html$/)?.[1]);
  const excluded = noindex || file.startsWith('admin-') || ['detail.html', 'article.html', '404.html', 'contact.html', 'contact-complete.html'].includes(file) || (sleeve && !pricing.quote(sleeve));
  if (excluded && ad) issue(file, 'EXCLUDED_AD_LOADER', 'Ad loader on excluded content');
  if (!noindex && title) {
    if (indexedTitles.has(title)) issue(file, 'DUPLICATE_INDEXED_TITLE', indexedTitles.get(title));
    indexedTitles.set(title, file);
  }
  const base = new URL(attr(html.match(/<base\b[^>]*>/)?.[0] || '', 'href') || url.href, url);
  const tags = [...initial.matchAll(/<(a|img|link)\b[^>]*>/g)].map(match => ({ tag: match[0], kind: match[1] }));
  for (const match of html.matchAll(/<script\b[^>]*src="[^"]*"[^>]*>/g)) tags.push({ tag: match[0], kind: 'script' });
  for (const { tag, kind } of tags) {
    const value = attr(tag, kind === 'img' || kind === 'script' ? 'src' : 'href');
    if (!value || /^(#|data:|mailto:|tel:|javascript:)/.test(value) || value.includes('${')) continue;
    const target = new URL(value, base);
    if (target.origin === origin && !fs.existsSync(path.join(root, fileFor(target)))) issue(file, 'BROKEN_INTERNAL_REFERENCE', target.href);
  }
  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const type = attr(match[1], 'type');
    try { if (type.includes('json')) JSON.parse(match[2]); else if (!attr(match[1], 'src') && type !== 'module') new Script(match[2]); }
    catch (error) { issue(file, type.includes('json') ? 'INVALID_JSON' : 'JAVASCRIPT_SYNTAX', error.message); }
  }
  if (html.includes('assets/common.js')) {
    const pricingPosition = html.indexOf('assets/pricing.js');
    const commonPosition = html.indexOf('assets/common.js');
    if (pricingPosition < 0 || pricingPosition > commonPosition) issue(file, 'PRICING_DEPENDENCY', 'Pricing must load before common.js');
  }
  for (const match of html.matchAll(/<div class="zukan-card-shell"[^>]*data-sleeve-id="([^"]+)"[\s\S]*?<p class="zukan-card-price">([\s\S]*?)<\/p>/g)) {
    const item = data.find(item => String(item.id) === match[1]);
    const displayed = decode(match[2]).replace(/<[^>]*>/g, '').trim();
    if (item && displayed !== pricing.yen(pricing.quote(item)?.price)) issue(file, 'CARD_PRICE', `${item.id}: ${displayed}`);
    if (item) cards.push({ file, id: item.id, price: displayed });
  }
  if (/sleeves\/sample-\d+\.html/.test(file) && (!noindex || ad || /new Chart\(/.test(html))) issue(file, 'ACTIVE_SAMPLE', 'Sample must be a retired noindex page without ads or mock graphs');
  pages.push({ file, url: url.href, title, noindex, canonical, ads: ad, sitemap: sitemapSet.has(url.href) });
}
assert.ok(read('robots.txt').includes('Sitemap: https://pokesuri-navi.com/sitemap.xml'));
assert.ok(sitemapSet.has(origin + '/pricing-method.html'));
for (const sleeve of data) assert.ok(sitemapSet.has(origin + '/sleeve/' + route(sleeve.id) + '/'), 'Product page preserved ' + sleeve.id);
const rankHtml = read('ranking.html');
const rankIds = [...rankHtml.matchAll(/data-static-ranking-item\s+data-ranking-rank="(\d+)"\s+data-ranking-id="([^"]+)"/g)].map(match => ({ rank: Number(match[1]), id: match[2] }));
const expectedOrder = data.filter(sleeve => pricing.quote(sleeve)).sort((a, b) => pricing.quote(b).price - pricing.quote(a).price || String(a.id).localeCompare(String(b.id), 'en'));
assert.deepEqual(rankIds.map(item => item.id), expectedOrder.map(sleeve => String(sleeve.id)), 'Shared reference price ranking');
for (const item of rankIds) {
  const html = read('sleeve/' + route(item.id) + '/index.html');
  const position = html.match(/market-position-value">([\d,]+)<small> 位 \/ 852種類/);
  if (!position || Number(position[1].replaceAll(',', '')) !== item.rank) issue('sleeve/' + route(item.id), 'PRICE_RANK', 'Individual rank differs from price ranking');
}
const report = { html_count: pages.length, product_count: data.length, card_prices_checked: cards.length,
  ranked_reference_products: rankIds.length, sitemap_urls: sitemapUrls.length,
  ad_loader_pages: pages.filter(page => page.ads).length, excluded_ad_loaders: pages.filter(page => page.noindex && page.ads).length,
  major_problem_count: problems.length, problems, pages };
fs.mkdirSync(path.join(root, 'reports/site-quality-2026-10-12'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports/site-quality-2026-10-12/html-regression.json'), JSON.stringify(report, null, 2));
if (problems.length) { console.log(JSON.stringify(problems.slice(0, 15), null, 2)); throw Error(problems.length + ' structural quality problems'); }
console.log(`PASS: ${pages.length} HTML files, ${data.length} preserved products, ${cards.length} card prices, ${rankIds.length} consistent ranks; canonical/noindex/sitemap/robots/assets/links/JS/JSON and ad exclusions; 0 major problems.`);
