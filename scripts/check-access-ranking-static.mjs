import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Script, createContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'access-ranking.html'), 'utf8');
const css = await readFile(path.join(root, 'assets/access-ranking-mobile.css'), 'utf8');
const code = await readFile(path.join(root, 'assets/access-ranking.js'), 'utf8');
const snapshot = JSON.parse(html.match(/<script id="accessRankingSnapshot" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.ok(!/mobileSort|access-mobile-sort/.test(html + css + code), 'Sorting must be removed');
assert.ok(!/loadData|fetch\s*\(/.test(code), 'Static ranking must not request data');
assert.ok(!/access-mobile-loading|aria-busy="true"/.test(html + css), 'Initial rendering must not wait for JavaScript');
assert.ok(!css.includes('access-mobile-ready'), 'Old cards must be hidden before JavaScript runs');
assert.match(css, /body\.ranking-redesign-page--views #top3,[\s\S]*body\.ranking-redesign-page--views #restSection \{ display: none !important; \}/);

function decode(text) {
  return text.replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number))).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function cards(attribute) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].filter(match => match[1].includes(attribute)).map(match => ({
    dataset: Object.fromEntries([...match[1].matchAll(/data-([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key.replace(/-([a-z])/g, (_, character) => character.toUpperCase()), decode(value)])),
    hidden: false,
    markup: match[2]
  }));
}
const mobile = cards('data-access-mobile-item');
const desktop = cards('data-static-ranking-item');
assert.equal(mobile.length, snapshot.length, 'Every ranked item must be in the initial mobile HTML');
assert.equal(desktop.length, snapshot.length, 'Desktop and mobile must contain the same ranking');
assert.deepEqual(mobile.map(card => card.dataset.rankingId), desktop.map(card => card.dataset.rankingId));
assert.equal(new Set(mobile.map(card => card.dataset.rankingId)).size, mobile.length, 'No duplicate items');
for (const [index, card] of mobile.entries()) {
  assert.equal(Number(card.dataset.rankingRank), index + 1);
  assert.ok(card.markup.includes('<h3>') && card.markup.includes('access-mobile-price') && card.markup.includes('sleeve-sparkline'), 'Names, prices and graphs must be static');
}
assert.ok(mobile[0].markup.includes('loading="eager"'));

assert.ok(!/<select\b|id="(?:clear|activeFilters|accessRankingEmpty)"/.test(html), 'No filtering controls or empty filter state should remain');
assert.ok(!/applyFilters|querySelectorAll|addEventListener/.test(code), 'Ranking JavaScript must not filter or change static cards');
let navigationCalled = false;
const context = createContext({ window: { common: { setupDashboardChrome: async () => { navigationCalled = true; throw new Error('navigation unavailable'); } } } });
new Script(code, { filename: 'assets/access-ranking.js' }).runInContext(context);
await Promise.resolve();
assert.ok(navigationCalled);
console.log('PASS: ' + mobile.length + ' static mobile/desktop cards, no sorting/filtering or ranking fetch, static graph markup, and navigation failure fallback.');
