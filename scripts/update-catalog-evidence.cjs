const fs = require('fs');
const file = process.argv[process.argv.indexOf('--data') + 1] || 'data.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const sleeve of data.sleeves) {
  const labels = [...(sleeve.categories || []), ...(sleeve.categoryTags || [])];
  const counts = [...new Set(labels.flatMap(label => [...String(label).matchAll(/(\d+)枚販売/g)].map(match => Number(match[1]))))];
  if (!sleeve.sheetCountEvidence && counts.length === 1) {
    sleeve.sheetCount = counts[0];
    sleeve.sheetCountEvidence = '商品マスターの「' + counts[0] + '枚販売」カテゴリ';
  } else if (!sleeve.sheetCountEvidence) {
    sleeve.sheetCount = null;
    sleeve.sheetCountEvidence = '';
  }
  if (sleeve.firstPrice > 0) {
    sleeve.firstPriceStatus = 'sale';
    sleeve.firstPriceEvidence ||= '商品マスターの発売時価格';
  } else if (!sleeve.firstPriceEvidence) {
    // A zero alone provides no evidence of a free distribution.
    if (/無料配布/.test(sleeve.note || '')) sleeve.firstPriceStatus = 'free';
    else if (/収録|セットに同梱|セット付属/.test(sleeve.note || '')) sleeve.firstPriceStatus = 'set';
    else sleeve.firstPriceStatus = 'unknown';
    sleeve.firstPriceEvidence = sleeve.firstPriceStatus === 'unknown' ? '' : '商品マスター備考：' + sleeve.note;
  }
}
fs.writeFileSync(file, JSON.stringify(data) + '\n');
console.log('Updated evidence-backed retail status and sheet counts for ' + data.sleeves.length + ' products.');
