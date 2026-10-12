import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import { replaceContents } from './generate-home-static-content.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pricing = createRequire(import.meta.url)('../assets/pricing.js');
const arg = name => process.argv.indexOf(name) >= 0 ? process.argv[process.argv.indexOf(name) + 1] : null;
const data = JSON.parse(fs.readFileSync(path.resolve(root, arg('--data') || 'data.json'), 'utf8'));
const page = path.resolve(root, arg('--page') || 'index-market.html');
let html = fs.readFileSync(page, 'utf8');
const source = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].find(match => match[2].includes('function buildMarketIndexView'))[2];
const elements = new Map();
const canvas = { innerHTML: '', querySelector: () => null };
const getElement = id => {
  if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', className: '', style: {}, hidden: false,
    querySelector: selector => id === 'indexChart' && selector === '.price-chart-canvas' ? canvas : null, querySelectorAll: () => [] });
  return elements.get(id);
};
const context = createContext({ console, Date, Intl, URL, URLSearchParams,
  window: { matchMedia: () => ({ matches: false }) }, document: { getElementById: getElement, querySelectorAll: () => [] } });
runInContext(fs.readFileSync(path.join(root, 'assets/pricing.js'), 'utf8') + '\n' + source.slice(0, source.lastIndexOf('    main();')), context);
context.sleeves = pricing.sanitizeCatalog(data.sleeves);
runInContext(`
  const staticView = buildMarketIndexView(sleeves, 'week');
  const staticSeries = buildAveragePriceSeries(staticView.entries, staticView.periods, staticView.periodType);
  const staticLatest = staticSeries.at(-1);
  updatePriceSummaryCards(staticSeries);
  renderAiComment(staticLatest.week, buildMarketCommentStats(staticSeries));
  document.getElementById('updatedAt').textContent = formatMetaDate(staticLatest.week);
  document.getElementById('countInfo').textContent = '対象 ' + staticLatest.targetCount + '種類 / 更新 ' + staticLatest.updateCount + '種類';
  document.getElementById('subtitle').textContent = '登録：' + sleeves.length + '件 / 週期間：' + formatPeriodLabel(staticSeries[0].week) + '〜' + formatPeriodLabel(staticLatest.week);
  const staticPair = latestTwoValid(staticSeries, 'avgPrice');
  const staticDiff = staticPair.latest.avgPrice - staticPair.prev.avgPrice;
  document.getElementById('marketStateValue').textContent = staticDiff > 0 ? '上昇中' : staticDiff < 0 ? '下落' : '横ばい';
  document.getElementById('marketStateValue').className = 'market-state-value ' + getTrendClass(staticDiff);
  document.getElementById('marketStateNote').textContent = '全スリーブ平均相場は前回比で' + formatMarketSignedYen(staticDiff) + 'です。';
  renderMarketPriceChart('indexChart', staticSeries);
`, context, { timeout: 10000 });
getElement('indexChart').innerHTML = getElement('indexChart').innerHTML.replace('<div class="price-chart-canvas"></div>', `<div class="price-chart-canvas">${canvas.innerHTML}</div>`);
for (const [id, element] of elements) {
  const content = element.innerHTML || element.textContent;
  if (!content) continue;
  html = replaceContents(html, id, content);
  if (element.className) html = html.replace(new RegExp(`<([\\w-]+)\\b[^>]*\\bid="${id}"[^>]*>`), tag => tag.replace(/class="[^"]*"/, `class="${element.className}"`));
}
fs.writeFileSync(page, html);
if (!canvas.innerHTML.includes('<svg')) throw Error('Static market SVG was not produced');
console.log('Generated static market values, comment and SVG using the browser calculations and shared sanitized catalog.');
