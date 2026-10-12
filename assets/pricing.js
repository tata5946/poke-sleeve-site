/* Shared by the browser and offline generators. Raw GAS records are retained. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SleevePricing = api;
})(globalThis, function () {
  'use strict';
  const VERSION = 'quality-20261012-v1';
  const number = value => value == null || String(value).trim() === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  const round = value => Number.isFinite(value) ? Math.round(value) : null;
  const yen = value => Number.isFinite(value) && value > 0 ? Math.round(value).toLocaleString('ja-JP') + '円' : '-';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function date(value) {
    const raw = String(value ?? '').trim();
    const iso = /^\d{4}$/.test(raw) ? raw + '-01-01' : /^\d{4}-\d{2}$/.test(raw) ? raw + '-01' : raw.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const timestamp = Date.parse(iso + 'T00:00:00Z');
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === iso ? iso : '';
  }
  function beforeRelease(value, sleeve, kind) {
    const observed = date(value);
    const release = date(sleeve?.releaseDate) || date(sleeve?.releaseYear);
    if (!observed || !release) return false;
    return kind === 'yearly' ? observed.slice(0, 4) < release.slice(0, 4)
      : kind === 'monthly' ? observed.slice(0, 7) < release.slice(0, 7) : observed < release;
  }
  function periodKind(value) {
    const observed = date(value);
    if (!observed) return 'unknown';
    // Legacy monthly records were stored in weeklyPrices before the 2026 weekly series.
    return observed.endsWith('-01') && observed < '2026-01-01' ? 'month' : 'week';
  }
  function sanitizeSleeve(sleeve) {
    const clean = { ...sleeve };
    for (const [field, key, kind] of [['weeklyPrices', 'week', 'weekly'], ['monthlyPrices', 'month', 'monthly'], ['yearlyPrices', 'year', 'yearly']]) {
      clean[field] = (Array.isArray(sleeve?.[field]) ? sleeve[field] : []).filter(row => {
        const legacyMonth = kind === 'weekly' && periodKind(row.week) === 'month';
        return !(number(row.price) > 0 && beforeRelease(row[key], sleeve, legacyMonth ? 'monthly' : kind));
      }).map(row => kind === 'weekly' && number(row.count) === 0 && number(row.price) > 0 ? { ...row, price: null } : { ...row });
    }
    clean.pricesByYear = Object.fromEntries(Object.entries(sleeve?.pricesByYear || {}).filter(([year, price]) => !(number(price) > 0 && beforeRelease(year, sleeve, 'yearly'))));
    return clean;
  }
  const sanitizeCatalog = sleeves => (Array.isArray(sleeves) ? sleeves : []).map(sanitizeSleeve);
  function observations(sleeve) {
    const clean = sanitizeSleeve(sleeve), rows = [];
    for (const [field, key, type] of [['weeklyPrices', 'week', 'weekly'], ['monthlyPrices', 'month', 'monthly'], ['yearlyPrices', 'year', 'yearly']]) {
      for (const row of clean[field]) {
        const observed = date(row[key]), price = number(row.price), count = number(row.count);
        if (!observed || !(price > 0)) continue;
        const legacy = type === 'weekly' && periodKind(observed) === 'month';
        rows.push({ date: observed, type: legacy ? 'monthly' : type, rawPrice: price, price: round(price), count: count > 0 ? Math.round(count) : null });
      }
    }
    for (const [year, value] of Object.entries(clean.pricesByYear)) {
      const price = number(value);
      if (price > 0 && date(year)) rows.push({ date: date(year), type: 'yearly', rawPrice: price, price: round(price), count: null });
    }
    const priorities = { yearly: 0, monthly: 1, weekly: 2 };
    return rows.sort((a, b) => a.date.localeCompare(b.date) || priorities[a.type] - priorities[b.type]);
  }
  function quote(sleeve) {
    const rows = observations(sleeve);
    for (const type of ['weekly', 'monthly', 'yearly']) {
      const latest = rows.filter(row => row.type === type).at(-1);
      if (latest) return latest;
    }
    return null;
  }
  function chartSeries(sleeve) {
    const rows = observations(sleeve);
    const weekly = rows.filter(row => row.type === 'weekly');
    const monthly = rows.filter(row => row.type === 'monthly' && (!weekly.length || row.date < weekly[0].date));
    const earliest = [...weekly, ...monthly].map(row => row.date).sort()[0];
    const yearly = rows.filter(row => row.type === 'yearly' && (!earliest || row.date.slice(0, 4) < earliest.slice(0, 4)));
    return [...yearly, ...monthly, ...weekly].sort((a, b) => a.date.localeCompare(b.date));
  }
  function weeklyPair(sleeve) {
    const rows = observations(sleeve).filter(row => row.type === 'weekly');
    if (!rows.length) return null;
    const convert = row => row ? { week: row.date, price: row.rawPrice, count: row.count } : null;
    return { latest: convert(rows.at(-1)), prev: convert(rows.at(-2)), sorted: rows.map(convert) };
  }
  function firstPrice(sleeve) {
    const price = number(sleeve?.firstPrice);
    const status = sleeve?.firstPriceStatus;
    const evidence = String(sleeve?.firstPriceEvidence || '').trim();
    if (price > 0) return { status: 'sale', price: round(price), label: yen(price), evidence: evidence || '商品マスターの発売時価格' };
    if (evidence && status === 'free') return { status, price: null, label: '無料配布', evidence };
    if (evidence && status === 'set') return { status, price: null, label: '単品定価なし', evidence };
    return { status: 'unknown', price: null, label: '価格不明', evidence: '' };
  }
  function sheetCount(sleeve) {
    const count = number(sleeve?.sheetCount);
    return Number.isInteger(count) && count > 0 && sleeve?.sheetCountEvidence ? count : null;
  }
  const unitPrice = sleeve => { const value = quote(sleeve), count = sheetCount(sleeve); return value && count ? yen(value.price / count) : '-'; };
  function periodLabel(value) {
    if (!value) return '-';
    const [year, month, day] = value.date.split('-').map(Number);
    return value.type === 'yearly' ? year + '年' : value.type === 'monthly' ? year + '年' + month + '月' : year + '年' + month + '月' + day + '日';
  }
  function notices(sleeve, today = new Date().toISOString().slice(0, 10)) {
    const value = quote(sleeve);
    if (!value) return ['現在、参考相場を算出できるデータがありません'];
    const notes = [];
    if (value.type !== 'weekly') notes.push(value.type === 'monthly' ? '月次データから算出' : '年次データから算出');
    if (value.count === 1) notes.push('取引件数が少ないため参考値');
    const days = (Date.parse(today) - Date.parse(value.date)) / 86400000;
    if (days >= 90) notes.push('直近の取引データが少ない商品');
    const weekly = observations(sleeve).filter(row => row.type === 'weekly');
    if (weekly.length > 0 && weekly.length <= 3) notes.push('観測データが少ないため、価格変動の判断には注意が必要です');
    const prev = weekly.at(-2);
    if (value.type === 'weekly' && prev && value.rawPrice / prev.rawPrice >= 2 && value.count != null && value.count <= 2) notes.push('少数取引で価格が大きく変動しています。元取引の確認が必要な参考値です');
    return notes;
  }
  function observationHtml(sleeve, today) {
    const value = quote(sleeve);
    const label = value?.type === 'weekly' ? '最終観測週' : '最終観測期間';
    return `<div class="reference-observation" data-reference-source="${value?.type || 'none'}">
      <div id="weeklyCount">${label}：${escape(periodLabel(value))}</div>
      <div id="referenceTradeCount">採用取引件数：${value?.count != null ? value.count + '件' : '確認できません'}</div>
      <div id="referencePriceNotes">${notices(sleeve, today).map(note => `<p>${escape(note)}</p>`).join('')}</div>
      <a href="/pricing-method.html">相場データの見方・算出方法</a>
    </div>`;
  }
  function summary(sleeve) {
    const value = quote(sleeve);
    return value ? `${value.type === 'weekly' ? '最終観測週' : '観測期間'} ${periodLabel(value)} / ${value.count != null ? value.count + '件' : '件数未確認'}${value.type === 'weekly' ? '' : '（' + (value.type === 'monthly' ? '月次' : '年次') + '補完）'}` : '参考相場を算出できるデータがありません';
  }
  return { VERSION, number, round, yen, date, beforeRelease, periodKind, sanitizeSleeve, sanitizeCatalog, observations, chartSeries, weeklyPair, quote, firstPrice, sheetCount, unitPrice, periodLabel, notices, observationHtml, summary };
});
