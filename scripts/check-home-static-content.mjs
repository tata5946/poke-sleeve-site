import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createContext, runInContext, Script } from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFile(path.join(root, file), 'utf8');
const data = JSON.parse(await read('data.json'));
const count = data.sleeves.length;
assert.equal(new Set(data.sleeves.map(sleeve => String(sleeve.id))).size, count);
const html = await read('index.html');
const common = await read('assets/common.js');
const directory = await read('sleeves/index.html');
assert.match(directory, /id="categoryMarketSummary"[^>]*data-static-market-summary="1"/);
assert.match(directory, /category-market-summary-grid/);
const latestWeek = data.sleeves
  .flatMap(sleeve => Array.isArray(sleeve.weeklyPrices) ? sleeve.weeklyPrices : [])
  .map(row => ({ week: String(row?.week || '').trim(), price: Number(row?.price) }))
  .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.week) && row.price > 0)
  .sort((a, b) => a.week.localeCompare(b.week))
  .at(-1)?.week;
assert.ok(latestWeek, 'Latest weekly price date is required for static zukan metadata');
assert.match(directory, new RegExp(`<strong id="updatedAt">${latestWeek}</strong>`));
assert.doesNotMatch(directory, /id="updatedChip" class="zukan-meta-chip is-loading skeleton-shimmer"/);
const snapshot = JSON.parse(html.match(/<script id="homeStaticArticles"[^>]*>([\s\S]*?)<\/script>/)[1]);
const initialBody = html.slice(html.indexOf('<body')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
for (const id of ['homeSiteIntroSleeveCount', 'homeSleeveSearchLeadCount', 'homeSleeveSearchCount']) {
  assert.match(initialBody, new RegExp(`id="${id}"[^>]*>${count}</span>`));
}
assert.match(common, new RegExp(`const SITE_CATALOG_COUNT = ${count};`));
assert.match(common, /DATA_CACHE_KEY = `pokeSleeve:dataCache:v27:\$\{CATALOG_CACHE_REVISION\}`/);
assert.match(directory, new RegExp(`<title>[^<]*【${count}種】</title>`));
assert.match(directory, new RegExp(`<strong id="countInfo">${count}(?:件|&#20214;)</strong>`));
assert.match(directory, new RegExp(`<strong id="resultCountBadge">${count}</strong><span id="resultRangeText">(?:件表示|&#20214;&#34920;&#31034;)</span>`));
assert.ok(!/記事を読み込み中|分類中|選択中: 読み込み中|-- COLLECTIONS/.test(initialBody));
assert.equal((initialBody.match(/class="home-article-card"/g) || []).length, 8);
for (const article of snapshot.slice(0, 8)) assert.ok(initialBody.includes(article.title.replaceAll('&', '&amp;').replaceAll('"', '&quot;')));
for (const id of ['marketSnapshotCard', 'marketSentimentCard', 'marketStatsGrid', 'moversTableBody', 'priceTableBody', 'growthTableBody']) {
  assert.match(initialBody, new RegExp(`id="${id}" data-static-home="1"`));
}
assert.match(initialBody, /<svg class="hero-chart-svg"/);
assert.equal((initialBody.match(/class="movers-row movers-row--ranking"/g) || []).length, 9);
assert.match(html, /if \(el && el.dataset.staticHome !== "1"\)/, 'A failed refresh must preserve static market/ranking output');
assert.match(html, /\.reveal-on-scroll \{\s*opacity: 1;/, 'Static content must remain visible without JavaScript');

for (const [group, fields, label] of [['pokemon', [1, 2, 3], 'ポケモン'], ['trainer', [4, 5, 6], 'トレーナー'], ['series', [7, 8, 9], 'シリーズ']]) {
  const expected = data.sleeves.filter(sleeve => fields.some(field => String(sleeve['category' + field] ?? '').trim())).length;
  assert.ok(initialBody.includes(`data-group="${group}">${label} ${expected}</button>`), group + ': master category count');
}
const tags = new Map();
for (const sleeve of data.sleeves) {
  for (const tag of new Set([1, 2, 3].map(field => String(sleeve['category' + field] ?? '').trim()).filter(Boolean))) {
    tags.set(tag, (tags.get(tag) || 0) + 1);
  }
}
for (const [tag, total] of [...tags].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja')).slice(0, 6)) {
  assert.ok(initialBody.includes(`<span class="mobile-category-chip-name">${tag}</span>`));
  assert.ok(initialBody.includes(`<span class="mobile-category-chip-count">${total}件</span>`));
}
assert.equal((initialBody.match(/<a class="mobile-category-chip/g) || []).length, 6, 'Popular tags must be crawlable without JavaScript');

// A failed article request must keep the current generated articles, rather than old seeds or an empty state.
const source = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].find(match => match[2].includes('function renderHomeArticles'))[2];
const context = createContext({ console, URL, URLSearchParams, document: {
  getElementById: id => id === 'homeStaticArticles' ? { textContent: JSON.stringify(snapshot) } : null,
  querySelectorAll: () => []
}, window: {}, localStorage: { getItem: () => null }, fetch: async () => { throw new Error('offline'); } });
runInContext(source.slice(0, source.lastIndexOf('    main().catch')), context);
const offlineArticles = await runInContext('loadHomeArticles()', context);
assert.deepEqual(JSON.parse(JSON.stringify(offlineArticles)), snapshot);
new Script(common);
const manifest = JSON.parse(await read('data/category-page-manifest.json'));
for (const category of manifest) {
  const page = await read(category.path.replace(/^\//, '') + 'index.html');
  if (category.group === 'pokemon' && category.label === 'ピカチュウ') {
    assert.ok(!/class="category-market-help"/.test(page), category.path + ': no trailing help icon');
  } else {
    assert.match(page, /class="category-market-help" role="img" aria-label="集計方法"/);
  }
  assert.match(page, new RegExp(`<strong id="countInfo">${category.count}(?:件|&#20214;)</strong>`), 'Category result counts remain category-specific');
  assert.match(page, new RegExp(`<strong id="resultCountBadge">${category.count}</strong><span id="resultRangeText">(?:件表示|&#20214;&#34920;&#31034;)</span>`), 'Category list heading count is static');
}
console.log(`PASS: master count ${count}; 8 initial article cards and offline fallback; static market/charts/rankings; category counts, help display, and crawlable tags; ${manifest.length} category result counts.`);
