import fs from "node:fs";

const products = "https://www.pokemon-card.com/products/";
const rules = "https://www.pokemon-card.com/assets/document/rules/floor-rule_20260130.pdf";
const anniversary = "https://www.30th.pokemon-card.com/product/goods-01";
const links = (rows) => `<section class="article-sources"><h2>確認した資料</h2><ul>${rows.map(([name,url]) => `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a></li>`).join("")}</ul><p>確認日：2026年10月12日</p></section>`;
const append = (html, body) => `${html.trimEnd()}<hr>${body}`;
const additions = {
  "article-2026-06-15": `<section><h2>この比較で分かること</h2><p>比較対象は、本文の表に掲載したシロナ関連デッキシールド6種類です。発売形態と発売年が異なるため、価格差だけで希少性を断定せず、商品ごとの発売情報と当サイトの観測相場を分けて確認してください。</p><p>掲載価格は当サイトが2026年9月28日までに取得した観測値を記事用に比較したものです。商品状態や取引件数の差を完全にはそろえられないため、購入時は各商品ページの観測週と採用件数も確認してください。</p></section>${links([["ポケモンカードゲーム公式の商品情報",products]])}`,
  "premium-gloss": `<section><h2>通常版との違いを選ぶ基準</h2><p>公式が確認できる違いは、プレミアム・グロスがキラ仕様として案内され、30周年商品では64枚・990円（税込）である点です。通常版の30周年デザインは64枚・889円（税込）です。光沢の好みと101円の価格差で選べますが、プレミアム仕様だけを理由に中古相場が高くなるとは限りません。当サイトではデザイン、販売場所、流通量、商品の状態も合わせて判断します。</p></section>${links([["30周年特別サイト「9月16日発売のデッキシールド」",anniversary]])}`,
  "deck-shield-size": `<section><h2>サイズを選ぶときの回答</h2><p>ポケモンカードを1枚で保護するなら、公式デッキシールドの約66×92mmが基準です。内側にはカード約63×88mmに対応するインナー、公式デッキシールド自体を守るなら66×92mmより大きく「キャラクタースリーブ対応」などと明記されたオーバースリーブを選びます。厚みや溶着幅には製品差があるため、最初に1枚で無理なく入るか確認してください。</p><p>大会では、傷・汚れ・反りなどで特定カードを見分けられる状態が問題になります。参加大会の案内と最新フロアルールを確認し、交換用も用意してください。</p></section>${links([["ポケモンカードゲーム公式の商品情報",products],["競技向けフロアルール ver.1.2（公式PDF）",rules]])}`,
  "deck-shield-storage": `<section><h2>家庭で実行する保管チェック</h2><p>当サイトでは、未開封品の確認項目を「直射日光が当たらない」「高温多湿になりやすい屋根裏・車内・窓際を避ける」「素材表示のあるPP・PE・PETの保護袋を使う」「詰め込みや輪ゴムを避ける」「季節ごとに外袋のべたつき、変色、カビ、反りを確認する」の5点に整理します。</p><p>保存機関の資料は一般的な収蔵品や紙資料を対象にしたもので、ポケモンカード公式が指定した保管条件ではありません。外袋や紙ヘッダーを含む複合製品への応用として扱い、湿度の数値を絶対条件にはしません。</p></section>${links([["米国議会図書館 General Preservation FAQ","https://www.loc.gov/preservation/about/faqs/general.html"],["Canadian Conservation Institute: Storing Works on Paper","https://www.canada.ca/en/conservation-institute/services/conservation-preservation-publications/canadian-conservation-institute-notes/storing-works-paper.html"],["ポケモンカードゲーム公式の商品情報",products]])}`,
  "deck-shield-list-price": `<section><h2>比較条件と読者への回答</h2><p>「昔は380円、現在は889円」というパッケージ価格だけの比較では内容枚数がそろいません。本記事では32枚商品を2個買う前提で64枚相当に換算し、「＋税」の年代は発売時の税率による概算として区別しました。現在まで単純に2.3倍になったという結論ではなく、64枚相当では約760円から889円への変化として読むのが適切です。</p><p>公式資料で確認できる例として、2022年のロコン（アローラのすがた）は64枚・792円（税込）、2026年の通常30周年商品は64枚・889円（税込）、プレミアム・グロスは64枚・990円（税込）です。古い商品の価格・枚数は当サイトの商品台帳を基にし、公式サイトで現存資料を確認できるものから照合しています。</p></section>${links([["公式案内：ロコン（アローラのすがた）","https://www.pokemon-card.com/info/003701.html"],["30周年デッキシールド商品情報",anniversary],["ポケモンカードゲーム公式の商品情報",products]])}`,
  "deck-shield-where-to-buy": `<section><h2>実際の探し方：30th CELEBRATIONの場合</h2><ol><li>公式商品ページで正式名、発売日、希望小売価格、取扱店を確認します。</li><li>現行在庫はポケモンセンター／ポケモンセンターオンラインから確認します。</li><li>中古・フリマでは正式名で検索し、未開封か、64枚そろっているか、外装の傷、送料込み総額を同じ条件で比較します。</li><li>出品中の最高額ではなく、当サイトの商品ページの観測週・採用件数・価格履歴と照らし合わせます。</li></ol><p>新作は定価と正規の取扱先、過去品は状態と総額を分けて判断することが要点です。</p></section>${links([["30周年商品情報（価格・発売日・取扱店）",anniversary],["ポケモンカードゲーム公式の商品情報",products]])}`,
  "2026916307": `<section><h2>発売後の確認（2026年10月12日追補）</h2><p>公式発表の新作は7種類で、いずれも2026年9月16日発売です。内訳はプレミアム・グロス4種類（各990円）と通常版3種類（各889円）です。発売前のデザイン解説は当時の記録として残し、発売後の価格は固定値を追記せず、更新される各商品ページで確認できるようにしました。</p><p><a href="./30th-celebration.html">30th CELEBRATION特集</a>の「新規6件」は、当サイトで個別ページに紐付けた6商品を掲載する範囲です。本記事は公式発表全体を扱うため対象数が異なります。</p></section>${links([["30周年特別サイト「9月16日発売のデッキシールド」",anniversary]])}`,
  "deck-shield-collection-future": `<section><h2>これから集める人の記録手順</h2><ol><li>正式名と商品IDを記録し、同名の再登場品やver.2を別商品として扱います。</li><li>発売日、枚数、発売時価格、販売場所を公式商品情報で確認します。</li><li>未開封・開封済み、外装、欠品の有無を記録し、状態の違う価格を混ぜません。</li><li>購入額と購入日を残し、現在相場とは別の項目で管理します。</li><li>再販・再登場時は旧版を上書きせず、デザイン差と商品仕様を照合します。</li></ol><p>同じ題材の初版・再登場・仕様違いを後から説明できる記録方法です。当サイトのマイコレクションも、保有数、取得額、購入日を現在相場と分けて記録する用途に使えます。Aboutは運営理由、本記事は読者の収集記録を作る方法として役割を分けます。</p></section>${links([["ポケモンカードゲーム公式の商品情報",products],["30周年デッキシールド商品情報",anniversary]])}`
};

const articleData = JSON.parse(fs.readFileSync("articles.json","utf8"));
for (const article of articleData.articles) {
  if (!additions[article.slug]) continue;
  if (article.slug === "article-2026-06-15") {
    article.title = article.title.replace(/歴代5種類/g,"歴代6種類");
    article.html = article.html.replace(/5種類/g,"6種類");
  }
  if (article.slug === "premium-gloss") article.html = article.html.replace(/citeturn292313search3/g,"");
  if (article.slug === "deck-shield-list-price") article.html = article.html.replace(/この価格改定については、原材料費や物流費の高騰などの影響が理由として説明されています。/g,"この記事では、公式商品情報と当サイトの商品台帳で確認できる発売価格の変化を比較しています。価格変更の理由は、確認できた一次資料の範囲を超えて断定しません。");
  if (article.slug === "2026916307") article.html = article.html.replace(/発売後のメルカリ相場については、データ確認後に順次追記予定です。/g,"発売後の参考相場は、各商品の個別ページで観測週・採用件数とともに更新しています。");
  if (!article.html.includes('class="article-sources"')) article.html = append(article.html, additions[article.slug]);
  article.updatedAt = "2026-10-12T00:00:00+09:00";
}
fs.writeFileSync("articles.json",`${JSON.stringify(articleData,null,2)}\n`,`utf8`);

const featureNotes = {
  "30th-celebration.html": [`2026年9月16日発売の30周年関連商品を対象に、当サイトで個別ページを確認できる新規6商品と再掲載1商品をまとめています。公式発表全体は新作7種類ですが、この特集は個別ページとの紐付けが確認できた範囲です。`,`公式発表ではプレミアム・グロス4種類が各990円、通常版3種類が各889円で、すべて64枚入りです。<a href="${anniversary}" target="_blank" rel="noopener noreferrer">公式商品情報</a>（2026年10月12日確認）`],
  "abyss-eye.html": [`拡張パック『アビスアイ』の発売時期に当サイトの商品台帳へ登録した新規・再販デッキシールドを対象にしています。新規と再販を分け、同じ発売日に探したい商品へ移動できるように選定しました。`,`商品名・発売日は当サイトの商品台帳と<a href="${products}" target="_blank" rel="noopener noreferrer">公式商品情報</a>を照合するための入口です（2026年10月12日確認）。価格履歴は各商品詳細で確認できます。`],
  "storm-emerald.html": [`拡張パック『ストームエメラルダ』の発売時期に当サイトの商品台帳へ登録した新規・再販デッキシールドを対象にしています。発売テーマと再販商品を同じ一覧で探せる範囲に限定しました。`,`公式商品情報では『ストームエメラルダ』は2026年7月31日発売です。商品ごとの発売日は詳細リンクから確認できます。<a href="${products}" target="_blank" rel="noopener noreferrer">公式商品情報</a>（2026年10月12日確認）`],
  "chaos-rising.html": [`このページはサイト内で『ニンジャスピナー』発売関連として登録した新規・再販デッキシールドを対象にしています。新規と再販の区分を保ち、商品詳細へ直接移動できるものを選定しました。`,`ページ名と登録テーマの違いを明記し、掲載商品は当サイトの商品台帳の発売日で確認しています。公式情報は<a href="${products}" target="_blank" rel="noopener noreferrer">公式商品情報</a>で再確認できます（2026年10月12日確認）。`],
  "june-19-restock.html": [`2026年6月19日の再販対象として当サイトの商品台帳に登録した4商品をまとめています。新作一覧ではなく、同日に再び探しやすくなった商品への導線として選定しました。`,`掲載するのは商品名・発売日・商品詳細へのリンクです。再販後の価格履歴は固定せず、各商品詳細で観測週と採用件数を確認できます。公式仕様は<a href="${products}" target="_blank" rel="noopener noreferrer">公式商品情報</a>から確認できます（2026年10月12日確認）。`]
};
const catalog = JSON.parse(fs.readFileSync("data.json","utf8"));
const sleeveMap = new Map(catalog.sleeves.map(s => [String(s.id),s]));
const esc = v => String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const route = id => /^\d{6,7}$/.test(id) ? `4521329${id}` : id;
for (const [file,[scope,fact]] of Object.entries(featureNotes)) {
  let html = fs.readFileSync(file,"utf8");
  const groups = new Map([...html.matchAll(/const (NEW|RESTOCK)_SLEEVE_ITEMS = (\[[\s\S]*?\n\s*\]);/g)].map(m => [m[1],Function(`return ${m[2]}`)()]));
  html = html.replace(/(?:\s*<p class="abyss-copy">[\s\S]*?<\/p>)+/,`\n                <p class="abyss-copy">${scope}</p><p class="abyss-copy">${fact}</p>`);
  html = html.replace(/<div id="(new|restock)SleeveGrid" class="abyss-grid">[\s\S]*?<\/div>\s*<\/section>/g,(all,kind) => {
    const cards=(groups.get(kind.toUpperCase())||[]).map(([id,fallback,imageFallback]) => { const s=sleeveMap.get(String(id)); const name=s?.name||fallback||id; const date=String(s?.releaseDate||"").replace(/^(\d{4})-(\d{2})-(\d{2})$/,`$1/$2/$3発売`); const image=s?.imageUrl||imageFallback||""; return `<a class="abyss-card" data-static-feature-card="1" href="./sleeve/${esc(route(String(id)))}/"><div class="abyss-thumb">${image?`<img src="${esc(image)}" alt="${esc(name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:""}</div><p class="abyss-name">${esc(name)}</p><p class="abyss-meta">${esc(date||"発売日未登録")}</p><span class="abyss-tag">商品詳細を見る</span></a>`; }).join("\n                ");
    return `<div id="${kind}SleeveGrid" class="abyss-grid" data-static-feature-list="1">\n                ${cards}\n              </div>\n            </section>`;
  });
  fs.writeFileSync(file,html,"utf8");
}

const noAdCategories = [
  "sleeves/pokemon/pokemon-0113fff86d55/index.html", "sleeves/pokemon/pokemon-dd2e45e9d79f/index.html",
  "sleeves/pokemon/pokemon-05fa8df038bd/index.html", "sleeves/pokemon/pokemon-959393a7f672/index.html",
  "sleeves/pokemon/pokemon-6c69d9d1b279/index.html", "sleeves/pokemon/pokemon-96506f915a8a/index.html",
  "sleeves/pokemon/pokemon-b47b6b0737d6/index.html", "sleeves/pokemon/pokemon-e5a8a14c5bfd/index.html",
  "sleeves/pokemon/pokemon-e74f10afac65/index.html", "sleeves/pokemon/pokemon-e80d68640d3c/index.html",
  "sleeves/trainer/trainer-8820c2e9e267/index.html"
];
for (const file of noAdCategories) {
  const html = fs.readFileSync(file,"utf8").replace(/\s*<script\s+async\s+src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=[^"]+"\s+crossorigin="anonymous"><\/script>/i,"");
  fs.writeFileSync(file,html,"utf8");
}
console.log("Updated 8 articles and 5 feature pages.");
