import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const template = await readFile(path.join(root, 'detail.html'), 'utf8');
const source = [...template.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
  .find(match => !/\bsrc=/.test(match[1]) && match[2].includes('function buildAiMarketDiagnosis'))[2];
const data = JSON.parse(await readFile(path.join(root, 'data.json'), 'utf8'));
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, { innerHTML: '', querySelector: () => null });
  return elements.get(id);
};
let mobile = false;
const context = createContext({
  console, URL, URLSearchParams, Date, Intl, setTimeout, clearTimeout,
  window: { matchMedia: () => ({ matches: mobile }), addEventListener() {}, common: null },
  document: { getElementById: element, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], baseURI: 'https://pokesuri-navi.com/' },
  location: { href: 'https://pokesuri-navi.com/', search: '', pathname: '/' },
  navigator: {}, localStorage: { getItem: () => null },
  fetch: () => { throw new Error('Chart verification must not request data'); }
});
runInContext(source, context);
function render(points, mode) {
  context.points = points;
  context.mode = mode;
  runInContext('renderPriceAreaChart("weeklyChart", "価格推移", points, mode)', context);
  return element('weeklyChart').innerHTML;
}
const twoPoints = [
  { type: 'weekly', date: '2026-09-21', price: 1800, count: 8 },
  { type: 'weekly', date: '2026-09-28', price: 1777, count: 4 }
];
for (mobile of [false, true]) {
  const chart = render(twoPoints, '3m');
  assert.equal([...chart.matchAll(/class="chart-volume-bar"/g)].length, 2, 'Both endpoints must have volume bars');
  assert.match(chart, />8件<\/text>/);
  assert.match(chart, />4件<\/text>/);
  for (const mode of ['all', 'monthly']) assert.doesNotMatch(render(twoPoints, mode), /chart-volume-bar|\d+件/);
  assert.doesNotMatch(render(twoPoints.map(point => ({ ...point, count: null })), '3m'), /chart-volume-bar|NaN/);
  for (const mode of ['3m', 'all', 'monthly']) {
    context.mode = mode;
    context.point = twoPoints[0];
    runInContext('renderSinglePriceCard("weeklyChart", point, mode)', context);
    if (mode === '3m') assert.match(element('weeklyChart').innerHTML, /8件/);
    else assert.doesNotMatch(element('weeklyChart').innerHTML, /取引件数/);
  }
}
let checked = 0;
for (const sleeve of data.sleeves) {
  context.sleeve = sleeve;
  const points = runInContext('getSeriesForMode(sleeve, "3m")', context);
  if (points.length >= 2) {
    const chart = render(points, '3m');
    const counts = [...chart.matchAll(/data-volume-count="(\d+)"/g)].map(match => Number(match[1]));
    assert.deepEqual(counts, Array.from(points.filter(point => point.count > 0), point => point.count), sleeve.id);
    checked++;
  }
  const id = String(sleeve.id);
  const route = /^\d{6,7}$/.test(id) ? '4521329' + id : id;
  const page = await readFile(path.join(root, 'sleeve', route, 'index.html'), 'utf8');
  for (const [start, end] of [['renderSinglePriceCard', 'getSleeveCategoryTexts'], ['renderPriceAreaChart', 'getSeriesForMode']]) {
    const pattern = new RegExp(`    function ${start}\\([\\s\\S]*?(?=    function ${end}\\()`);
    assert.equal(page.match(pattern)?.[0], template.match(pattern)?.[0], `${id}: chart must match the template`);
  }
}
console.log(`PASS: desktop/mobile weekly bars and counts, two-point and single-point observations, monthly/all exclusion; ${checked} real charts and ${data.sleeves.length} generated pages.`);
