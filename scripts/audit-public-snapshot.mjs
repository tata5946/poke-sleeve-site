import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'reports/site-audit-2026-10-12');
fs.mkdirSync(output, { recursive: true });
const origin = 'https://pokesuri-navi.com';
const files = ['index.html', 'data.json', 'robots.txt', 'sitemap.xml', 'ads.txt', 'index-market.html', 'sleeves/index.html', 'sleeves/page/2/index.html',
  'sleeve/4521329463513/index.html', 'sleeve/4521329310039/index.html', 'sleeve/4521329227610/index.html',
  'ranking.html', 'growth.html', 'surge.html', 'access-ranking.html', 'articles/article-2026-10-03/index.html',
  'articles/article-2026-06-09/index.html', 'policy.html', 'detail.html', 'sleeves/sample-1.html', 'contact-complete.html'];
const decode = value => String(value ?? '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
const element = (html, id) => decode(html.match(new RegExp(`<([\\w-]+)\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'))?.[2]).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const hash = value => createHash('sha256').update(value).digest('hex');
const results = [];
let cursor = 0;
async function worker() {
  while (cursor < files.length) {
    const file = files[cursor++];
    const url = origin + (file === 'index.html' ? '/' : '/' + file.replace(/index\.html$/, ''));
    const requested = new URL(url);
    requested.searchParams.set('audit', '20261012');
    try {
      const response = await fetch(requested, { headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'PokesuriSiteAudit/1.0' }, signal: AbortSignal.timeout(30000) });
      const html = await response.text();
      const localExists = fs.existsSync(path.join(root, file));
      const local = localExists ? fs.readFileSync(path.join(root, file), 'utf8') : '';
      const clean = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
      let data = null;
      if (file === 'data.json' && response.ok) {
        const parsed = JSON.parse(html);
        data = { count: parsed.sleeves?.length, pjcs: parsed.sleeves?.find(sleeve => String(sleeve.id) === '463513')?.weeklyPrices?.filter(row => row.price > 0).slice(-2) };
      }
      results.push({ url, requested_url: requested.href, file, status: response.status, fetched_at: new Date().toISOString(),
        content_type: response.headers.get('content-type'), cache_control: response.headers.get('cache-control'), age: response.headers.get('age'),
        last_modified: response.headers.get('last-modified'), x_robots_tag: response.headers.get('x-robots-tag'),
        local_exists: localExists, exact_local_match: localExists ? hash(html) === hash(local) : null,
        line_ending_normalized_match: localExists ? hash(html.replace(/\r\n/g, '\n')) === hash(local.replace(/\r\n/g, '\n')) : null,
        sha256: hash(html), bytes: Buffer.byteLength(html), data,
        robots_meta: [...clean.matchAll(/<meta\b[^>]*name=["']robots["'][^>]*>/gi)].map(match => match[0]),
        canonical: clean.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1] || '',
        fields: Object.fromEntries(['latestWeekly', 'weeklyCount', 'updatedAt', 'countInfo', 'kpiLatestPrice', 'aiCommentBody', 'homeSiteIntroSleeveCount'].map(id => [id, element(html, id)])),
        weekly_volume_labels: html.includes('data-volume-count='), observation_element_exists: /\bid="weeklyCount"/.test(clean),
        placeholders_in_initial_html: [...decode(clean.replace(/<[^>]*>/g, ' ')).matchAll(/確認中|集計中|読み込み中|データを集計しています/g)].map(match => match[0]),
        short_text: /\.(txt|xml)$/.test(file) && html.length < 800 ? html : undefined });
    } catch (error) { results.push({ url, file, error: error.message }); }
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
results.sort((a, b) => a.file.localeCompare(b.file));
fs.writeFileSync(path.join(output, 'public-snapshot.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results.map(result => ({ file: result.file, status: result.status, matches_local: result.line_ending_normalized_match, error: result.error, fields: ['index-market.html', 'sleeve/4521329463513/index.html'].includes(result.file) ? result.fields : undefined })), null, 2));
