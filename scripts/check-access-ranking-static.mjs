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

const elements = new Map();
function element() {
  return { hidden: false, value: '', textContent: '', children: [], listeners: {}, classList: { toggle() {} }, setAttribute() {}, appendChild(child) { this.children.push(child); }, replaceChildren() { this.children = []; }, addEventListener(type, callback) { this.listeners[type] = callback; } };
}
for (const id of ['releaseYear', 'series', 'priceBand', 'clear', 'activeFilters', 'countInfo', 'accessRankingEmpty', 'top1', 'top2', 'top3Card', 'top3', 'restSection']) elements.set(id, element());
for (const id of ['releaseYear', 'series', 'priceBand']) {
  const select = elements.get(id);
  const markup = html.match(new RegExp('<select id="' + id + '"[^>]*>([\\s\\S]*?)</select>'))[1];
  select.options = [...markup.matchAll(/<option value="([^"]*)">([\s\S]*?)<\/option>/g)].map(([, value, label]) => ({ value: decode(value), textContent: decode(label) }));
  Object.defineProperty(select, 'selectedIndex', { get() { return this.options.findIndex(option => option.value === this.value); } });
}
for (const [id, items] of Object.entries({ top1: desktop.slice(0, 1), top2: desktop.slice(1, 2), top3Card: desktop.slice(2, 3), top3: desktop.slice(0, 3), restSection: desktop.slice(3) })) elements.get(id).querySelectorAll = () => items;
const document = { getElementById: id => elements.get(id), querySelectorAll: selector => selector === '[data-access-mobile-item]' ? mobile : desktop, createElement: element };
const context = createContext({ document, window: { common: { setupDashboardChrome: async () => { throw new Error('navigation unavailable'); } } } });
new Script(code, { filename: 'assets/access-ranking.js' }).runInContext(context);
await Promise.resolve();
assert.equal(mobile.filter(card => !card.hidden).length, mobile.length, 'Navigation failures must preserve static cards');
const year = elements.get('releaseYear');
year.value = mobile[0].dataset.releaseYear;
year.listeners.change();
const expected = mobile.filter(card => card.dataset.releaseYear === year.value).length;
assert.equal(mobile.filter(card => !card.hidden).length, expected, 'Year filtering uses existing markup');
assert.equal(desktop.filter(card => !card.hidden).length, expected, 'Desktop filters stay synchronized');
assert.equal(elements.get('countInfo').textContent, expected + '件');
assert.equal(elements.get('activeFilters').children.length, 1);
elements.get('activeFilters').children[0].listeners.click();
assert.equal(mobile.filter(card => !card.hidden).length, mobile.length, 'Removing a chip restores cards');
year.value = mobile[0].dataset.releaseYear;
year.listeners.change();
elements.get('clear').listeners.click();
assert.equal(mobile.filter(card => !card.hidden).length, mobile.length, 'Clear restores the static ranking');
const priceBand = elements.get('priceBand');
let unmatched;
for (const yearOption of year.options.filter(option => option.value)) {
  for (const bandOption of priceBand.options.filter(option => option.value)) {
    const [minimum, maximum] = bandOption.value.split('-').map(Number);
    if (!mobile.some(card => card.dataset.releaseYear === yearOption.value && card.dataset.rankingCurrent && Number(card.dataset.rankingCurrent) >= minimum && Number(card.dataset.rankingCurrent) <= maximum)) { unmatched = [yearOption.value, bandOption.value]; break; }
  }
  if (unmatched) break;
}
assert.ok(unmatched, 'Fixture must provide an unmatched filter combination');
[year.value, priceBand.value] = unmatched;
year.listeners.change();
assert.equal(mobile.filter(card => !card.hidden).length, 0);
assert.equal(elements.get('accessRankingEmpty').hidden, false, 'No matches shows the empty state');
elements.get('clear').listeners.click();
assert.equal(elements.get('accessRankingEmpty').hidden, true);
priceBand.value = '0-999';
priceBand.listeners.change();
assert.equal(mobile.filter(card => !card.hidden).length, mobile.filter(card => card.dataset.rankingCurrent && Number(card.dataset.rankingCurrent) <= 999).length, 'Price filtering uses static prices');
elements.get('clear').listeners.click();
console.log('PASS: ' + mobile.length + ' static mobile/desktop cards, no sorting or ranking fetch, static graph markup, filter/chip/reset behavior, and navigation failure fallback.');
