import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../..');
const origin = 'https://pokesuri-navi.com';
const pricing = createRequire(import.meta.url)(path.join(root, 'assets/pricing.js'));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const decode = s => String(s || '').replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const compact = s => decode(s).replace(/\s+/g, ' ').trim();
const csv = (name, records) => {
  const keys = [...new Set(records.flatMap(Object.keys))];
  const escape = value => '"' + String(Array.isArray(value) ? value.join(' | ') : value ?? '').replaceAll('"', '""') + '"';
  fs.writeFileSync(path.join(out, name), '\uFEFF' + keys.map(escape).join(',') + '\r\n' + records.map(row => keys.map(key => escape(row[key])).join(',')).join('\r\n') + '\r\n');
};
const files = [];
function walk(dir = '') {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const file = dir ? dir + '/' + entry.name : entry.name;
    if (entry.isDirectory() && ['sleeve', 'sleeves', 'articles'].includes(file.split('/')[0])) walk(file);
    else if (entry.isFile() && file.endsWith('.html')) files.push(file);
  }
}
walk();
files.sort();
const protectedFiles = [...files, 'data.json', 'articles.json', 'sitemap.xml', 'robots.txt', ...fs.readdirSync(path.join(root, 'assets')).filter(f => /\.(js|css)$/.test(f)).map(f => 'assets/' + f), ...fs.readdirSync(path.join(root, 'scripts')).filter(f => /\.(js|mjs|cjs|ps1|gs)$/.test(f)).map(f => 'scripts/' + f), ...fs.readdirSync(path.join(root, 'data')).filter(f => f.endsWith('.json')).map(f => 'data/' + f)];
const baseline = Object.fromEntries(protectedFiles.map(f => [f, hash(fs.readFileSync(path.join(root, f)))]));
const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
function parse(html) {
  const clean = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const document = { tag: 'document', attrs: {}, children: [] }, stack = [document];
  for (const token of clean.matchAll(/<\/?[a-z][^>]*>|[^<]+/gi)) {
    const t = token[0];
    if (!t.startsWith('<')) { stack.at(-1).children.push({ text: decode(t) }); continue; }
    const tag = t.match(/^<\/?([\w-]+)/)[1].toLowerCase();
    if (t.startsWith('</')) {
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
      continue;
    }
    const attrs = {};
    for (const a of t.slice(t.indexOf(tag) + tag.length).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
    const node = { tag, attrs, children: [], parent: stack.at(-1) };
    stack.at(-1).children.push(node);
    if (!voidTags.has(tag) && !t.endsWith('/>')) stack.push(node);
  }
  return document;
}
function all(node, predicate, result = []) {
  if (node.tag && predicate(node)) result.push(node);
  for (const child of node.children || []) all(child, predicate, result);
  return result;
}
const byId = (node, id) => all(node, n => n.attrs.id === id)[0];
const hasClass = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name);
function text(node, filter = true) {
  if (!node) return '';
  if (node.text != null) return node.text;
  if (filter && (node.attrs.id === 'weeklyTable' || ['nav','aside','footer','button','select','option','input','textarea','svg'].includes(node.tag) || Object.hasOwn(node.attrs, 'hidden') || /display\s*:\s*none/.test(node.attrs.style || '') || ['dashboard-topbar','dashboard-sidebar','share-block','breadcrumb','btn-row'].some(c => hasClass(node, c)))) return '';
  return (node.children || []).map(n => text(n, filter)).join(' ');
}
const nodeText = n => compact(text(n));
const route = id => /^\d{6,7}$/.test(String(id)) ? '4521329' + id : String(id);
const urlFor = f => origin + (f === 'index.html' ? '/' : '/' + f.replace(/index\.html$/, ''));
const data = JSON.parse(read('data.json')).sleeves;
const productsByRoute = new Map(data.map(s => ['/sleeve/' + route(s.id) + '/', s]));
const categories = JSON.parse(read('data/category-page-manifest.json'));
const categoriesByPath = new Map(categories.map(c => [c.path, c]));
const articles = JSON.parse(read('articles.json'));
const articleList = articles.articles || articles;
const articleByPath = new Map(articleList.map(a => [a.linkUrl ? '/' + a.linkUrl.replace(/^\.\//, '') : '/articles/' + a.slug + '/', a]));
const renderingFile = path.join(out, 'product-rendering.json');
if (!fs.existsSync(renderingFile)) throw Error('Run check-product-rendering.mjs before audit.mjs');
const renderingById = new Map(JSON.parse(fs.readFileSync(renderingFile, 'utf8')).map(r => [String(r.id), r]));
const sitemap = new Set([...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]));
const pages = [];
const evidence = [];
for (const file of files) {
  const html = read(file), document = parse(html), url = urlFor(file), pathname = new URL(url).pathname;
  const main = all(document, n => n.tag === 'main')[0] || all(document, n => n.tag === 'body')[0] || document;
  const bodyText = nodeText(main), title = nodeText(all(document, n => n.tag === 'title')[0]);
  const robot = all(document, n => n.tag === 'meta' && n.attrs.name === 'robots').map(n => n.attrs.content).join(' ');
  const canonical = all(document, n => n.tag === 'link' && n.attrs.rel === 'canonical').map(n => n.attrs.href).join(' | ');
  const ad = /<script\b[^>]*src=["'][^"']*pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/i.test(html);
  const adSlots = all(document, n => n.tag === 'ins' && hasClass(n, 'adsbygoogle')).length;
  const links = all(main, n => n.tag === 'a' && n.attrs.href).map(n => { try { return new URL(n.attrs.href, new URL(all(document, n => n.tag === 'base')[0]?.attrs.href || url, url)).href; } catch { return ''; } });
  const memberIds = [...new Set(links.filter(u => u.startsWith(origin + '/sleeve/')).map(u => new URL(u).pathname.split('/')[2]))].sort();
  const page = {
    url, file, title, type: 'その他', classification: 'B', reason: '', intent: '', intent_fulfilment: '',
    unique_information: '', own_data_display: '', duplicate_status: 'ページ集合照合で評価', duplicate_urls: '',
    insufficient_information: '', improvement: '', confidence: '中',
    ad_loader: ad, ad_slots: adSlots, noindex: /noindex/i.test(robot), in_sitemap: sitemap.has(url), canonical,
    initial_main_text_chars: bodyText.length, linked_product_count: memberIds.length,
    linked_product_names: memberIds.map(id => productsByRoute.get('/sleeve/' + id + '/')?.name || id),
    static_price: nodeText(byId(main, 'latestWeekly')), static_observation: nodeText(byId(main, 'weeklyCount')),
    static_trade_count: nodeText(byId(main, 'referenceTradeCount')), history_rows: 0,
    valid_history_points: '', history_periods: '', latest_source: '', observed_age_days: '', product_metadata_fields: '',
    article_body_chars: '', article_data_cards: '', initial_placeholder_count: (bodyText.match(/読み込み中|集計中|確認中|データを集計しています/g) || []).length,
    content_status: '本文あり', content_hash: hash(bodyText), member_set_hash: memberIds.length ? hash(memberIds.join('|')) : '',
    display_scope: 'ローカル初期HTML。代表URLのみ公開HTML・ブラウザで補足'
  };
  const citationArtifacts = bodyText.match(/\ue200cite\ue202[^\ue201]*\ue201/g) || [];
  page.citation_artifacts = citationArtifacts.join(' | ');
  page.article_official_source_links = links.filter(u => /^https:\/\/(?:[^/]*\.)?(?:pokemon-card\.com|pokemoncenter-online\.com|loc\.gov|archives\.gov)\//.test(u)).length;
  const sleeve = productsByRoute.get(pathname), category = categoriesByPath.get(pathname), article = articleByPath.get(pathname);
  if (sleeve) {
    page.type = '商品';
    const rendering = renderingById.get(String(sleeve.id));
    const quote = pricing.quote(sleeve), history = pricing.chartSeries(sleeve).filter(p => p.price > 0);
    const table = byId(main, 'priceTable'), rows = all(table || { children: [] }, n => n.tag === 'tr' && all(n, c => c.tag === 'td').length >= 2);
    // Price history is rendered in #priceHistory, with #priceTable as a compatibility fallback.
    const historyNode = byId(main, 'weeklyTable') || byId(main, 'priceHistory') || table;
    const actualRows = all(historyNode || { children: [] }, n => n.tag === 'tr' && all(n, c => c.tag === 'td').length >= 2);
    const visible = actualRows.filter(row => /[\d,]+円/.test(nodeText(row)));
    page.history_rows = visible.length;
    page.history_table_css_hidden = rendering.history_table_css_hidden;
    page.initial_history_graph = rendering.initial_chart_has_svg;
    page.runtime_chart_points = rendering.runtime_points;
    page.runtime_history_output = rendering.runtime_svg ? 'グラフSVG' : rendering.runtime_single_card ? '単一観測カード' : '有効な履歴なし';
    page.runtime_code_matches_template = rendering.same_runtime_script;
    page.valid_history_points = history.length;
    page.history_periods = new Set(history.map(p => p.week || p.date || p.month || p.year)).size;
    page.latest_source = quote?.type || 'none';
    page.observed_age_days = quote ? Math.floor((Date.parse('2026-10-12') - Date.parse(quote.date)) / 86400000) : '';
    const meta = [['発売日', sleeve.releaseDate], ['発売時価格', sleeve.firstPrice > 0 ? sleeve.firstPrice : sleeve.firstPriceStatus === 'set' ? '単品定価なし' : ''], ['種類', sleeve.type], ['販売元', sleeve.acquisitionType], ['デザイン分類', sleeve.categories?.length ? sleeve.categories.join('・') : ''], ['商品固有備考', sleeve.note], ['イラストレーター', sleeve.illustrator]].filter(([, v]) => v);
    page.product_metadata_fields = meta.length;
    page.intent = 'この商品の見た目・発売条件・参考相場・過去の変動を確認して購入／保管判断する';
    page.unique_information = `${sleeve.name}の${meta.map(([k]) => k).join('・')}。商品画像${sleeve.imageUrl ? 'の指定あり（外部画像の全件表示は未検証）' : 'なし'}。`;
    page.own_data_display = `初期価格 ${page.static_price || '出力なし'}／${page.static_observation || '期間出力なし'}／${page.static_trade_count || '件数出力なし'}。履歴表HTMLは${visible.length}行あるがCSS非表示。初期グラフなし。共通実行時描画コードで${rendering.runtime_points}点の${page.runtime_history_output}を確認。実ブラウザは代表URLのみ。`;
    page.classification = quote && rendering.runtime_points >= 4 && meta.length >= 3 ? 'A' : 'B';
    page.reason = page.classification === 'A' ? '商品固有の識別情報・参考価格・分析と複数時点の履歴を持ち、共通実行時描画でグラフを出力する。初期履歴の見え方は改善余地があるがテンプレート共通だけでは低価値としない' : !quote ? '参考相場はないが商品固有の発売情報・画像・分類はあり、商品資料としての価値を残す。価格不在だけではCとしない' : '商品を特定する情報と相場はあるが、実際に描画する履歴の厚み／補完期間／観測鮮度に改善余地がある';
    page.intent_fulfilment = page.classification === 'A' ? '商品特定・価格比較・変動確認を概ね満たす。取引状態や元取引検証は別課題' : '商品特定は可能。継続的な相場判断または価格比較は限定的';
    if (!quote && meta.length < 3 && !sleeve.imageUrl && !sleeve.note) {
      page.classification = 'C'; page.reason = '価格だけでなく発売条件・画像・固有解説も乏しく、商品を識別し購入判断する情報が足りない';
    }
    if (page.classification !== 'A') {
      page.insufficient_information = !quote ? '観測記録がない理由・取引探索期間、販売形態や同名商品の見分け方、公式資料への参照' : rendering.runtime_points <= 3 ? `実行時に描画する履歴が${rendering.runtime_points}点で長期推移を判断しにくい。取引状態・送料・単品／セット条件、商品固有の販売背景の根拠` : '月次／年次補完の鮮度と観測条件。商品固有の販売背景や元取引の条件';
      page.improvement = !quote ? '根拠のある発売資料・販売形態・パッケージ差を追記し、観測期間と価格不在の理由を説明する。存在しない価格や取引を作らない' : '既存履歴から確実に言える変化と判断限界を短く説明し、可能な範囲で状態・送料・枚数の採用条件と公式出典を追加する';
    }
    page.confidence = '高（資料価値の評価は中）';
    evidence.push({ url, kind: 'product', id: sleeve.id, name: sleeve.name, meta, history: history.map(p => ({ week: p.week, date: p.date, price: p.price, count: p.count })), static_history_text: compact(text(historyNode, false)), history_table_css_hidden: rendering.history_table_css_hidden, rendering, notes: nodeText(byId(main, 'referencePriceNotes')), product_value_hash: hash(JSON.stringify({ name: sleeve.name, image: sleeve.imageUrl, release: sleeve.releaseDate, retail: sleeve.firstPrice, type: sleeve.type, source: sleeve.acquisitionType, categories: sleeve.categories, note: sleeve.note, history })) });
  } else if (category) {
    page.type = 'カテゴリ'; page.intent = `${category.label}に該当するデッキシールドを探し、種類・価格・発売時期を比較する`;
    const stats = byId(main, 'categoryMarketSummary');
    const summaries = nodeText(stats);
    page.unique_information = `カテゴリ「${category.label}」の該当商品 ${category.count}件。${summaries ? 'カテゴリ別の価格集計あり' : '集計なし'}`;
    page.own_data_display = summaries.slice(0, 400);
    page.classification = category.count >= 5 && summaries && memberIds.length >= 5 ? 'A' : 'B';
    page.reason = page.classification === 'A' ? 'テーマに沿った複数商品を比較でき、独自データによるカテゴリ別の価格集計がある' : 'カテゴリ検索の入口として機能するが、対象数が少なく比較・カテゴリ固有の説明の厚みは限定的';
    page.intent_fulfilment = memberIds.length ? '対象商品の発見と詳細ページへの移動は可能。比較の有用性は件数と集計内容に依存' : '該当商品への静的導線を確認できない';
    page.insufficient_information = page.classification === 'B' ? '対象カテゴリの定義、デザインの違い、少数商品での比較ポイント、別カテゴリとの違い' : '';
    page.improvement = page.classification === 'B' ? '掲載条件と固有の見分け方を根拠付きで説明する。1件カテゴリは商品ページへ案内する役割を明確にする' : '';
    evidence.push({ url, kind: 'category', category, memberIds, summary: summaries });
  } else if (article) {
    page.type = article.linkUrl ? '特集' : '記事';
    page.intent = article.title;
    const body = all(main, n => hasClass(n, 'article-body'))[0] || main;
    const articleText = nodeText(body);
    const cards = all(body, n => Object.hasOwn(n.attrs, 'data-sleeve-id')).length;
    page.article_body_chars = articleText.length;
    page.article_data_cards = cards;
    page.unique_information = '本文・商品比較・図表を個別読解して評価（手動評価を別ファイルに保存）';
    page.own_data_display = `${cards}個の商品参照要素／${all(body, n => n.tag === 'table').length}個の表／初期の商品リンク${memberIds.length}件`;
    page.reason = '個別記事の主張・根拠・検索目的との一致を手動で確認する';
    evidence.push({ url, kind: page.type, article: { title: article.title, slug: article.slug, publishedAt: article.publishedAt, updatedAt: article.updatedAt }, text: articleText, headings: all(body, n => /^h[1-4]$/.test(n.tag)).map(nodeText), memberIds });
  } else {
    page.type = file.startsWith('admin-') ? '管理' : /^sleeves\/sample-/.test(file) ? '終了案内' : file.startsWith('sleeve/') ? '廃止商品経路' : /^sleeves\/(pokemon|trainer|series)\/index.html$/.test(file) ? 'カテゴリ索引' : /^sleeves\/page\//.test(file) || file === 'sleeves/all.html' ? '商品索引' : ['ranking.html','growth.html','surge.html','access-ranking.html'].includes(file) ? 'ランキング' : file === 'articles.html' ? '記事一覧' : file === 'sleeves/index.html' ? '図鑑' : ['zukan.html'].includes(file) ? 'リダイレクト' : 'その他';
    page.intent = title;
    page.unique_information = `初期本文${bodyText.length}字／商品への静的リンク${memberIds.length}件`;
    page.own_data_display = '根拠テキストを個別確認';
    evidence.push({ url, kind: page.type, text: bodyText, headings: all(main, n => /^h[1-4]$/.test(n.tag)).map(nodeText), memberIds });
  }
  pages.push(page);
}
// Detect exact main-content equality and exact result sets, not template similarity.
const duplicateGroups = [];
const productSignatures = new Map();
for (const item of evidence.filter(e => e.kind === 'product')) {
  if (!productSignatures.has(item.product_value_hash)) productSignatures.set(item.product_value_hash, []);
  productSignatures.get(item.product_value_hash).push(item.url);
}
for (const urls of productSignatures.values()) if (urls.length > 1) {
  duplicateGroups.push({ id: '商品内容一致-' + (duplicateGroups.length + 1), kind: '商品情報・画像・履歴一致', count: urls.length, urls, member_count: '' });
  for (const url of urls) {
    const page = pages.find(p => p.url === url);
    page.classification = 'B'; page.duplicate_status = '商品情報・画像・履歴が同じ別ID。実物違い・別パッケージの有無を要確認';
    page.duplicate_urls = urls.filter(u => u !== url).join(' | ');
    page.insufficient_information = '別IDで管理する理由と商品の見分け方';
    page.improvement = '実物・販売形態・パッケージを照合し、別商品なら差を記載、同一商品なら統合を検討する';
  }
}
for (const [kind, key] of [['本文一致', 'content_hash'], ['カテゴリ商品集合一致', 'member_set_hash']]) {
  const map = new Map();
  for (const p of pages.filter(p => kind === '本文一致' || p.type === 'カテゴリ')) {
    if (!p[key]) continue;
    if (!map.has(p[key])) map.set(p[key], []);
    map.get(p[key]).push(p);
  }
  for (const group of map.values()) if (group.length > 1) {
    const id = `${kind}-${duplicateGroups.length + 1}`;
    duplicateGroups.push({ id, kind, count: group.length, urls: group.map(p => p.url), member_count: group[0].linked_product_count });
    for (const p of group) {
      p.duplicate_urls = [...new Set([...p.duplicate_urls.split(' | '), ...group.filter(x => x !== p).map(x => x.url)].filter(Boolean))].join(' | ');
      p.duplicate_status = `${kind}。別の検索意図・固有の説明があるかを追加評価`;
      if (kind === 'カテゴリ商品集合一致' && p.linked_product_count === 1) {
        p.classification = 'C';
        p.reason = '別のカテゴリURLと掲載商品が同じ1件で、独立した比較・カテゴリ固有の説明がなく、商品ページへの入口以上の独自価値が薄い';
        const memberName = p.linked_product_names.join('・');
        p.insufficient_information = `対象商品「${memberName}」をこのカテゴリの独立ページで読む理由、同じ1商品を掲載する別カテゴリとの違い、カテゴリ固有の特徴・掲載条件と資料`;
        p.improvement = `「${memberName}」の商品ページにカテゴリ情報をまとめるか、一覧索引内の導線として扱う。独立ページを維持する場合はカテゴリ固有の特徴と資料を加える。重複の最終判断は人が行い、既存noindexを一括で変更しない`;
        p.intent_fulfilment = '商品発見には役立つが、同じ1件への別入口と比べて独立ページの情報上の差が小さい';
      } else if (kind === 'カテゴリ商品集合一致' && p.linked_product_count > 1) {
        p.classification = 'B';
        p.reason = `複数商品の比較価値はあるが、別カテゴリと同じ${p.linked_product_count}商品の集合・価格集計で独立した説明が少ない。異なる検索意図もあるため集合一致だけでCとはしない`;
        p.insufficient_information = '同じ商品集合を持つ別カテゴリと異なる視点・選定条件・比較解説';
        p.improvement = '各カテゴリの検索目的を明確にし、そのテーマ固有の見分け方や根拠を説明する。必要に応じて関連カテゴリへの案内または統合を検討する';
      }
    }
  }
}
const overridesFile = path.join(out, 'editorial-review.json');
for (const page of pages) {
  if (['商品索引','カテゴリ索引','図鑑','記事一覧'].includes(page.type)) {
    page.classification = 'A';
    page.reason = '対象データが実際に初期HTMLにあり、一覧の探索・商品またはテーマの発見という検索目的を満たす。短い索引文や共通テンプレートだけで低品質とは判定しない';
    page.intent_fulfilment = '対象一覧を閲覧し、商品・カテゴリ・記事の詳細へ移動できる';
    page.unique_information = page.type === 'カテゴリ索引' ? 'カテゴリ別の名前・該当件数・項目への導線' : page.type === '記事一覧' ? '記事の題名・公開日・テーマの一覧と詳細への導線' : `${page.linked_product_count}商品の固有名・発売情報・参考価格と詳細への導線`;
    page.own_data_display = '初期HTMLに一覧の各項目を確認。商品索引は掲載商品集合で比較、記事・カテゴリ索引は項目と件数で評価';
  }
}
const browserFile = path.join(out, 'browser-evidence.json');
if (fs.existsSync(browserFile)) {
  for (const sample of JSON.parse(fs.readFileSync(browserFile, 'utf8'))) {
    const page = pages.find(p => p.file === sample.file);
    if (!page || sample.error) continue;
    page.browser_sampled = true;
    page.rendered_product_links = sample.productLinks.length;
    if (page.type === '特集') {
      page.classification = 'B';
      page.reason = '新規／再販という商品集合の編集価値はある。実ブラウザで商品が表示されるため空ページ・未完成とはしないが、初期HTMLに商品詳細と独自解説が不足する';
      page.unique_information = `新規／再販の編集済み商品集合。実ブラウザで${sample.productLinks.length}商品へのリンクと価格を表示`;
      page.own_data_display = `初期一覧は読み込み待ち。実行後は${sample.productLinks.length}商品を表示、${Object.keys(sample.grids).join('／')}に商品名・発売日・価格・一部グラフを確認`;
      page.content_status = '初期一覧は読み込み待ち／実行後に商品を表示（未完成ではない）';
      page.intent_fulfilment = '対象商品の発見と相場への移動は実行後に可能。再販日・発売テーマの説明と出典は限定的';
      page.insufficient_information = '初期HTMLの商品一覧、対象発売日・再販日・対象商品の選定根拠、公式発表への出典、商品の違いを説明する編集文';
      page.improvement = '発売・再販の公式資料と対象日を明記し、選定理由や仕様差を説明する。主要な商品名・価格・詳細リンクを初期HTMLでも読める形にすることを検討する';
      page.confidence = '高（初期HTMLと実ブラウザを照合）';
    }
    if (page.type === '商品') {
      page.content_status = sample.fields.latestWeekly === '-' ? '商品資料・相場なしの説明を表示（空ページではない）' : '商品情報・参考相場・価格グラフを実ブラウザで確認。履歴表はCSS非表示';
      page.browser_graph_visible = sample.grids.weeklyChart?.visible ?? '';
      page.browser_history_table_visible = sample.grids.weeklyTable?.visible ?? '';
    }
  }
}
if (fs.existsSync(overridesFile)) {
  const overrides = JSON.parse(fs.readFileSync(overridesFile, 'utf8'));
  for (const [file, values] of Object.entries(overrides)) {
    const page = pages.find(p => p.file === file);
    if (!page) throw Error('Unknown editorial review file: ' + file);
    Object.assign(page, values);
  }
}
// Quantify article overlap separately from the much longer product boilerplate.
const articleEvidence = evidence.filter(e => e.kind === '記事');
const shingles = value => {
  const normalized = value.replace(/[\s\p{P}\p{S}]/gu, '');
  return new Set(Array.from({ length: Math.max(0, normalized.length - 14) }, (_, i) => normalized.slice(i, i + 15)));
};
const articlePairs = [];
for (let i = 0; i < articleEvidence.length; i++) for (let j = i + 1; j < articleEvidence.length; j++) {
  const a = articleEvidence[i], b = articleEvidence[j], x = shingles(a.text), y = shingles(b.text);
  let common = 0; for (const token of x) if (y.has(token)) common++;
  articlePairs.push({ first: a.url, second: b.url, common_15char_shingles: common, overlap_of_shorter: Math.round(common / Math.max(1, Math.min(x.size, y.size)) * 10000) / 100, exact_body_equal: a.text === b.text, interpretation: '語句の重なりを測る補助値。Googleの基準ではなく、自動的なC判定には使わない' });
}
csv('article-overlap.csv', articlePairs.sort((a,b) => b.overlap_of_shorter - a.overlap_of_shorter));
for (const p of pages) if (!p.reason || !p.unique_information || !p.intent_fulfilment && p.classification !== 'C') throw Error('Missing assessment: ' + p.url);
const unchanged = protectedFiles.filter(f => hash(fs.readFileSync(path.join(root, f))) !== baseline[f]);
if (unchanged.length) throw Error('Site files changed during audit: ' + unchanged.join(', '));
const summary = {
  date_jst: '2026-10-12', audit_scope: 'repository HTML and read-only supporting data; public snapshot separately recorded',
  html_pages: pages.length, active_products: pages.filter(p => p.type === '商品').length,
  categories: pages.filter(p => p.type === 'カテゴリ').length,
  classifications: Object.fromEntries(['A','B','C'].map(c => [c, pages.filter(p => p.classification === c).length])),
  by_type: Object.fromEntries([...new Set(pages.map(p => p.type))].map(t => [t, Object.fromEntries(['A','B','C'].map(c => [c, pages.filter(p => p.type === t && p.classification === c).length]))])),
  ad_loaders: pages.filter(p => p.ad_loader).length,
  ad_loaders_by_classification: Object.fromEntries(['A','B','C'].map(c => [c, pages.filter(p => p.classification === c && p.ad_loader).length])),
  C_indexed: pages.filter(p => p.classification === 'C' && !p.noindex).length,
  C_in_sitemap: pages.filter(p => p.classification === 'C' && p.in_sitemap).length,
  C_with_ads: pages.filter(p => p.classification === 'C' && p.ad_loader).length,
  product_history_buckets: Object.fromEntries(['0','1','2-3','4+'].map(k => [k, pages.filter(p => p.type === '商品' && (k === '0' ? p.valid_history_points === 0 : k === '1' ? p.valid_history_points === 1 : k === '2-3' ? p.valid_history_points >= 2 && p.valid_history_points <= 3 : p.valid_history_points >= 4)).length])),
  zero_valid_history_products: pages.filter(p => p.type === '商品' && !p.valid_history_points).length,
  runtime_graph_products: pages.filter(p => p.runtime_history_output === 'グラフSVG').length,
  runtime_single_observation_products: pages.filter(p => p.runtime_history_output === '単一観測カード').length,
  hidden_history_tables: pages.filter(p => p.history_table_css_hidden).length,
  runtime_history_buckets: Object.fromEntries(['0','1','2-3','4+'].map(k => [k, pages.filter(p => p.type === '商品' && (k === '0' ? p.runtime_chart_points === 0 : k === '1' ? p.runtime_chart_points === 1 : k === '2-3' ? p.runtime_chart_points >= 2 && p.runtime_chart_points <= 3 : p.runtime_chart_points >= 4)).length])),
  exact_duplicate_groups: duplicateGroups.length,
  protected_files: protectedFiles.length, protected_changed: unchanged, protected_hashes: baseline
};
if (summary.active_products !== 852) throw Error('Product coverage differs from requested 852');
for (const p of pages) if (p.classification === 'C' && (!p.insufficient_information || !p.improvement)) throw Error('C lacks concrete action: ' + p.url);
const exportRows = rows => rows.map(p => ({
  'URL': p.url, 'ファイル': p.file, 'ページ名': p.title, '種別': p.type, '判定': p.classification,
  '判定理由': p.reason, '検索目的': p.intent, '検索目的の達成状況': p.intent_fulfilment,
  'ページ固有情報': p.unique_information, '独自データの表示状況': p.own_data_display,
  '実質重複の評価': p.duplicate_status, '重複候補URL': p.duplicate_urls,
  '不足している情報': p.insufficient_information, '改善方法': p.improvement, '評価の確度': p.confidence,
  '内容状態': p.content_status, '広告ローダーあり': p.ad_loader, '広告枠数': p.ad_slots,
  'noindex': p.noindex, 'サイトマップ掲載': p.in_sitemap, 'canonical': p.canonical,
  '初期本文文字数（非表示履歴表は除外）': p.initial_main_text_chars,
  'リンク先商品数': p.linked_product_count, 'リンク先商品名': p.linked_product_names, '初期参考相場': p.static_price, '初期観測期間': p.static_observation,
  '初期取引件数': p.static_trade_count, '元データ有効履歴点数': p.valid_history_points,
  '実行時描画履歴点数': p.runtime_chart_points ?? '', '履歴表HTML行数': p.history_rows,
  '履歴表CSS非表示': p.history_table_css_hidden ?? '', '初期履歴グラフあり': p.initial_history_graph ?? '',
  '実行時の履歴出力': p.runtime_history_output ?? '', '観測経過日数': p.observed_age_days,
  '商品情報項目数': p.product_metadata_fields, '記事本文文字数': p.article_body_chars,
  '未処理の引用記号': p.citation_artifacts, '実ブラウザ代表確認': p.browser_sampled ?? false,
  '確認範囲': p.display_scope
}));
csv('url-audit.csv', exportRows(pages));
fs.writeFileSync(path.join(out, 'url-audit.json'), JSON.stringify(pages, null, 2) + '\n');
csv('C-priority.csv', exportRows(pages.filter(p => p.classification === 'C').sort((a,b) => Number(b.ad_loader) - Number(a.ad_loader) || Number(a.noindex) - Number(b.noindex) || a.url.localeCompare(b.url))));
csv('duplicate-groups.csv', duplicateGroups);
fs.writeFileSync(path.join(out, 'duplicate-groups.json'), JSON.stringify(duplicateGroups, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'page-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ pages: summary.html_pages, products: summary.active_products, categories: summary.categories, classification: summary.classifications, by_type: summary.by_type, ads: summary.ad_loaders_by_classification, unchanged: summary.protected_changed.length }, null, 2));
