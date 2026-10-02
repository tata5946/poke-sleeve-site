import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Script, createContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'access-ranking.html'), 'utf8');
const css = await readFile(path.join(root, 'assets/access-ranking-mobile.css'), 'utf8');
assert.ok(!css.includes('access-mobile-ready'), 'Old cards must be hidden without waiting for JavaScript');
assert.match(css, /@media \(max-width: 700px\)[\s\S]*body\.ranking-redesign-page--views #top3,[\s\S]*body\.ranking-redesign-page--views #restSection \{ display: none !important; \}/);
assert.match(html, /id="accessMobileList"[^>]*aria-busy="true">\s*<p class="access-mobile-loading" role="status">/);
const code = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(text => text.includes('function renderMobileRanking'));
assert.ok(code, 'Page script must be present');
const script = new Script(code.replace(/main\(\);\s*$/, ''), { filename: 'access-ranking.html' });
const elements = new Map();
for (const id of ['accessMobileList', 'error', 'mobileSort', 'clear', 'releaseYear', 'series', 'priceBand', 'activeFilters']) {
  elements.set(id, { value: '', innerHTML: '', style: {}, attributes: {}, classList: { toggle() {} }, setAttribute(key, value) { this.attributes[key] = value; } });
}
const list = elements.get('accessMobileList');
list.innerHTML = 'ランキングを読み込み中…';
list.attributes['aria-busy'] = 'true';
let finishChrome;
const chromeReady = new Promise(resolve => { finishChrome = resolve; });
const context = createContext({
  window: { common: { setupDashboardChrome: () => chromeReady, loadData: async () => { throw new Error('fetch failed'); } } },
  document: { getElementById: id => elements.get(id) },
  console, URL
});
script.runInContext(context);
const pending = context.main();
assert.equal(list.attributes['aria-busy'], 'true', 'Slow setup keeps the loading state');
assert.match(list.innerHTML, /読み込み中/);
finishChrome();
await pending;
assert.equal(list.attributes['aria-busy'], 'false', 'Fetch failures end the loading state');
assert.match(list.innerHTML, /読み込めませんでした/);
assert.match(list.innerHTML, /再読み込み/);
context.window.common.setupDashboardChrome = async () => { throw new Error('chrome failed'); };
await context.main();
assert.match(elements.get('error').textContent, /chrome failed/, 'Chrome setup failures must be handled');
context.renderMobileRanking([]);
assert.equal(list.attributes['aria-busy'], 'false');
assert.match(list.innerHTML, /条件に一致/, 'Successful rendering replaces the loading/error state');
assert.ok(!list.innerHTML.includes('読み込み中'));
console.log('PASS: initial loading markup, unconditional old-card hiding, delayed setup, fetch/setup failures, and completed rendering. Browser rendering is not covered.');
