const fs = require('fs');
const path = require('path');
const pricing = require('../assets/pricing.js');
const sparkline = require('../assets/zukan-sparkline.js');
const arg = name => process.argv[process.argv.indexOf(name) + 1];
const dataPath = arg('--data');
const output = arg('--out');
if (!dataPath || !output) throw Error('--data and --out are required');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const clean = { ...data, sleeves: pricing.sanitizeCatalog(data.sleeves) };
fs.writeFileSync(output, JSON.stringify(clean));
const ordered = data.sleeves.map(sleeve => ({ sleeve, quote: pricing.quote(sleeve) })).filter(item => item.quote).sort((a,b) => b.quote.price - a.quote.price || String(a.sleeve.id).localeCompare(String(b.sleeve.id), "en"));
const ranks = new Map(ordered.map((item,index) => [String(item.sleeve.id), index+1]));
const facts = { version: pricing.VERSION, items: Object.fromEntries(data.sleeves.map(sleeve => [String(sleeve.id), {
  sparkline: sparkline.build(sleeve), rank: ranks.get(String(sleeve.id)) || null, quote: pricing.quote(sleeve), weeklyPair: (() => { const pair = pricing.weeklyPair(sleeve); return pair ? { latest: pair.latest, prev: pair.prev } : null; })(), firstPrice: pricing.firstPrice(sleeve), sheetCount: pricing.sheetCount(sleeve),
  unitPrice: pricing.unitPrice(sleeve), notices: pricing.notices(sleeve), summary: pricing.summary(sleeve)
}])) };
fs.writeFileSync(path.join(__dirname, '../data/pricing-facts.json'), JSON.stringify(facts, null, 2) + '\n');
