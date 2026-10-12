import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const out = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(out, '../..');
const files = ['index.html','data.json','sleeves/index.html','sleeve/4521329463285/index.html','sleeve/4521329100548/index.html','sleeves/pokemon/pokemon-5c6a1e86c141/index.html','ranking.html','growth.html','surge.html','access-ranking.html','index-market.html','30th-celebration.html','storm-emerald.html','june-19-restock.html','chaos-rising.html','abyss-eye.html','my-collection.html','pricing-method.html','articles/article-2026-10-03/index.html','articles/deck-shield-size/index.html','articles/article-2026-06-09/index.html'];
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const results = [];
let cursor = 0;
fs.mkdirSync(path.join(out, 'public'), { recursive: true });
async function worker() {
  while (cursor < files.length) {
    const file = files[cursor++], pathname = file === 'index.html' ? '/' : '/' + file.replace(/index\.html$/, '');
    const url = 'https://pokesuri-navi.com' + pathname;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(35000) });
      const body = await response.text();
      fs.writeFileSync(path.join(out, 'public', file.replaceAll('/', '__')), body);
      results.push({ file, url, status: response.status, retrieved_at_utc: new Date().toISOString(), final_url: response.url, public_sha256: hash(body), local_sha256: hash(fs.readFileSync(path.join(root, file))), same_as_local: hash(body) === hash(fs.readFileSync(path.join(root, file))), bytes: Buffer.byteLength(body) });
    } catch (error) { results.push({ file, url, error: error.message }); }
  }
}
await Promise.all([worker(),worker(),worker()]);
fs.writeFileSync(path.join(out, 'public-snapshot.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ sampled: results.length, ok: results.filter(r => r.status === 200).length, identical: results.filter(r => r.same_as_local).length, failed: results.filter(r => r.error || r.status !== 200) }));
