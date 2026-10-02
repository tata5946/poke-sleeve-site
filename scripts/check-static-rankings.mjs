import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(await readFile(path.join(root, 'data.json'), 'utf8'));
const byId = new Map(data.sleeves.map(sleeve => [String(sleeve.id), sleeve]));
const css = await readFile(path.join(root, 'assets/ranking-mobile.css'), 'utf8');
assert.match(css, /@media \(max-width: 700px\)/);
assert.ok(!css.includes('--views'), 'Shared card geometry must apply to every ranking type');
assert.match(css, /body\.ranking-redesign-page #top3,[\s\S]*body\.ranking-redesign-page #restSection \{ display: none !important; \}/, 'Desktop cards must be hidden from the initial mobile render');
function weekly(sleeve, excludeLegacy) {
  const map = new Map();
  for (const row of sleeve.weeklyPrices || []) {
    let week = String(row.week || '').trim();
    if (/^\d{4}$/.test(week)) week += '-01-01';
    else if (/^\d{4}-\d{2}$/.test(week)) week += '-01';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) continue;
    if (excludeLegacy && week.endsWith('-01') && week < '2026-01-01') continue;
    const price = Number(row.price);
    if (Number.isFinite(price) && price > 0) map.set(week, { week, price });
  }
  return [...map.values()].sort((a, b) => a.week.localeCompare(b.week));
}
function attr(tag, name) { return tag.match(new RegExp(name + '="([^"\\n]*)"'))?.[1]; }
const report = [];
for (const [page, type, label] of [['ranking.html','price','前週比'],['surge.html','surge','前回比'],['growth.html','growth','30日前比']]) {
  const html = await readFile(path.join(root, page), 'utf8');
  assert.match(html, /assets\/ranking-mobile\.css/);
  assert.match(html, /assets\/ranking-static\.js/);
  assert.ok(!/loadData|fetch\s*\(|<select\b|applyFilters|function render/.test(html), page + ': no runtime ranking or filters');
  assert.ok(!/確認中|集計中/.test(html), page + ': update/count information must be static');
  const mobile = [...html.matchAll(/<a\b([^>]*)data-ranking-mobile-item([^>]*)>([\s\S]*?)<\/a>/g)].map(match => ({ tag: match[1] + match[2], body: match[3] }));
  const desktop = [...html.matchAll(/<a\b([^>]*)data-static-ranking-item([^>]*)>([\s\S]*?)<\/a>/g)].map(match => ({ tag: match[1] + match[2], body: match[3] }));
  assert.ok(mobile.length > 0);
  const schema = JSON.parse(html.match(/<script id="rankingItemListStructuredData" type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(schema['@type'], 'ItemList');
  assert.equal(schema.numberOfItems, Math.min(50, mobile.length));
  assert.equal(schema.itemListElement.length, schema.numberOfItems);
  assert.equal(schema.itemListElement[0].item.url, 'https://pokesuri-navi.com/sleeve/' + (attr(mobile[0].tag, 'data-ranking-id').length <= 7 ? '4521329' : '') + attr(mobile[0].tag, 'data-ranking-id') + '/');

  assert.equal(mobile.length, desktop.length, page + ': same static ranking on mobile and desktop');
  for (let index = 3; index < mobile.length; index++) assert.equal(desktop[index].body, mobile[index].body, page + ': desktop cards after the podium share mobile content');
  const excludeLegacy = type !== 'price';
  const globalWeek = data.sleeves.flatMap(sleeve => weekly(sleeve, excludeLegacy).slice(-1)).reduce((value, row) => row.week > value ? row.week : value, '');
  const eligible = data.sleeves.filter(sleeve => {
    const rows = weekly(sleeve, excludeLegacy);
    const latest = rows.at(-1);
    if (!latest) return false;
    if (type === 'price') return true;
    if (latest.week !== globalWeek) return false;
    if (type === 'surge') return rows.length >= 2 && latest.price > rows.at(-2).price;
    const target = new Date(Date.parse(latest.week) - 30 * 86400000).toISOString().slice(0, 10);
    return rows.some(row => row.week <= target);
  });
  assert.equal(mobile.length, eligible.length, page + ': all eligible items preserved');
  let previousMetric = Infinity;
  for (const [index, card] of mobile.entries()) {
    const id = attr(card.tag, 'data-ranking-id');
    assert.equal(id, attr(desktop[index].tag, 'data-ranking-id'));
    assert.equal(Number(attr(card.tag, 'data-ranking-rank')), index + 1);
    assert.ok(card.body.includes('ranking-mobile-price') && card.body.includes('sleeve-sparkline'), 'Static prices and graphs');
    const decodedLabel = card.body.replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)));
    assert.ok(decodedLabel.includes('<small>' + label + '</small>'), page + ': correct comparison label');
    const rows = weekly(byId.get(id), excludeLegacy);
    const latest = rows.at(-1);
    assert.equal(Number(attr(card.tag, 'data-ranking-current')), latest.price, page + ': latest static price');
    let metric = latest.price;
    if (type === 'surge') metric = latest.price - rows.at(-2).price;
    if (type === 'growth') {
      const target = new Date(Date.parse(latest.week) - 30 * 86400000).toISOString().slice(0, 10);
      const base = rows.filter(row => row.week <= target).at(-1);
      metric = (latest.price - base.price) / base.price * 100;
    }
    assert.ok(metric <= previousMetric + 1e-8, page + ': ranking order must match its metric');
    assert.ok(Math.abs(Number(attr(desktop[index].tag, 'data-ranking-metric')) - metric) < 1e-8, page + ': metric matches source data');
    previousMetric = metric;
  }
  report.push(page + ': ' + mobile.length + ' items');
}
console.log('PASS: shared mobile design; static prices/graphs; all eligible rows; source-data metrics and ordering. ' + report.join(', '));
