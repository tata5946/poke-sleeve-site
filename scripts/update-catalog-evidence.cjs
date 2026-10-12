const fs = require('fs');
const pricing = require('../assets/pricing.js');
const file = process.argv[process.argv.indexOf('--data') + 1] || 'data.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const sleeve of data.sleeves) {
  const labels = [...(sleeve.categories || []), ...(sleeve.categoryTags || []), ...Array.from({ length: 9 }, (_, i) => sleeve['category' + (i + 1)])];
  const counts = [...new Set(labels.flatMap(label => [...String(label || '').normalize('NFKC').matchAll(/(\d+)\s*枚販売/g)].map(match => Number(match[1]))).filter(count => count > 0))];
  const count = pricing.sheetCount(sleeve);
  if (count) {
    sleeve.sheetCount = count;
    sleeve.sheetCountEvidence = counts.length === 1
      ? 'GAS商品マスターの「' + count + '枚販売」カテゴリ'
      : sleeve.sheetCountEvidence || (count === 64 ? 'GASマスター運用：枚数カテゴリの指定なしは64枚（運営者確認）' : 'GAS商品マスターの枚数');
  } else {
    sleeve.sheetCount = null;
    sleeve.sheetCountEvidence = '枚数カテゴリが競合しているため要確認';
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
