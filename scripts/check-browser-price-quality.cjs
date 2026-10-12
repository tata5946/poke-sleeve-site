const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const pricing = require('../assets/pricing.js');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'reports/site-quality-2026-10-12');
const profiles = path.join(root, '.tmp_quality_browser');
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
if (!fs.existsSync(edge)) throw Error('Edge not installed');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8')).sleeves;
const items = [
  ['no-price', data.find(s => !pricing.quote(s))],
  ['one-weekly', data.find(s => pricing.observations(s).filter(p => p.type === 'weekly').length === 1)],
  ['many-weekly', data.find(s => s.id === '463513')],
  ['monthly-fallback', data.find(s => s.id === '227610')],
  ['yearly-fallback', data.find(s => pricing.quote(s)?.type === 'yearly')],
  ['stale', data.find(s => pricing.notices(s).some(note => note.includes('直近の取引データが少ない')))],
  ['zero-retail', data.find(s => s.firstPrice === 0)],
  ['price-spike', data.find(s => s.id === '310039')]
].map(([scenario, sleeve]) => ({ scenario, sleeve, route: '/sleeve/' + (/^\d{6,7}$/.test(String(sleeve.id)) ? '4521329' : '') + sleeve.id + '/' }));
items.push({ scenario: 'market', route: '/index-market.html' }, { scenario: 'home', route: '/' }, { scenario: 'zukan', route: '/sleeves/' },
  { scenario: 'year-article', route: '/articles/article-2026-10-03/' }, { scenario: 'collection', route: '/my-collection.html' },
  { scenario: 'empty-template', route: '/detail.html' }, { scenario: 'mobile-pjcs', sleeve: data.find(s => s.id === '463513'), route: '/sleeve/4521329463513/', mobile: true },
  { scenario: 'pokemon-index', route: '/sleeves/pokemon/' }, { scenario: 'trainer-index', route: '/sleeves/trainer/' },
  { scenario: 'series-index', route: '/sleeves/series/' }, { scenario: 'pricing-method', route: '/pricing-method.html' });
items.push({ scenario: 'collection-populated', route: '/my-collection.html?qualitySeed=1' });
items.push({ scenario: 'pricing-method-mobile', route: '/pricing-method.html', mobile: true });
const celebration = data.find(s => s.name === '30th CELEBRATION');
const celebrationRoute = '/sleeve/4521329' + celebration.id + '/';
items.push({ scenario: 'compact-price-hero', route: celebrationRoute, sleeve: celebration },
  { scenario: 'compact-price-hero-mobile', route: celebrationRoute, sleeve: celebration, mobile: true });
items.push({ scenario: 'compact-price-hero-wide', route: celebrationRoute, sleeve: celebration, desktopWidth: 1600 });
const selectedScenario = process.argv.find(arg => arg.startsWith('--scenario='))?.slice('--scenario='.length);
if (selectedScenario) {
  const selected = items.filter(item => item.scenario === selectedScenario);
  if (!selected.length) throw Error('Unknown scenario: ' + selectedScenario);
  items.splice(0, items.length, ...selected);
}
const injection = `<script>window.__qualityErrors=[];window.addEventListener('error',function(e){if(e.message)window.__qualityErrors.push(e.message)});window.addEventListener('unhandledrejection',function(e){window.__qualityErrors.push(String(e.reason))});</script>`;
const capture = `<script>setTimeout(function(){var ids=['latestWeekly','weeklyCount','referenceTradeCount','referencePriceNotes','weeklyUnitPrice','kpiLatestPrice','kpiPrevChange','kpiPrevPct','aiCommentBody','error','collectionAssetTotal','collectionCount','collectionQuantityTotal'];var fields={};ids.forEach(function(id){var el=document.getElementById(id);fields[id]=el?el.textContent.trim():''});var el=document.getElementById('weeklyCount');var script=document.createElement('script');script.id='browserQualitySnapshot';script.type='application/json';script.textContent=JSON.stringify({fields:fields,errors:window.__qualityErrors,hydrated:document.body.dataset.pricingHydrated||document.body.dataset.marketHydrated||'',observationDisplay:el?getComputedStyle(el).display:'missing',ads:document.querySelectorAll('script[src*="pagead2.googlesyndication.com"]').length,svg:document.querySelectorAll('svg').length,marketChartCount:document.querySelectorAll('svg.price-index-chart').length,heroLayout:(function(){var box=document.querySelector('.kpi'),date=document.getElementById('weeklyCount'),obs=document.getElementById('referenceObservation');return box&&date&&obs?{priceHeight:box.getBoundingClientRect().height,dateHeight:date.getBoundingClientRect().height,dateLineHeight:parseFloat(getComputedStyle(date).lineHeight),observationInsidePrice:box.contains(obs)}:null})(),viewportWidth:innerWidth,pageWidth:document.documentElement.scrollWidth});document.body.appendChild(script)},6000)</script>`;
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
  const extension = path.extname(file);
  let content = fs.readFileSync(file);
  if (extension === '.html') {
    const seed = req.url.includes('qualitySeed=1') ? '<script>localStorage.setItem("pokesuri_my_collection",JSON.stringify([{sleeveId:"463513",quantity:2},{sleeveId:"227610",quantity:1}]));</script>' : '';
    content = content.toString('utf8').replace('<head>', '<head>' + injection + seed).replace('</body>', capture + '</body>');
  }
  res.writeHead(200, { 'Content-Type': (mime[extension] || 'application/octet-stream') + (['.html', '.js', '.css', '.json'].includes(extension) ? '; charset=utf-8' : ''), 'Cache-Control': 'no-store' });
  res.end(content);
});
async function mobileDom(profile, url, scenario) {
  const browser = spawn(edge, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let ws;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  try {
    let debugPort;
    for (let attempt = 0; attempt < 100 && !debugPort; attempt++) {
      try { debugPort = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]); } catch {}
      if (!debugPort) await delay(100);
    }
    if (!debugPort) throw Error('Mobile debugger did not start');
    const targets = await (await fetch('http://127.0.0.1:' + debugPort + '/json')).json();
    const target = targets.find(target => target.type === 'page');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let nextId = 0;
    const pending = new Map();
    ws.onmessage = event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(Error(message.error.message)) : resolve(message.result); } };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(Error('Debugger timeout: ' + method)); } }, 15000).unref();
    });
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Page.navigate', { url });
    let captured = false;
    for (let attempt = 0; attempt < 70 && !captured; attempt++) {
      const result = await send('Runtime.evaluate', { expression: 'Boolean(document.getElementById("browserQualitySnapshot"))', returnByValue: true });
      captured = result.result.value;
      if (!captured) await delay(250);
    }
    if (!captured) throw Error('Mobile DOM capture did not complete');
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(output, scenario + '.png'), Buffer.from(screenshot.data, 'base64'));
    const result = await send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
    await send('Browser.close').catch(() => {});
    return { stdout: result.result.value };
  } finally { ws?.close(); if (browser.exitCode == null) browser.kill(); await delay(300); }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port, results = [];
  fs.mkdirSync(profiles, { recursive: true });
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        const profile = path.join(profiles, item.scenario);
        const screenshot = ['many-weekly', 'mobile-pjcs', 'pricing-method', 'zukan', 'compact-price-hero', 'compact-price-hero-wide'].includes(item.scenario) ? ['--screenshot=' + path.join(output, item.scenario + '.png')] : [];
        fs.mkdirSync(output, { recursive: true });
        const { stdout } = item.mobile ? await mobileDom(profile, `http://127.0.0.1:${port}${item.route}`, item.scenario) : await promisify(execFile)(edge, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--disable-sync', ...screenshot,
          '--user-data-dir=' + profile, '--window-size=' + (item.mobile ? '390,844' : (item.desktopWidth || 1280) + ',900'), '--virtual-time-budget=12000', '--dump-dom', `http://127.0.0.1:${port}${item.route}`], { windowsHide: true, timeout: 60000, maxBuffer: 20 * 1024 * 1024 });
        const raw = stdout.match(/<script id="browserQualitySnapshot" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
        if (!raw) throw Error('Browser capture not produced');
        const snapshot = JSON.parse(raw);
        const failures = [...snapshot.errors];
        if (item.sleeve) {
          const q = pricing.quote(item.sleeve);
          if (snapshot.fields.latestWeekly !== pricing.yen(q?.price)) failures.push('Reference quote differs');
          if (!snapshot.fields.weeklyCount.includes(q?.type === 'weekly' ? q.date.replaceAll('-', '/') : pricing.periodLabel(q))) failures.push('Observation period differs');
          if (!snapshot.fields.referenceTradeCount.includes(q?.count != null ? q.count + '件' : '確認できません')) failures.push('Transaction count differs');
          if (snapshot.fields.weeklyUnitPrice !== pricing.unitPrice(item.sleeve)) failures.push('Unit price differs');
          if (snapshot.hydrated !== '1') failures.push('Detail hydration did not complete');
          if (snapshot.observationDisplay === 'none') failures.push('Observation is hidden by CSS');
          if (!q && snapshot.ads > 0) failures.push('Ads on unpriced product');
        }
        if (item.scenario === 'market' && snapshot.hydrated !== '1') failures.push('Market hydration did not complete');
        if (item.scenario === 'market' && snapshot.marketChartCount !== 1) failures.push('Market chart duplicated');
        if (item.scenario === 'collection-populated') {
          const expected = pricing.quote(data.find(s => s.id === '463513')).price * 2 + pricing.quote(data.find(s => s.id === '227610')).price;
          if (snapshot.fields.collectionAssetTotal.replace(/[^0-9]/g, '') !== String(expected)) failures.push('Collection valuation differs from the shared quotes');
          if (snapshot.fields.collectionCount !== '2種類' || snapshot.fields.collectionQuantityTotal !== '3個') failures.push('Collection quantities changed');
        }
        if (item.scenario === 'empty-template' && snapshot.ads > 0) failures.push('Ads on empty template');
        if (item.scenario === 'zukan' && !stdout.includes('zukan-sparkline-line')) failures.push('Missing catalog SVG graphs');
        if (item.scenario.startsWith('pricing-method') && (!stdout.includes('id="dashboardTopbarSlot"') || !stdout.includes('shared-page-heading-title'))) failures.push('Missing shared dashboard layout');
        if (item.scenario.startsWith('compact-price-hero') && (snapshot.heroLayout.observationInsidePrice || snapshot.heroLayout.priceHeight > 150 || snapshot.heroLayout.dateHeight > snapshot.heroLayout.dateLineHeight + 2)) failures.push('Price hero is too tall or date wraps');
        if (item.mobile && (snapshot.viewportWidth !== 390 || snapshot.pageWidth > 391)) failures.push('Mobile viewport overflow');
        results.push({ scenario: item.scenario, url: item.route, ...snapshot, failures, pass: failures.length === 0 });
        console.log(`${failures.length ? 'FAIL' : 'PASS'} browser ${item.scenario}: ${failures.join('; ')}`);
      } catch (error) { results.push({ scenario: item.scenario, pass: false, failures: [error.message] }); console.log('FAIL browser ' + item.scenario + ': ' + error.message); }
    }
  }
  try { await Promise.all([worker(), worker()]); }
  finally {
    await new Promise(resolve => server.close(resolve));
    // Exact, verified task-owned directory within the workspace, never a computed external target.
    if (path.resolve(profiles) !== path.join(root, '.tmp_quality_browser')) throw Error('Unsafe profile cleanup path');
    fs.rmSync(profiles, { recursive: true, force: true });
  }
  fs.mkdirSync(output, { recursive: true });
  const reportFile = path.join(output, 'browser-regression.json');
  const prior = selectedScenario && fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')).filter(item => item.scenario !== selectedScenario) : [];
  fs.writeFileSync(reportFile, JSON.stringify([...prior, ...results], null, 2));
  if (results.some(result => !result.pass)) process.exitCode = 1;
})();
