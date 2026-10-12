const fs = require('fs');
const pricing = require('../assets/pricing.js');
function parseCsv(text) {
  const rows = [], current = []; let cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { current.push(cell); cell = ''; }
    else if (c === '\n' && !quoted) { current.push(cell); cell = ''; rows.push(current.splice(0)); }
    else if (c !== '\r' || quoted) cell += c;
  }
  if (cell || current.length) { current.push(cell); rows.push(current); }
  const headers = rows.shift();
  return rows.filter(row => row.length > 1).map(row => Object.fromEntries(headers.map((key, i) => [key, row[i] || ''])));
}
const candidates = parseCsv(fs.readFileSync('reports/site-audit-2026-10-12/outlier-candidates.csv', 'utf8'));
const data = JSON.parse(fs.readFileSync('data.json', 'utf8')).sleeves;
const rows = candidates.map(candidate => {
  const sleeve = data.find(sleeve => String(sleeve.id) === candidate.id);
  const quote = sleeve ? pricing.quote(sleeve) : null;
  const latest = sleeve?.weeklyPrices?.find(row => row.week === candidate.raw_latest_week && row.price === Number(candidate.raw_latest_price) && row.count === Number(candidate.latest_count));
  const previous = sleeve?.weeklyPrices?.find(row => row.week === candidate.previous_week && row.price === Number(candidate.previous_price));
  return { id: candidate.id, name: candidate.name, url: candidate.url,
    recorded_previous_price: candidate.previous_price, recorded_previous_period: candidate.previous_week,
    recorded_latest_price: candidate.raw_latest_price, recorded_latest_period: candidate.raw_latest_week, recorded_count: candidate.latest_count,
    aggregate_matches_original: Boolean(latest && previous), current_reference_price: quote?.price ?? '', current_reference_period: quote?.date || '', current_reference_source: quote?.type || 'none',
    display_notice: sleeve ? pricing.notices(sleeve).join(' / ') : '商品記録が見つかりません',
    aggregate_review: latest && previous ? '原集計の価格・期間・件数を照合済み' : '原監査と異なる記録があるため再確認が必要',
    raw_transaction_review: '未確認（原取引URL・状態・送料・セット内容が集計データにない）' };
});
const keys = Object.keys(rows[0]), quoteCsv = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
fs.writeFileSync('reports/site-quality-2026-10-12/outlier-source-review.csv', '\uFEFF' + keys.map(quoteCsv).join(',') + '\r\n' + rows.map(row => keys.map(key => quoteCsv(row[key])).join(',')).join('\r\n'));
fs.writeFileSync('reports/site-quality-2026-10-12/outlier-review-status.json', JSON.stringify({ reviewed_aggregate_candidates: rows.length,
  matching_original_aggregates: rows.filter(row => row.aggregate_matches_original).length,
  raw_transaction_verification: '未確認。原取引単位の資料が公開JSON・GAS APIに含まれない。',
  action: '集計値は根拠なく削除・変更せず、少数件数・急変の注意を表示。原取引照合を人が実施するため記録を保存。' }, null, 2));
