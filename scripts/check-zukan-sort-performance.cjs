const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'sleeves/index.html'), 'utf8');
const pricing = require('../assets/pricing.js');
const sleeves = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8')).sleeves;
const functionSource = name => {
  const start = html.indexOf('      function ' + name + '(');
  assert.ok(start >= 0, name);
  return html.slice(start, html.indexOf('\n      }', start) + 8);
};
let quoteCalls = 0;
const context = {
  SleevePricing: { quote: sleeve => { quoteCalls++; return pricing.quote(sleeve); } },
  sleeves, toISODate: value => pricing.date(value), numOrNull: value => value == null ? null : Number(value)
};
vm.createContext(context);
vm.runInContext('const cardPriceCache = new WeakMap();\n' +
  ['getCardPrice', 'getReleaseSortTime'].map(functionSource).join('\n') +
  html.slice(html.indexOf('    function getTotalTradeCount('), html.indexOf('    function getDeltaDisplay(')), context);
const sortStart = html.indexOf('        // Calculate expensive sort keys');
const sortSource = html.slice(sortStart, html.indexOf('\n\n        if (!filtered.length)', sortStart));
const expectedPrices = new Map(sleeves.map(s => [s, pricing.quote(s)?.price ?? -1]));
const expectedTrades = s => (s.weeklyPrices || []).reduce((n, r) => n + (Number(r.count) > 0 ? Number(r.count) : 0), 0);
const time = s => {
  const iso = pricing.date(s.releaseDate);
  return iso ? new Date(iso + 'T00:00:00').getTime() : Number.isFinite(Number(s.releaseYear)) ? new Date(s.releaseYear + '-01-01T00:00:00').getTime() : 0;
};
const name = (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''));
const comparators = {
  nameAsc: name,
  releaseDesc: (a, b) => time(b) - time(a) || name(a, b),
  priceAsc: (a, b) => expectedPrices.get(a) - expectedPrices.get(b),
  priceDesc: (a, b) => expectedPrices.get(b) - expectedPrices.get(a),
  tradeCountDesc: (a, b) => expectedTrades(b) - expectedTrades(a) || expectedPrices.get(b) - expectedPrices.get(a)
};
for (const order of ['nameAsc', 'releaseDesc', 'priceAsc', 'priceDesc', 'tradeCountDesc', 'releaseDesc']) {
  context.sortOrder = order;
  context.filtered = sleeves.slice();
  const before = quoteCalls;
  const start = performance.now();
  vm.runInContext('{'+sortSource+'}', context);
  const elapsed = performance.now() - start;
  assert.deepEqual(Array.from(context.filtered, s => s.id), sleeves.slice().sort(comparators[order]).map(s => s.id), order);
  if (order === 'nameAsc' || order === 'releaseDesc') assert.equal(quoteCalls, before, 'Date/name sort must not calculate prices');
  console.log(order + ': ' + elapsed.toFixed(1) + ' ms; ' + (quoteCalls - before) + ' quotes');
}
assert.equal(quoteCalls, sleeves.length, 'Calculate each quote at most once across repeated sorts');
vm.runInContext('getCardPrice(sleeves[0]); getCardPrice(sleeves[0]);', context);
assert.equal(quoteCalls, sleeves.length);
// A sort or page change must not rebuild the filter menus. Clearing a filter must.
let rebuilds = 0, facetScans = 0;
let state = { rawKeyword: '', pokemon: 'ピカチュウ' };
const facetContext = {
  getActiveFilterState: () => state, sleeves: [{}],
  releaseYearSel: {}, seriesSel: {}, pokemonFilterSel: {}, trainerFilterSel: {}, illustratorFilterSel: {},
  uniq: x => x, getSeriesFilterValues: () => [], getPokemonFilterValues: () => [],
  getTrainerFilterValues: () => [], getIllustratorFilterValues: () => [],
  sleeveMatchesFilters: () => { facetScans++; return true; }, replaceFacetOptions: () => rebuilds++
};
vm.createContext(facetContext);
vm.runInContext('const facetOptionsCache = new Map(); let lastFacetStateKey = null;\n' + functionSource('refreshFacetOptions'), facetContext);
const refresh = () => { facetContext.state = state; vm.runInContext('refreshFacetOptions(state)', facetContext); };
refresh(); assert.equal(rebuilds, 5);
refresh(); assert.equal(rebuilds, 5);
state = { rawKeyword: '', pokemon: '' };
refresh(); assert.equal(rebuilds, 10);
refresh(); assert.equal(rebuilds, 10);
const scansBeforeRestore = facetScans;
state = { rawKeyword: '', pokemon: 'ピカチュウ' };
refresh(); assert.equal(rebuilds, 15);
assert.equal(facetScans, scansBeforeRestore, 'Restoring prior filters must not scan the catalog');
assert.ok(html.includes('const renderFromFirstPage = () => {\n        clearTimeout(t);'));
console.log('PASS: catalog sort order, quote reuse, filter clearing and unchanged-filter reuse');

// Exercise the actual card renderer through filter -> sort -> clear cycles.
let cardsCreated = 0;
class Node {
  constructor() { this.children = []; this.dataset = {}; }
  appendChild(node) { this.children.push(node); return node; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute() {}
  set innerHTML(value) { this.html = value; if (value.includes('zukan-card-media')) cardsCreated++; }
}
const list = new Node();
let selected = sleeves;
const renderer = {
  ...context, document: { createElement: () => new Node(), createDocumentFragment: () => new Node(), getElementById: () => null },
  list, sortOrderSel: { value: 'releaseDesc' }, currentPage: 1, PAGE_SIZE: 50,
  getActiveFilterState: () => ({ rawKeyword: '', group: '', tag: '', type: '' }),
  refreshFacetOptions() {}, sleeveMatchesFilters: sleeve => selected.includes(sleeve),
  updatePagination() {}, renderActiveSummary() {},
  window: {}, SleevePricing: pricing, escapeHtml: value => String(value ?? ''),
  getWeeklyPair: pricing.weeklyPair, getDeltaDisplay: () => null,
  buildZukanSparkline: require('../assets/zukan-sparkline.js').build,
  buildSleevesSeoDescription: () => '',
};
vm.createContext(renderer);
vm.runInContext('const cardNodeCache = new WeakMap(); const cardPriceCache = new WeakMap();\n' +
  ['getCardPrice', 'getReleaseSortTime', 'render'].map(functionSource).join('\n') +
  html.slice(html.indexOf('    function getTotalTradeCount('), html.indexOf('    function getDeltaDisplay(')), renderer);
const render = label => {
  const before = cardsCreated, start = performance.now();
  vm.runInContext('render()', renderer);
  console.log(label + ': ' + (performance.now() - start).toFixed(1) + ' ms; ' + (cardsCreated - before) + ' new cards');
};
render('initial');
assert.equal(cardsCreated, 50);
const initialNodes = list.children[0].children.slice();
selected = sleeves.slice(100, 105);
render('filtered');
renderer.sortOrderSel.value = 'priceAsc';
render('sorted');
const beforeClear = cardsCreated;
selected = sleeves;
renderer.sortOrderSel.value = 'releaseDesc';
render('clear');
assert.equal(cardsCreated, beforeClear, 'Clearing must not rebuild previously displayed cards or graphs');
assert.deepEqual(list.children[0].children, initialNodes, 'Reset must restore the same ordered card nodes');
selected = [];
render('empty');
assert.ok(list.html.includes('条件に一致'));
selected = sleeves;
render('clear empty');
assert.equal(cardsCreated, beforeClear);
console.log('PASS: filter/sort/reset/empty rendering reuses cards and restores release order');
