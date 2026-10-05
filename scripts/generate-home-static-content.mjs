import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createContext, runInContext } from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Replace only the initial HTML element, including nested elements of the same tag.
export function replaceContents(html, id, contents) {
  const opening = new RegExp(`<([a-z][\\w-]*)\\b[^>]*\\bid="${id}"[^>]*>`, 'i').exec(html);
  if (!opening) throw new Error(`Static target missing: ${id}`);
  const start = opening.index + opening[0].length;
  const tags = new RegExp(`</?${opening[1]}\\b[^>]*>`, 'gi');
  tags.lastIndex = start;
  let depth = 1;
  for (let match; (match = tags.exec(html));) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(0, start) + contents + html.slice(match.index);
  }
  throw new Error(`Unclosed static target: ${id}`);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function routeId(id) {
  const value = String(id ?? '').trim();
  return /^\d{6,7}$/.test(value) ? `4521329${value}` : value;
}

function numberOrNull(value) {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function latestWeeklyPrice(sleeve) {
  const rows = Array.isArray(sleeve?.weeklyPrices) ? sleeve.weeklyPrices : [];
  const latest = rows
    .map(row => ({ week: String(row?.week || '').trim(), price: numberOrNull(row?.price) }))
    .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.week) && row.price > 0)
    .sort((a, b) => a.week.localeCompare(b.week))
    .at(-1);
  return latest?.price ?? null;
}

function latestWeeklyDate(sleeves) {
  let latest = '';
  for (const sleeve of Array.isArray(sleeves) ? sleeves : []) {
    for (const row of Array.isArray(sleeve?.weeklyPrices) ? sleeve.weeklyPrices : []) {
      const week = String(row?.week || '').trim();
      const price = numberOrNull(row?.price);
      if (/^\d{4}-\d{2}-\d{2}$/.test(week) && price > 0 && week > latest) latest = week;
    }
  }
  return latest;
}

function yen(value) {
  return Number.isFinite(value) ? `${Math.round(value).toLocaleString('ja-JP')}円` : '—';
}

function buildAllMarketSummaryHtml(sleeves) {
  const items = Array.isArray(sleeves) ? sleeves : [];
  const priced = items
    .map(sleeve => ({ sleeve, price: latestWeeklyPrice(sleeve) }))
    .filter(item => item.price > 0)
    .sort((a, b) => a.price - b.price);
  const prices = priced.map(item => item.price);
  const average = prices.length ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length) : null;
  const middle = Math.floor(prices.length / 2);
  const median = !prices.length ? null : Math.round(prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2);
  const highest = priced.at(-1) || null;
  const aboveRetail = priced.filter(({ sleeve, price }) => {
    const retail = numberOrNull(sleeve?.firstPrice);
    return retail > 0 && price >= retail;
  }).length;
  const rate = items.length ? Math.round((aboveRetail / items.length) * 100) : 0;
  const stat = (label, value, unit, icon, tone) => `
            <div class="category-market-stat">
              <span class="category-market-stat-icon category-market-stat-icon--${escapeHtml(tone)}" aria-hidden="true">${escapeHtml(icon)}</span>
              <span class="category-market-stat-copy">
                <span class="category-market-stat-label">${escapeHtml(label)}</span>
                <strong class="category-market-stat-value">${escapeHtml(value)}${unit ? `<span class="category-market-stat-unit">${escapeHtml(unit)}</span>` : ''}</strong>
              </span>
            </div>`;
  const highestMarkup = highest ? `
          <a class="category-market-highest" href="/sleeve/${escapeHtml(routeId(highest.sleeve.id))}/">
            <span class="category-market-highest-label">♛ 最も高いデッキシールド</span>
            <span class="category-market-highest-divider" aria-hidden="true"></span>
            <span class="category-market-highest-copy"><span class="category-market-highest-kicker">スリーブ名</span><span class="category-market-highest-name">${escapeHtml(highest.sleeve.name || '名称未設定')}</span></span>
            <span class="category-market-highest-price-wrap"><span class="category-market-highest-kicker">現在相場</span><strong class="category-market-highest-price">${escapeHtml(yen(highest.price))}</strong></span>
          </a>` : '';

  return `<section id="categoryMarketSummary" class="category-market-summary" aria-labelledby="categoryMarketSummaryTitle" data-static-market-summary="1">
          <div class="category-market-summary-head">
            <h2 id="categoryMarketSummaryTitle" class="category-market-summary-title"><span class="category-market-title-icon" aria-hidden="true"><i></i><i></i><i></i></span>全デッキシールドのデッキシールド相場</h2>
            <p class="category-market-summary-note">※最新週の取引データをもとに集計<span class="category-market-help" role="img" aria-label="集計方法" title="最新週の取引データをもとに集計しています"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M3.5 3.3a2.5 2.5 0 0 1 5 .2c0 1.5-2.5 1.6-2.5 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="6" cy="9.4" r=".8" fill="currentColor"/></svg></span></p>
          </div>
          <div class="category-market-summary-grid">${stat('掲載数', items.length.toLocaleString('ja-JP'), '種類', '▱', 'count')}${stat('平均相場', yen(average), '', '¥', 'average')}${stat('中央値', yen(median), '', '▥', 'median')}${stat('最高相場', yen(highest?.price), '', '♛', 'highest')}${stat('定価以上', aboveRetail.toLocaleString('ja-JP'), `種類（約${rate}%）`, '↗', 'retail')}
          </div>${highestMarkup}
        </section>`;
}

function jsonScript(html, id, value) {
  const markup = `<script id="${id}" type="application/json">${JSON.stringify(value).replaceAll('<', '\\u003c')}</script>`;
  const existing = new RegExp(`<script id="${id}"[^>]*>[\\s\\S]*?</script>`);
  return existing.test(html) ? html.replace(existing, () => markup) : html.replace('</head>', markup + '\n</head>');
}

function element() {
  const styles = {};
  return { innerHTML: '', textContent: '', dataset: {}, styles, style: { setProperty(key, value) { styles[key] = value; } }, querySelector: () => null,
    querySelectorAll: () => [], classList: { add() {}, remove() {} } };
}

export async function generateHomeStatic({ root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dataPath = 'data.json' } = {}) {
  const dataText = await readFile(path.resolve(root, dataPath), 'utf8');
  const data = JSON.parse(dataText);
  const sleeves = data.sleeves;
  if (!Array.isArray(sleeves) || !sleeves.length) throw new Error('Master catalog is empty');
  const ids = sleeves.map(sleeve => String(sleeve.id ?? '').trim());
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new Error('Master IDs must be present and unique');
  const revision = createHash('sha256').update(dataText).digest('hex').slice(0, 12);
  let common = await readFile(path.join(root, 'assets/common.js'), 'utf8');
  const metadata = `/* STATIC_CATALOG_META_START */\nconst SITE_CATALOG_COUNT = ${ids.length};\nconst LOCAL_DATA_URL = "./data.json?v=catalog-${revision}";\nconst CATALOG_CACHE_REVISION = "${revision}";\n/* STATIC_CATALOG_META_END */`;
  if (!common.includes('/* STATIC_CATALOG_META_START */')) throw new Error('Catalog metadata marker missing');
  common = common.replace(/\/\* STATIC_CATALOG_META_START \*\/[\s\S]*?\/\* STATIC_CATALOG_META_END \*\//, () => metadata);

  let html = await readFile(path.join(root, 'index.html'), 'utf8');
  const articles = JSON.parse(await readFile(path.join(root, 'articles.json'), 'utf8')).articles;
  const elements = Object.fromEntries(['homeArticleGrid', 'mobileCategoryDiscovery', 'marketSnapshotCard',
    'marketSentimentCard', 'marketStatsGrid', 'moversTableBody', 'priceTableBody', 'growthTableBody'].map(id => [id, element()]));
  const document = { baseURI: 'https://pokesuri-navi.com/', getElementById: id => elements[id] || null,
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, body: element() };
  const window = { addEventListener() {}, matchMedia: () => ({ matches: false }) };
  const sandbox = { console, URL, URLSearchParams, Date, Intl, setTimeout, clearTimeout, document, window,
    location: { href: document.baseURI, pathname: '/', search: '' }, navigator: {},
    localStorage: { getItem: () => null }, sessionStorage: { getItem: () => null },
    fetch: async () => { throw new Error('Static generation must not access the network'); } };
  const commonContext = createContext({ ...sandbox });
  const mapSource = await readFile(path.join(root, 'assets/category-page-map.js'), 'utf8');
  runInContext(mapSource + '\n' + common.slice(0, common.indexOf('/* ----- Auto-init')), commonContext, { timeout: 10000 });
  const categoryMarkup = runInContext('buildCategoryNavMarkup(globalThis.staticSleeves).listHtml',
    Object.assign(commonContext, { staticSleeves: sleeves }), { timeout: 10000 });
  const sidebar = runInContext('buildDashboardSidebarHtml("index")', commonContext);
  const sidebarWithCategories = sidebar.replace(/(<div class="category-nav-list">)[\s\S]*?(<\/div>\s*<\/aside>)/,
    (_, start, end) => start + categoryMarkup + end);

  const source = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .find(match => !/\bsrc=|application\//.test(match[1]) && match[2].includes('function renderHomeArticles'))?.[2];
  if (!source || !source.includes('    main().catch')) throw new Error('Home rendering functions missing');
  const homeContext = createContext({ ...sandbox, staticSleeves: sleeves, staticArticles: articles });
  runInContext(source.slice(0, source.lastIndexOf('    main().catch')), homeContext, { timeout: 10000 });
  const published = runInContext(`
    const staticArticleMap = new Map();
    [...INITIAL_HOME_ARTICLES.filter(article => article.linkUrl), ...staticArticles].forEach(item => {
      const article = normalizeHomeArticle(item);
      if (article) staticArticleMap.set(article.slug, article);
    });
    globalThis.publishedArticles = [...staticArticleMap.values()].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
    homeArticlesState = publishedArticles;
    renderHomeArticles(publishedArticles);
    renderMobileCategoryDiscovery(staticSleeves);
    publishedArticles;
  `, homeContext, { timeout: 10000 });
  // Reuse the same price/rate rules as the interactive home page.
  const rankingStart = source.indexOf('      const latestWeek = getGlobalLatestTradeWeek(sleeves);', source.indexOf('async function main()'));
  const rankingEnd = source.indexOf('      renderMobileCategoryDiscovery(sleeves);', rankingStart);
  if (rankingStart < 0 || rankingEnd < 0) throw new Error('Home ranking calculations missing');
  runInContext(`{ const sleeves = staticSleeves; ${source.slice(rankingStart, rankingEnd)}
    renderMarketSnapshot(buildHomeMarketIndexSeries(sleeves), sleeves); }`, homeContext, { timeout: 10000 });

  for (const [id, el] of Object.entries(elements)) {
    if (!el.innerHTML) throw new Error(`No static output generated: ${id}`);
    html = replaceContents(html, id, el.innerHTML);
    if (Object.keys(el.styles).length) {
      html = html.replace(new RegExp(`<[^>]*\\bid="${id}"[^>]*>`), tag => {
        const values = Object.entries(el.styles).map(([key, value]) => `${key}:${value};`).join('');
        return /style="/.test(tag) ? tag.replace(/style="[^"]*"/, `style="${values}"`) : tag.replace('>', ` style="${values}">`);
      });
    }
    html = html.replace(new RegExp(`(id="${id}")`), '$1 data-static-home="1"');
    html = html.replaceAll('data-static-home="1" data-static-home="1"', 'data-static-home="1"');
  }
  html = replaceContents(html, 'dashboardSidebarSlot', sidebarWithCategories);
  for (const id of ['homeSiteIntroSleeveCount', 'homeSleeveSearchLeadCount', 'homeSleeveSearchCount']) {
    html = replaceContents(html, id, String(ids.length));
  }
  html = jsonScript(html, 'homeStaticArticles', published);
  html = jsonScript(html, 'homeStaticCategoryNav', categoryMarkup);
  html = html.replace(/assets\/common\.js\?v=[^"\s]+/g, `assets/common.js?v=catalog-${revision}`);
  html = html.replace(/[ \t]+(?=\r?$)/gm, '');
  await writeFile(path.join(root, 'index.html'), html);
  await writeFile(path.join(root, 'assets/common.js'), common);

  let directory = await readFile(path.join(root, 'sleeves/index.html'), 'utf8');
  directory = directory.replace(/【\d+種】/g, `【${ids.length}種】`);
  directory = replaceContents(directory, 'countInfo', ids.length + '件');
  const latestWeek = latestWeeklyDate(sleeves);
  if (latestWeek) {
    directory = replaceContents(directory, 'updatedAt', latestWeek);
    directory = directory.replace(/id="updatedChip" class="zukan-meta-chip(?: is-loading skeleton-shimmer)?"(?: data-static-updated="1")?/, 'id="updatedChip" class="zukan-meta-chip" data-static-updated="1"');
  }
  directory = directory.replace('id="countChip" class="zukan-meta-chip is-loading skeleton-shimmer"', 'id="countChip" class="zukan-meta-chip"');
  directory = directory.replace(
    /<section id="categoryMarketSummary" class="category-market-summary" aria-labelledby="categoryMarketSummaryTitle"[\s\S]*?<\/section>/,
    () => buildAllMarketSummaryHtml(sleeves)
  );
  directory = directory.replace(/assets\/common\.js\?v=[^"\s]+/g, `assets/common.js?v=catalog-${revision}`);
  await writeFile(path.join(root, 'sleeves/index.html'), directory);
  // Generated pages must load this catalog revision instead of an older cached common.js.
  async function updateScriptVersions(directoryPath, recursive = true) {
    const { readdir } = await import('node:fs/promises');
    for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
      const file = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        if (recursive) await updateScriptVersions(file);
      } else if (entry.name.endsWith('.html')) {
        const text = await readFile(file, 'utf8');
        const updated = text.replace(/assets\/common\.js\?v=[^"\s]+/g, `assets/common.js?v=catalog-${revision}`);
        if (updated !== text) await writeFile(file, updated);
      }
    }
  }
  await updateScriptVersions(root, false);
  for (const folder of ['sleeve', 'sleeves', 'articles']) await updateScriptVersions(path.join(root, folder));
  console.log(`Generated home HTML, ${published.length} published articles, category counts/tags, and master count ${ids.length} (revision ${revision}).`);
  return { count: ids.length, revision, articles: published };
}

if (typeof process !== 'undefined' && process.argv?.[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dataIndex = process.argv.indexOf('--data');
  await generateHomeStatic({ dataPath: dataIndex >= 0 ? process.argv[dataIndex + 1] : 'data.json' });
}
