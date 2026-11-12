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
let rebuilds = 0;
let state = { rawKeyword: '', pokemon: 'ピカチュウ' };
const facetContext = {
  getActiveFilterState: () => state, sleeves: [],
  releaseYearSel: {}, seriesSel: {}, pokemonFilterSel: {}, trainerFilterSel: {}, illustratorFilterSel: {},
  uniq: x => x, getSeriesFilterValues: () => [], getPokemonFilterValues: () => [],
  getTrainerFilterValues: () => [], getIllustratorFilterValues: () => [],
  sleeveMatchesFilters: () => true, replaceFacetOptions: () => rebuilds++
};
vm.createContext(facetContext);
vm.runInContext('let lastFacetStateKey = null;\n' + functionSource('refreshFacetOptions'), facetContext);
const refresh = () => { facetContext.state = state; vm.runInContext('refreshFacetOptions(state)', facetContext); };
refresh(); assert.equal(rebuilds, 5);
refresh(); assert.equal(rebuilds, 5);
state = { rawKeyword: '', pokemon: '' };
refresh(); assert.equal(rebuilds, 10);
refresh(); assert.equal(rebuilds, 10);
assert.ok(html.includes('const renderFromFirstPage = () => {\n        clearTimeout(t);'));
console.log('PASS: catalog sort order, quote reuse, filter clearing and unchanged-filter reuse');
