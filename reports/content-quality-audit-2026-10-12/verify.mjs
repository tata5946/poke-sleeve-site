import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const out = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(out,'../..');
const read = f => fs.readFileSync(path.join(out,f),'utf8');
const pages = JSON.parse(read('url-audit.json')), summary = JSON.parse(read('summary.json'));
assert.equal(pages.length,1536);
assert.equal(new Set(pages.map(p=>p.url)).size,1536);
assert.deepEqual(summary.classifications,{A:773,B:616,C:147});
assert.equal(pages.filter(p=>p.type==='商品').length,852);
assert.equal(pages.filter(p=>p.type==='カテゴリ').length,615);
assert.equal(pages.filter(p=>p.type==='記事').length,14);
assert.equal(pages.filter(p=>p.ad_loader).length,1107);
for(const page of pages) {
  assert.ok(['A','B','C'].includes(page.classification));
  assert.ok(page.reason&&page.unique_information&&page.own_data_display);
  if(page.classification==='C') {
    assert.ok(page.insufficient_information&&page.improvement,page.url);
    assert.equal(page.ad_loader,false,page.url);
    assert.equal(page.noindex,true,page.url);
    assert.equal(page.in_sitemap,false,page.url);
  }
}
// Parse RFC 4180 quoted cells, including embedded newlines; check Excel exports.
function csv(text) {
  const rows=[],row=[];let cell='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') { if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted; }
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v))rows.push([...row]);row.length=0;cell='';}
    else cell+=c;
  }
  assert.equal(quoted,false);return rows;
}
for(const [file,count] of [['url-audit.csv',1536],['C-priority.csv',147],['article-overlap.csv',91],['duplicate-groups.csv',66]]) {
  const bytes=fs.readFileSync(path.join(out,file));assert.ok(bytes.subarray(0,3).equals(Buffer.from([239,187,191])));
  const rows=csv(bytes.toString('utf8').replace(/^\uFEFF/,''));assert.equal(rows.length,count+1,file);
  assert.ok(rows.every(r=>r.length===rows[0].length),file);
}
const rendering=JSON.parse(read('product-rendering.json'));
assert.equal(rendering.length,852);
assert.ok(rendering.every(r=>r.same_runtime_script&&r.embedded_product_matches));
const browser=JSON.parse(read('browser-evidence.json'));
assert.equal(browser.length,16);assert.ok(browser.every(r=>!r.error&&r.errors.length===0));
const featureCounts={'30th-celebration.html':7,'abyss-eye.html':14,'storm-emerald.html':8,'chaos-rising.html':8,'june-19-restock.html':4};
for(const [file,count] of Object.entries(featureCounts))assert.equal(browser.find(r=>r.file===file).productLinks.length,count);
for(const sample of browser.filter(r=>r.file.startsWith('sleeve/'))) {
  assert.equal(sample.grids.weeklyTable.visible,false);
  assert.equal(sample.grids.weeklyChart.visible,true);
}
const pub=JSON.parse(read('public-snapshot.json'));
assert.equal(pub.length,21);assert.ok(pub.every(r=>r.status===200&&r.static_text_equal));
assert.equal(pub.find(r=>r.file==='data.json').same_as_local,true);
const unchanged=[];
for(const [file,expected] of Object.entries(summary.protected_hashes)) {
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
  if(actual!==expected)unchanged.push(file);
}
assert.deepEqual(unchanged,[]);
for(const match of read('REPORT.md').matchAll(/\]\(([^)]+)\)/g)) {
  if(!/^https?:/.test(match[1]))assert.ok(fs.existsSync(path.join(out,match[1])),match[1]);
}
const result={coverage:{urls:1536,products:852,categories:615,articles:14,ads:1107},classifications:summary.classifications,C_action_coverage:147,C_ads:0,C_indexed:0,CSV_valid:true,public_samples:21,browser_samples:16,rendering_checks:852,site_files_hashed:summary.protected_files,site_changed:unchanged.length,report_links_valid:true};
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
