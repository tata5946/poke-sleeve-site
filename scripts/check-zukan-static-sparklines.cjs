const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const pricing = require('../assets/pricing.js');
const sparkline = require('../assets/zukan-sparkline.js');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8')).sleeves;
const context = { SleevePricing: pricing };
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/zukan-sparkline.js'), 'utf8'), context);
for (const sleeve of catalog) {
  assert.equal(context.ZukanSparkline.build(sleeve), sparkline.build(sleeve), 'Static/browser SVG differs: ' + sleeve.id);
}
// Strip scripts so the test cannot mistake JavaScript templates for initial HTML.
const initial = fs.readFileSync(path.join(root, 'sleeves/index.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const markers = [...initial.matchAll(/data-static-zukan-card data-sleeve-id="([^"]+)"/g)];
assert.equal(markers.length, 50);
let graphs = 0;
for (let i = 0; i < markers.length; i++) {
  const sleeve = catalog.find(item => String(item.id) === markers[i][1]);
  assert.ok(sleeve);
  const svg = sparkline.build(sleeve);
  const card = initial.slice(markers[i].index, markers[i + 1]?.index ?? initial.indexOf('<!-- STATIC_ZUKAN_CARDS_END', markers[i].index));
  if (svg) {
    assert.ok(card.includes(svg), 'Missing or different initial SVG: ' + sleeve.id);
    graphs++;
  } else {
    assert.ok(!card.includes('class="zukan-sparkline '), 'Unexpected initial SVG: ' + sleeve.id);
  }
}
assert.ok(graphs > 0);
console.log(`PASS: ${markers.length} initial cards, ${graphs} SVG graphs without JavaScript; ${catalog.length} shared static/browser renderers match.`);
