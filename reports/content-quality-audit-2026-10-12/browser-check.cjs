const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');
const { promisify } = require('util');
const out = __dirname, root = path.resolve(out, '../..');
const profiles = path.join(out, '.browser-profiles');
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const cases = ['30th-celebration.html','abyss-eye.html','storm-emerald.html','chaos-rising.html','june-19-restock.html','my-collection.html','article.html','detail.html','404.html','sleeve/4521329463285/index.html','sleeve/4521329100548/index.html','sleeve/4521329310039/index.html','sleeves/pokemon/pokemon-5c6a1e86c141/index.html','ranking.html','index-market.html','articles/premium-gloss/index.html'];
const capture = `<script>setTimeout(function(){var main=document.querySelector('main')||document.body;var gridIds=['newSleeveGrid','restockSleeveGrid','collectionList','weeklyTable','weeklyChart'];var grids={};gridIds.forEach(function(id){var el=document.getElementById(id);if(el)grids[id]={text:el.innerText,display:getComputedStyle(el).display,rectHeight:el.getBoundingClientRect().height,svgCount:el.querySelectorAll('svg').length,visible:el.getClientRects().length>0,links:Array.from(el.querySelectorAll('a[href]')).map(function(a){return a.href})}});var fields={};['latestWeekly','weeklyCount','referenceTradeCount','weeklyUnitPrice','kpiLatestPrice'].forEach(function(id){var el=document.getElementById(id);fields[id]=el?el.innerText:''});var el=document.createElement('script');el.id='auditSnapshot';el.type='application/json';el.textContent=JSON.stringify({text:main.innerText,grids:grids,fields:fields,productLinks:Array.from(new Set(Array.from(main.querySelectorAll('a[href]')).map(function(a){return new URL(a.href).pathname}).filter(function(s){return s.startsWith('/sleeve/')}))),errors:window.__auditErrors,externalFetchesBlocked:window.__auditBlocked});document.body.appendChild(el)},4000);</script>`;
// Audit-only instrumentation in the HTTP response; files remain unchanged.
// Prevent collection synchronization and view-counter POSTs to external services.
const instrumentation = `<script>window.__auditErrors=[];window.__auditBlocked=[];window.addEventListener('error',function(e){window.__auditErrors.push(e.message)});var auditFetch=window.fetch;window.fetch=function(input,opts){var url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin!==location.origin){window.__auditBlocked.push({url:url.origin,method:(opts&&opts.method)||'GET'});return Promise.reject(new Error('External request disabled during read-only audit'))}return auditFetch.apply(this,arguments)};navigator.sendBeacon=function(){return false};</script>`;
const mime = { '.html':'text/html', '.js':'application/javascript', '.json':'application/json', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
const server = http.createServer((req,res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + name + (name.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
  const ext = path.extname(file); let body = fs.readFileSync(file);
  if (ext === '.html') body = body.toString('utf8').replace(/<head(?:\s[^>]*)?>/i, m => m + instrumentation).replace('</body>', capture + '</body>');
  res.writeHead(200, { 'Content-Type': (mime[ext] || 'application/octet-stream') + (['.html','.js','.css','.json'].includes(ext) ? '; charset=utf-8' : ''), 'Cache-Control':'no-store' });
  res.end(body);
});
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const port = server.address().port, results = []; let cursor = 0;
  fs.mkdirSync(profiles,{recursive:true});
  async function worker() {
    while(cursor < cases.length) {
      const file = cases[cursor++], profile = path.join(profiles, file.replaceAll('/','__'));
      const route = '/' + file.replace(/index\.html$/, '');
      try {
        const { stdout } = await promisify(execFile)(edge,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-sync','--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--user-data-dir='+profile,'--window-size=1440,1000','--virtual-time-budget=10000','--dump-dom',`http://127.0.0.1:${port}${route}`],{windowsHide:true,timeout:45000,maxBuffer:25*1024*1024});
        const match = stdout.match(/<script id="auditSnapshot" type="application\/json">([\s\S]*?)<\/script>/);
        if(!match) throw Error('No rendered snapshot');
        const snapshot = JSON.parse(match[1]);
        results.push({file,url:'https://pokesuri-navi.com'+route,...snapshot});
        console.log('READ browser '+file+' products='+snapshot.productLinks.length+' errors='+snapshot.errors.length);
      } catch(error) {results.push({file,error:error.message});console.log('FAILED '+file+': '+error.message);}
    }
  }
  try {await Promise.all([worker(),worker()]);}
  finally {
    await new Promise(resolve=>server.close(resolve));
    if(path.resolve(profiles)!==path.join(out,'.browser-profiles'))throw Error('Unsafe cleanup path');
    fs.rmSync(profiles,{recursive:true,force:true});
  }
  fs.writeFileSync(path.join(out,'browser-evidence.json'),JSON.stringify(results,null,2)+'\n');
  if(results.some(r=>r.error))process.exitCode=1;
})();
