/**
 * common.js
 * - header/footer を #site-header / #site-footer に注入
 * - 注入完了時に custom event "site:injected" を発火
 * - setActiveNav(), wireHeaderSearch() を提供
 * - fetchJsonWithTimeout(), loadData() を共通化
 */

/* ----- Config ----- */
const GAS_URL = "https://script.google.com/macros/s/AKfycbxo7yT3rejT_pNMIwYcE_yjbK0AkRBwHC_hHVtGuE6_CLOQpQdAluW6U_SYPnCb-34m/exec";
const GA_MEASUREMENT_ID = "G-FLDX8EB1W8";
const FAVICON_PATH = "./assets/favicon.svg";
const LOCAL_DATA_URL = "./data.json?v=20260713a";
const ARTICLE_DB_NAME = "pokeSleeveArticleStore";
const ARTICLE_DB_VERSION = 1;
const ARTICLE_STORE_NAME = "kv";
const ARTICLE_STORE_KEY = "articles";
const DATA_CACHE_KEY = "pokeSleeve:dataCache:v14";
const DATA_PERSISTENT_CACHE_KEY = "pokeSleeve:dataCache:persist:v14";
const DATA_CACHE_TTL_MS = 5 * 60 * 1000;
const DATA_STALE_MAX_MS = 10 * 60 * 1000;
const LAST_SELECTED_SLEEVE_ID_KEY = "pokeSleeve:lastSelectedId";
const SEARCH_HISTORY_KEY = "pokeSleeve:searchHistory:v1";
const SEARCH_HISTORY_MAX = 8;
const AUTOCOMPLETE_MIN_CHARS = 1;
const AUTOCOMPLETE_MAX_ITEMS = 8;
let __dataCacheMem = null;
let __dataCachePromise = null;
let __sleeveFeedbackWired = false;
let __headerOffsetWired = false;
let __autocompleteIndexPromise = null;

function countUsableSleeves(data) {
  if (!Array.isArray(data?.sleeves)) return 0;
  return data.sleeves.filter((sleeve) => {
    if (!sleeve || typeof sleeve !== "object") return false;
    const id = String(sleeve.id ?? "").trim();
    const name = String(sleeve.name ?? "").trim();
    return !!(id || name);
  }).length;
}

function isUsableDataPayload(data) {
  return countUsableSleeves(data) > 1;
}

function initGoogleAnalytics() {
  if (!GA_MEASUREMENT_ID || typeof document === "undefined") return;
  if (document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"]`)) return;

  const externalScript = document.createElement("script");
  externalScript.async = true;
  externalScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.appendChild(externalScript);

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID);
}

function scheduleAnalyticsInit() {
  const run = () => {
    try { initGoogleAnalytics(); } catch (_) { }
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 2000 });
    return;
  }
  window.addEventListener("load", run, { once: true });
}

scheduleAnalyticsInit();

/* ----- Header / Footer HTML ----- */
const HEADER_HTML = `
<div class="header">
  <div class="header-top">
    <button type="button" class="menu-toggle" id="headerMenuBtn" aria-label="カテゴリーを開く" aria-expanded="false" aria-controls="headerCategoryNav">
      <span class="menu-toggle-bar" aria-hidden="true"></span>
      <span class="menu-toggle-bar" aria-hidden="true"></span>
      <span class="menu-toggle-bar" aria-hidden="true"></span>
    </button>
    <a href="./index.html" class="brand">
      <img class="site-title-logo site-title-logo--header" src="./assets/image.png?v=20260422a" alt="ポケスリ相場ナビ" />
    </a>
    <div class="header-search" aria-label="サイト内検索">
      <div class="search-wrap">
        <span class="search-ico">🔎</span>
        <input type="text" id="search" placeholder="スリーブ名で検索..." autocomplete="off" />
      </div>
    </div>
    <div class="header-right">
      <a href="./policy.html">ポリシー</a>
    </div>
  </div>
  <div class="header-bottom" id="headerPrimaryNav">
    <div class="header-bottom-inner">
      <nav class="nav" aria-label="メインメニュー">
        <a href="./index.html" data-nav="index"><span class="nav-icon" aria-hidden="true">🏠</span>ホーム</a>
        <a href="./sleeves/" data-nav="zukan"><span class="nav-icon" aria-hidden="true">🗂️</span>図鑑</a>
        <a href="./ranking.html" data-nav="ranking"><span class="nav-icon" aria-hidden="true">👑</span>価格ランキング</a>
        <a href="./access-ranking.html" data-nav="access-ranking"><span class="nav-icon" aria-hidden="true">👀</span>アクセスランキング</a>
        <a href="./growth.html" data-nav="growth"><span class="nav-icon" aria-hidden="true">💹</span>高騰率</a>
        <a href="./surge.html" data-nav="surge"><span class="nav-icon" aria-hidden="true">🔥</span>急上昇</a>
        <a href="./index-market.html" data-nav="market"><span class="nav-icon" aria-hidden="true">📈</span>スリーブ指数</a>
        <a href="./articles.html" data-nav="articles"><span class="nav-icon" aria-hidden="true">📝</span>記事</a>
        <a href="./contact.html" data-nav="contact"><span class="nav-icon" aria-hidden="true">✉️</span>お問い合わせ</a>
      </nav>
    </div>
  </div>
  <aside id="headerCategoryNav" class="category-nav category-nav--header" data-category-nav aria-label="カテゴリー導線" hidden>
    <div class="category-nav-head">
      <p class="category-nav-kicker">CATEGORY</p>
      <h2 class="category-nav-title">カテゴリー</h2>
    </div>
    <div class="category-nav-list">
      <div class="category-nav-empty skeleton-block" style="min-height: 148px;"></div>
    </div>
  </aside>
</div>
`;

const FOOTER_HTML = `
<footer class="site-footer">
  &copy; 2026 ポケスリ相場ナビ |
  <a href="./policy.html">プライバシーポリシー・免責事項</a>
</footer>
`;

function buildDashboardSidebarHtml(activeSidebar = "") {
  const itemClass = (key) => `sidebar-link${activeSidebar === key ? " is-active" : ""}`;
  return `
  <a class="sidebar-brand" href="${escapeHtml(buildSiteHref("index.html"))}" aria-label="ポケスリ相場ナビ ホームへ">
    <img class="site-title-logo site-title-logo--sidebar" src="./assets/image.png?v=20260422a" alt="ポケスリ相場ナビ" />
  </a>

  <nav class="sidebar-nav" aria-label="主要ナビゲーション">
    <a class="${itemClass("index")}" href="${escapeHtml(buildSiteHref("index.html"))}"><span class="sidebar-link-icon" aria-hidden="true">⌂</span><span>ホーム</span></a>
    <a class="${itemClass("zukan")}" href="${escapeHtml(buildSiteHref("sleeves/"))}"><span class="sidebar-link-icon" aria-hidden="true">▤</span><span>スリーブ図鑑</span></a>
    <div id="sidebarCategoryShell" class="sidebar-category-shell" hidden>
      <button type="button" class="sidebar-link sidebar-category-toggle" id="sidebarCategoryToggle" aria-expanded="false" aria-controls="categoryNav">
        <span class="sidebar-category-toggle-label">
          <span class="sidebar-link-icon" aria-hidden="true">☰</span>
          <span>スリーブカテゴリ</span>
        </span>
        <span class="sidebar-category-caret" aria-hidden="true">›</span>
      </button>
      <aside id="categoryNav" class="category-nav sidebar-category-panel" data-category-nav aria-label="スリーブカテゴリ一覧" hidden>
        <div class="category-nav-list">
          <div class="category-nav-empty skeleton-block" style="min-height: 128px;"></div>
        </div>
      </aside>
    </div>
    <a class="${itemClass("surge")}" href="${escapeHtml(buildSiteHref("surge.html"))}"><span class="sidebar-link-icon" aria-hidden="true">⚡</span><span>急上昇ランキング</span></a>
    <a class="${itemClass("ranking")}" href="${escapeHtml(buildSiteHref("ranking.html"))}"><span class="sidebar-link-icon" aria-hidden="true">◷</span><span>価格ランキング</span></a>
    <a class="${itemClass("access-ranking")}" href="${escapeHtml(buildSiteHref("access-ranking.html"))}"><span class="sidebar-link-icon" aria-hidden="true">◉</span><span>アクセスランキング</span></a>
    <a class="${itemClass("growth")}" href="${escapeHtml(buildSiteHref("growth.html"))}"><span class="sidebar-link-icon" aria-hidden="true">↗</span><span>高騰率ランキング</span></a>
    <a class="${itemClass("market")}" href="${escapeHtml(buildSiteHref("index-market.html"))}"><span class="sidebar-link-icon" aria-hidden="true">⌁</span><span>市場状況</span></a>
    <a class="${itemClass("articles")}" href="${escapeHtml(buildSiteHref("articles.html"))}"><span class="sidebar-link-icon" aria-hidden="true">✎</span><span>記事</span></a>
  </nav>
  `;
}

function getCurrentTopbarKey() {
  const path = String(location.pathname || "").toLowerCase();
  if (path.includes("article")) return "articles";
  if (path.includes("policy")) return "policy";
  if (path.includes("contact")) return "contact";
  if (path.includes("market") || path.includes("ranking") || path.includes("growth") || path.includes("surge") || path.includes("access-ranking")) return "market";
  return "dashboard";
}

function buildDashboardTopbarHtml(activeTopbar = getCurrentTopbarKey()) {
  const itemClass = (key) => `topbar-tab${activeTopbar === key ? " is-active" : ""}`;
  return `
  <a class="topbar-mobile-logo" href="${escapeHtml(buildSiteHref("index.html"))}" aria-label="ポケスリ相場ナビ ホームへ">
    <img src="./assets/image.png?v=20260422a" alt="ポケスリ相場ナビ" />
  </a>
  <div class="topbar-search">
    <span class="topbar-search-icon" aria-hidden="true">⌕</span>
    <input id="dashboardSearchInput" class="topbar-search-input" type="search" placeholder="スリーブを検索..." autocomplete="off" />
  </div>
  <nav class="topbar-tabs" aria-label="上部メニュー">
    <a class="${itemClass("dashboard")}" href="${escapeHtml(buildSiteHref("index.html"))}">ホーム</a>
    <a class="${itemClass("market")}" href="${escapeHtml(buildSiteHref("index-market.html"))}">市場状況</a>
    <a class="${itemClass("articles")}" href="${escapeHtml(buildSiteHref("articles.html"))}">記事</a>
    <a class="${itemClass("policy")}" href="${escapeHtml(buildSiteHref("policy.html"))}">プライバシーポリシー</a>
    <a class="${itemClass("contact")}" href="${escapeHtml(buildSiteHref("contact.html"))}">お問い合わせ</a>
  </nav>
  <div class="topbar-utils" aria-hidden="true">
    <span>◌</span>
    <span>□</span>
    <span>△</span>
  </div>
  `;
}

function getCurrentNavKey() {
  const path = String(location.pathname || "").toLowerCase();
  let key = "index";
  if (path.includes("access-ranking")) key = "access-ranking";
  else if (path.includes("ranking")) key = "ranking";
  else if (path.includes("zukan") || path.includes("sleeves")) key = "zukan";
  else if (path.includes("growth")) key = "growth";
  else if (path.includes("surge")) key = "surge";
  else if (path.includes("market")) key = "market";
  else if (path.includes("article")) key = "articles";
  else if (path.includes("contact")) key = "contact";
  else if (path.includes("detail") || path.includes("/sleeve/")) key = "zukan";
  else if (path === "/" || path.endsWith("/index.html")) key = "index";
  return key;
}

function buildMobileBottomNavHtml(activeKey = getCurrentNavKey()) {
  const itemClass = (key) => `mobile-bottom-link${activeKey === key ? " is-active" : ""}`;
  return `
  <nav class="mobile-bottom-nav" aria-label="モバイルナビゲーション" data-common-mobile-bottom-nav="1">
    <a class="${itemClass("index")}" href="${escapeHtml(buildSiteHref("index.html"))}"><span aria-hidden="true">⌂</span><span>ホーム</span></a>
    <a class="${itemClass("zukan")}" href="${escapeHtml(buildSiteHref("sleeves/"))}" aria-label="スリーブ図鑑"><span aria-hidden="true">▤</span><span>図鑑</span></a>
    <a class="${itemClass("surge")}" href="${escapeHtml(buildSiteHref("surge.html"))}"><span aria-hidden="true">↗</span><span>急上昇</span></a>
    <a class="${itemClass("growth")}" href="${escapeHtml(buildSiteHref("growth.html"))}"><span aria-hidden="true">△</span><span>高騰率</span></a>
    <a class="${itemClass("ranking")}" href="${escapeHtml(buildSiteHref("ranking.html"))}" aria-label="価格ランキング"><span aria-hidden="true">¥</span><span>価格</span></a>
  </nav>
  `;
}

/* ----- Utilities ----- */
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toISODate(d) {
  const dd = new Date(d);
  if (Number.isNaN(dd.getTime())) return null;
  const y = dd.getFullYear();
  const m = String(dd.getMonth() + 1).padStart(2, "0");
  const day = String(dd.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function openArticleDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available."));
      return;
    }
    const request = indexedDB.open(ARTICLE_DB_NAME, ARTICLE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ARTICLE_STORE_NAME)) db.createObjectStore(ARTICLE_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open article database."));
  });
}

async function readIndexedDbArticles() {
  try {
    const db = await openArticleDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(ARTICLE_STORE_NAME, "readonly");
      const store = tx.objectStore(ARTICLE_STORE_NAME);
      const request = store.get(ARTICLE_STORE_KEY);
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error || new Error("Failed to read article database."));
      tx.oncomplete = () => db.close();
      tx.onabort = () => db.close();
    });
  } catch (_) {
    return [];
  }
}

async function writeIndexedDbArticles(articles) {
  const db = await openArticleDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(ARTICLE_STORE_NAME, "readwrite");
    const store = tx.objectStore(ARTICLE_STORE_NAME);
    const request = store.put(Array.isArray(articles) ? articles : [], ARTICLE_STORE_KEY);
    request.onerror = () => reject(request.error || new Error("Failed to write article database."));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error("Article database write was aborted.")); };
  });
}

function readLocalStorageArticles(key = "pokeSleeve:articles:local:v1") {
  try {
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

async function readLocalArticles(key = "pokeSleeve:articles:local:v1") {
  const map = new Map();
  for (const article of readLocalStorageArticles(key)) {
    const id = String(article?.id || article?.slug || "").trim();
    if (id) map.set(id, article);
  }
  for (const article of await readIndexedDbArticles()) {
    const id = String(article?.id || article?.slug || "").trim();
    if (id) map.set(id, article);
  }
  return Array.from(map.values());
}

async function writeLocalArticles(articles, key = "pokeSleeve:articles:local:v1") {
  const list = Array.isArray(articles) ? articles : [];
  try {
    await writeIndexedDbArticles(list);
  } catch (_) {
    localStorage.setItem(key, JSON.stringify(list));
    return;
  }
  try {
    const lite = list.map((article) => ({
      ...article,
      html: String(article?.html || "").replace(/\ssrc="data:image\/[^"]+"/gi, ""),
      coverImage: /^data:image\//i.test(String(article?.coverImage || "")) ? "" : article?.coverImage
    }));
    localStorage.setItem(key, JSON.stringify(lite));
  } catch (_) {}
}

function sumWeeklyTradeCounts(sleeve) {
  const arr = Array.isArray(sleeve && sleeve.weeklyPrices) ? sleeve.weeklyPrices : [];
  let total = 0;
  let hasAny = false;
  for (const row of arr) {
    const count = numOrNull(row && row.count);
    if (Number.isFinite(count) && count > 0) {
      total += count;
      hasAny = true;
    }
  }
  return hasAny ? total : 0;
}

function sumRecentTradeCounts(sleeve, days) {
  const windowDays = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : 0;
  if (!windowDays) return 0;
  const arr = Array.isArray(sleeve && sleeve.weeklyPrices) ? sleeve.weeklyPrices : [];
  const rows = arr
    .map((row) => {
      const iso = toISODate(row && row.week);
      const count = numOrNull(row && row.count);
      if (!iso || !Number.isFinite(count) || count <= 0) return null;
      const ts = Date.parse(iso);
      if (!Number.isFinite(ts)) return null;
      return { ts, count };
    })
    .filter(Boolean);

  if (!rows.length) return 0;
  const latestTs = Math.max(...rows.map((row) => row.ts));
  const cutoffTs = latestTs - ((windowDays - 1) * 24 * 60 * 60 * 1000);
  return rows.reduce((sum, row) => sum + (row.ts >= cutoffTs ? row.count : 0), 0);
}

function getFlowMetrics(sleeve) {
  const explicitTotal = numOrNull(sleeve && sleeve.totalTrades);
  const explicit30d = numOrNull(sleeve && sleeve.trades30d);
  const explicit7d = numOrNull(sleeve && sleeve.trades7d);

  const totalTrades = Math.max(0, explicitTotal != null ? explicitTotal : sumWeeklyTradeCounts(sleeve));
  const trades30d = Math.max(0, explicit30d != null ? explicit30d : sumRecentTradeCounts(sleeve, 30));
  const trades7d = Math.max(0, explicit7d != null ? explicit7d : sumRecentTradeCounts(sleeve, 7));
  const flowScore = (totalTrades * 0.3) + (trades30d * 0.5) + (trades7d * 0.2);
  const hasTrades = totalTrades > 0 || trades30d > 0 || trades7d > 0;

  let label = "ほぼ流通なし";
  let tone = "none";
  if (hasTrades && flowScore >= 80) {
    label = "🔥 取引活発";
    tone = "active";
  } else if (hasTrades && flowScore >= 40) {
    label = "流通あり";
    tone = "present";
  } else if (hasTrades && flowScore >= 10) {
    label = "流通少";
    tone = "low";
  }

  let trendLabel = "";
  let trendTone = "";
  if (hasTrades) {
    const expected7d = (trades30d / 30) * 7;
    if (trades7d > expected7d) {
      trendLabel = "取引増加中";
      trendTone = "trend-up";
    } else {
      trendLabel = "流通減少中";
      trendTone = "trend-down";
    }
  }

  return {
    totalTrades,
    trades30d,
    trades7d,
    flowScore,
    label,
    tone,
    trendLabel,
    trendTone
  };
}

function buildFlowBadgeHtml(sleeve, options = {}) {
  const metrics = getFlowMetrics(sleeve);
  const includeTrend = options.includeTrend !== false;
  const badges = [
    `<span class="flow-badge flow-badge--${escapeHtml(metrics.tone)}">${escapeHtml(metrics.label)}</span>`
  ];
  if (includeTrend && metrics.trendLabel) {
    badges.push(`<span class="flow-badge flow-badge--${escapeHtml(metrics.trendTone)}">${escapeHtml(metrics.trendLabel)}</span>`);
  }
  return badges.join("");
}

function uniq(arr) {
  const s = new Set();
  for (const v of arr) {
    const t = (v == null) ? "" : String(v).trim();
    if (t) s.add(t);
  }
  return Array.from(s);
}

const SLEEVE_CATEGORY_FIELD_GROUPS = {
  pokemon: ["category1", "category2", "category3"],
  trainer: ["category4", "category5", "category6"],
  series: ["category4", "category5", "category6"],
  category: ["category7", "category8", "category9"],
  character: ["category4", "category5", "category6"],
  other: ["category7", "category8", "category9"]
};

function normalizeSleeveTextValue(value) {
  return String(value ?? "").trim();
}

function getSleeveCategoryValues(sleeve, keys) {
  if (!sleeve || typeof sleeve !== "object") return [];
  const sourceKeys = Array.isArray(keys) ? keys : [];
  const values = [];
  for (const key of sourceKeys) {
    const value = normalizeSleeveTextValue(sleeve?.[key]);
    if (value) values.push(value);
  }
  return uniq(values);
}

function getSleeveCategoryBuckets(sleeve) {
  return {
    pokemon: getSleeveCategoryValues(sleeve, SLEEVE_CATEGORY_FIELD_GROUPS.pokemon),
    trainer: getSleeveCategoryValues(sleeve, SLEEVE_CATEGORY_FIELD_GROUPS.trainer),
    category: getSleeveCategoryValues(sleeve, SLEEVE_CATEGORY_FIELD_GROUPS.category)
  };
}

function sleeveMatchesGroup(sleeve, groupKey) {
  const key = normalizeSleeveTextValue(groupKey).toLowerCase();
  const fields = SLEEVE_CATEGORY_FIELD_GROUPS[key];
  if (!fields) return false;
  return getSleeveCategoryValues(sleeve, fields).length > 0;
}

function countSleevesByGroup(sleeves) {
  const list = Array.isArray(sleeves) ? sleeves : [];
  return {
    pokemon: list.reduce((sum, sleeve) => sum + (sleeveMatchesGroup(sleeve, "pokemon") ? 1 : 0), 0),
    trainer: list.reduce((sum, sleeve) => sum + (sleeveMatchesGroup(sleeve, "trainer") ? 1 : 0), 0),
    category: list.reduce((sum, sleeve) => sum + (sleeveMatchesGroup(sleeve, "category") ? 1 : 0), 0)
  };
}

function buildSleeveGroupHref(groupKey) {
  return buildSiteHref(`sleeves/?group=${encodeURIComponent(normalizeSleeveTextValue(groupKey).toLowerCase())}`);
}

function collectGroupDetailItems(sleeves, groupKey) {
  const list = Array.isArray(sleeves) ? sleeves : [];
  const key = normalizeSleeveTextValue(groupKey).toLowerCase();
  const fields = SLEEVE_CATEGORY_FIELD_GROUPS[key];
  if (!fields) return [];

  const counts = new Map();
  for (const sleeve of list) {
    const values = getSleeveCategoryValues(sleeve, fields);
    for (const value of values) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(a.label).localeCompare(String(b.label), "ja", { sensitivity: "base", numeric: true });
    });
}

function sleeveMatchesDetailTag(sleeve, tag) {
  const target = normalizeSleeveTextValue(tag);
  if (!target) return false;
  const values = getSleeveCategoryValues(sleeve, [
    "category1", "category2", "category3",
    "category4", "category5",
    "category6", "category7", "category8", "category9"
  ]);
  return values.includes(target);
}

function buildSleeveCategoryHref(groupKey, tag) {
  const params = new URLSearchParams();
  const group = normalizeSleeveTextValue(groupKey).toLowerCase();
  const detailTag = normalizeSleeveTextValue(tag);
  if (group) params.set("group", group);
  if (detailTag) params.set("tag", detailTag);
  return buildSiteHref(`sleeves/?${params.toString()}`);
}

function collectSleeveTypes(sleeves) {
  const list = Array.isArray(sleeves) ? sleeves : [];
  const counts = new Map();
  for (const sleeve of list) {
    const value = normalizeSleeveTextValue(sleeve?.type);
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(a.label).localeCompare(String(b.label), "ja", { sensitivity: "base", numeric: true });
    });
}

function sleeveMatchesType(sleeve, typeValue) {
  const target = normalizeSleeveTextValue(typeValue);
  if (!target) return false;
  return normalizeSleeveTextValue(sleeve?.type) === target;
}

function buildSleeveTypeHref(typeValue) {
  const params = new URLSearchParams();
  const typeText = normalizeSleeveTextValue(typeValue);
  if (typeText) params.set("type", typeText);
  return buildSiteHref(`sleeves/?${params.toString()}`);
}

function buildSiteHref(path) {
  const trimmed = String(path || "").replace(/^\.?\//, "");
  return new URL(trimmed, document.baseURI).toString();
}

function buildSleeveRouteId(id) {
  const sleeveId = String(id || "").trim();
  if (/^\d{6,7}$/.test(sleeveId)) return `4521329${sleeveId}`;
  return sleeveId;
}

function buildSleeveDetailHref(id) {
  const routeId = buildSleeveRouteId(id);
  if (!routeId) return buildSiteHref("sleeves/");
  return buildSiteHref(`sleeve/${encodeURIComponent(routeId)}/`);
}

function setStructuredData(id, data) {
  const scriptId = String(id || "").trim();
  if (!scriptId) return;
  let el = document.getElementById(scriptId);
  if (!data) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = scriptId;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function getCanonicalPageUrl() {
  const canonical = document.querySelector('link[rel="canonical"]');
  const href = canonical ? canonical.getAttribute("href") : "";
  return new URL(href || location.href, document.baseURI).toString();
}

function buildSleeveListItemStructuredData(entry, index) {
  const sleeve = entry?.sleeve || entry?.s || entry;
  if (!sleeve || typeof sleeve !== "object") return null;
  const isArticle = !!(entry?.title || sleeve?.title);
  const name = String(entry?.name || entry?.title || sleeve?.name || sleeve?.title || "").trim();
  const id = String(entry?.id || sleeve?.id || "").trim();
  if (!name && !id) return null;
  const rawHref = String(entry?.url || entry?.href || entry?.linkUrl || entry?.detailHref || "").trim()
    || (isArticle && (entry?.slug || sleeve?.slug) ? buildSiteHref(`article.html?id=${encodeURIComponent(entry?.slug || sleeve?.slug)}`) : "")
    || buildSleeveDetailHref(id);
  const href = new URL(rawHref, document.baseURI).toString();
  const item = {
    "@type": isArticle ? "Article" : "Thing",
    name: name || `ID: ${id}`,
    url: href
  };
  const image = String(entry?.imageUrl || entry?.coverImage || sleeve?.imageUrl || sleeve?.coverImage || "").trim();
  if (image) item.image = image;
  return {
    "@type": "ListItem",
    position: index + 1,
    url: href,
    item
  };
}

function updateItemListStructuredData(id, items, options = {}) {
  const itemListElement = (Array.isArray(items) ? items : [])
    .map((item, index) => buildSleeveListItemStructuredData(item, index))
    .filter(Boolean)
    .slice(0, Number.isFinite(options.limit) ? Math.max(1, options.limit) : 50);

  if (!itemListElement.length) {
    setStructuredData(id, null);
    return;
  }

  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: String(options.name || document.title || "ポケスリ相場ナビ").replace(/\s*[|-]\s*ポケスリ相場ナビ\s*$/, ""),
    url: getCanonicalPageUrl(),
    numberOfItems: itemListElement.length,
    itemListElement
  };
  const description = String(options.description || document.querySelector('meta[name="description"]')?.getAttribute("content") || "").trim();
  if (description) data.description = description;
  setStructuredData(id, data);
}

function updateArticleStructuredData(id, article = {}) {
  const headline = String(article.headline || article.title || document.querySelector("h1")?.textContent || document.title || "").trim();
  if (!headline) {
    setStructuredData(id, null);
    return;
  }
  const description = String(article.description || article.excerpt || document.querySelector('meta[name="description"]')?.getAttribute("content") || "").trim();
  const image = String(article.image || article.coverImage || document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "").trim();
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    image: image || undefined,
    datePublished: String(article.datePublished || article.publishedAt || "").trim() || undefined,
    dateModified: String(article.dateModified || article.updatedAt || article.publishedAt || "").trim() || undefined,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": String(article.url || "").trim() || getCanonicalPageUrl()
    },
    publisher: {
      "@type": "Organization",
      name: "ポケスリ相場ナビ",
      logo: {
        "@type": "ImageObject",
        url: buildSiteHref("assets/favicon.svg")
      }
    }
  };
  setStructuredData(id, data);
}

function buildCategoryNavMarkup(sleeves) {
  const configs = [
    { key: "pokemon", label: "ポケモン" },
    { key: "trainer", label: "トレーナー" },
    { key: "category", label: "限定" }
  ];
  const counts = countSleevesByGroup(sleeves);
  const items = configs
    .map((config) => ({ ...config, count: Number(counts?.[config.key] || 0) }))
    .filter((item) => item.count >= 2);

  if (!items.length) {
    return {
      hasItems: false,
      listHtml: `<div class="category-nav-empty">表示できるカテゴリーはまだ十分に集計されていません。</div>`
    };
  }

  const sections = items.map((item) => {
    const href = buildSleeveGroupHref(item.key);
    const detailItems = collectGroupDetailItems(sleeves, item.key).slice(0, 14);
    const sublistHtml = detailItems.length
      ? `
        <div class="category-sublist">
          ${detailItems.map((detailItem) => {
            const detailHref = buildSleeveCategoryHref(item.key, detailItem.label);
            return `
              <a class="category-flyout-link" href="${escapeHtml(detailHref)}">
                <span>${escapeHtml(detailItem.label)}</span>
                <span class="category-flyout-count">${escapeHtml(String(detailItem.count))}件</span>
              </a>
            `;
          }).join("")}
        </div>
      `
      : "";

    return `
      <div class="category-nav-item">
        <a class="category-nav-link" href="${escapeHtml(href)}">
          <span class="category-nav-name">${escapeHtml(item.label)}</span>
          <span class="category-nav-meta">
            <span class="category-nav-count">${escapeHtml(String(item.count))}件</span>
            <span class="category-nav-arrow" aria-hidden="true">›</span>
          </span>
        </a>
        ${sublistHtml}
      </div>
    `;
  });

  const typeItems = collectSleeveTypes(sleeves).slice(0, 14);
  if (typeItems.length) {
    sections.push(`
      <div class="category-nav-item">
        <a class="category-nav-link" href="${escapeHtml(buildSiteHref("sleeves/"))}">
          <span class="category-nav-name">デッキシールド種類</span>
          <span class="category-nav-meta">
            <span class="category-nav-count">${escapeHtml(String(typeItems.reduce((sum, item) => sum + Number(item.count || 0), 0)))}件</span>
            <span class="category-nav-arrow" aria-hidden="true">›</span>
          </span>
        </a>
        <div class="category-sublist">
          ${typeItems.map((typeItem) => {
            const typeHref = buildSleeveTypeHref(typeItem.label);
            return `
              <a class="category-flyout-link" href="${escapeHtml(typeHref)}">
                <span>${escapeHtml(typeItem.label)}</span>
                <span class="category-flyout-count">${escapeHtml(String(typeItem.count))}件</span>
              </a>
            `;
          }).join("")}
        </div>
      </div>
    `);
  }

  return {
    hasItems: true,
    listHtml: sections.join("")
  };
}

function renderCategoryNav(sleeves, root) {
  const target = root instanceof Element ? root : null;
  if (!target) return false;

  const { hasItems, listHtml } = buildCategoryNavMarkup(sleeves);
  const list = target.querySelector(".category-nav-list");
  if (list) list.innerHTML = listHtml;
  return hasItems;
}

function syncHeaderCategoryFromHomeSidebar() {
  if (!document.body.classList.contains("home-page")) return false;
  const sidebarRoot = document.getElementById("categoryNav");
  const headerRoot = document.getElementById("headerCategoryNav");
  if (!(sidebarRoot instanceof Element) || !(headerRoot instanceof Element)) return false;

  const sidebarList = sidebarRoot.querySelector(".category-nav-list");
  const headerList = headerRoot.querySelector(".category-nav-list");
  if (!(sidebarList instanceof Element) || !(headerList instanceof Element)) return false;
  if (sidebarList.querySelector(".skeleton-block")) return false;
  if (!sidebarList.children.length) return false;

  headerList.innerHTML = sidebarList.innerHTML;
  return true;
}

async function ensureCategoryNavsRendered(preloadedSleeves = null) {
  const roots = Array.from(document.querySelectorAll("[data-category-nav]"));
  if (!roots.length) return;

  try {
    let sleeves = Array.isArray(preloadedSleeves) ? preloadedSleeves : null;
    if (!Array.isArray(sleeves)) {
      sleeves = await loadCategoryNavSleeves();
    }
    for (const root of roots) {
      const hasItems = renderCategoryNav(sleeves, root);
      const isHeaderRoot = root.id === "headerCategoryNav";
      const isSidebarRoot = root.id === "categoryNav";

      if (isHeaderRoot) {
        if (!root.classList.contains("is-mobile-drawer-open")) {
          root.hidden = true;
        }
        continue;
      }

      if (isSidebarRoot) {
        const shell = root.closest(".sidebar-category-shell");
        if (shell instanceof Element) {
          shell.hidden = !hasItems;
          root.hidden = !hasItems || !shell.classList.contains("is-open");
        } else {
          root.hidden = !hasItems;
        }
        continue;
      }

      root.hidden = true;
    }
  } catch (_) {
    for (const root of roots) {
      const list = root.querySelector(".category-nav-list");
      if (list) list.innerHTML = `<div class="category-nav-empty">カテゴリー一覧の読み込みに失敗しました。</div>`;
      const isSidebarRoot = root.id === "categoryNav";
      const isHeaderRoot = root.id === "headerCategoryNav";
      if (isHeaderRoot) {
        if (!root.classList.contains("is-mobile-drawer-open")) {
          root.hidden = true;
        }
        continue;
      }
      if (isSidebarRoot) {
        const shell = root.closest(".sidebar-category-shell");
        if (shell instanceof Element) shell.hidden = false;
        root.hidden = true;
      } else {
        root.hidden = true;
      }
    }
  }
}

async function loadCategoryNavSleeves() {
  if (Array.isArray(__dataCacheMem?.data?.sleeves)) {
    return __dataCacheMem.data.sleeves;
  }

  const sessionCached = readSessionCache();
  if (Array.isArray(sessionCached?.sleeves)) {
    return sessionCached.sleeves;
  }

  const persistentCached = readPersistentCache();
  if (Array.isArray(persistentCached?.sleeves)) {
    return persistentCached.sleeves;
  }

  try {
    const resolvedUrl = new URL(LOCAL_DATA_URL, document.baseURI || location.href).href;
    const localData = await fetchJsonWithTimeout(resolvedUrl, {
      timeoutMs: 2500,
      cacheMode: "reload"
    });
    if (Array.isArray(localData?.sleeves)) {
      return localData.sleeves;
    }
  } catch (_) { }

  const data = await loadData();
  return Array.isArray(data?.sleeves) ? data.sleeves : [];
}

function readSearchHistory() {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, SEARCH_HISTORY_MAX);
  } catch (_) {
    return [];
  }
}

function writeSearchHistory(items) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items.slice(0, SEARCH_HISTORY_MAX)));
  } catch (_) { }
}

function recordSearchHistory(query) {
  const q = String(query || "").trim();
  if (!q) return;
  const current = readSearchHistory();
  const norm = normalizeSearchText(q);
  const next = [q];
  for (const item of current) {
    if (normalizeSearchText(item) === norm) continue;
    next.push(item);
    if (next.length >= SEARCH_HISTORY_MAX) break;
  }
  writeSearchHistory(next);
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[‐‑‒–—―ーｰ\-_.・･]/g, "");
}

function toHiragana(value) {
  return String(value ?? "").replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function toKatakana(value) {
  return String(value ?? "").replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

function kanaToRomaji(value) {
  const src = toHiragana(value);
  const digraph = {
    "きゃ": "kya", "きゅ": "kyu", "きょ": "kyo",
    "ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo",
    "しゃ": "sha", "しゅ": "shu", "しょ": "sho",
    "じゃ": "ja", "じゅ": "ju", "じょ": "jo",
    "ちゃ": "cha", "ちゅ": "chu", "ちょ": "cho",
    "にゃ": "nya", "にゅ": "nyu", "にょ": "nyo",
    "ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo",
    "びゃ": "bya", "びゅ": "byu", "びょ": "byo",
    "ぴゃ": "pya", "ぴゅ": "pyu", "ぴょ": "pyo",
    "みゃ": "mya", "みゅ": "myu", "みょ": "myo",
    "りゃ": "rya", "りゅ": "ryu", "りょ": "ryo",
    "ふぁ": "fa", "ふぃ": "fi", "ふぇ": "fe", "ふぉ": "fo",
    "てぃ": "ti", "でぃ": "di", "とぅ": "tu", "どぅ": "du",
    "うぃ": "wi", "うぇ": "we", "うぉ": "wo",
    "ゔぁ": "va", "ゔぃ": "vi", "ゔぇ": "ve", "ゔぉ": "vo",
    "しぇ": "she", "じぇ": "je", "ちぇ": "che"
  };
  const mono = {
    "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
    "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
    "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
    "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
    "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
    "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
    "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
    "や": "ya", "ゆ": "yu", "よ": "yo",
    "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
    "わ": "wa", "を": "wo", "ん": "n",
    "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go",
    "ざ": "za", "じ": "ji", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
    "だ": "da", "ぢ": "ji", "づ": "zu", "で": "de", "ど": "do",
    "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
    "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po",
    "ぁ": "a", "ぃ": "i", "ぅ": "u", "ぇ": "e", "ぉ": "o",
    "ゃ": "ya", "ゅ": "yu", "ょ": "yo", "ゎ": "wa", "ゔ": "vu"
  };

  let out = "";
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "ー") {
      const last = out[out.length - 1];
      if (/[aeiou]/.test(last || "")) out += last;
      continue;
    }
    const pair = src.slice(i, i + 2);
    if (digraph[pair]) {
      out += digraph[pair];
      i += 1;
      continue;
    }
    if (ch === "っ") {
      const nextPair = src.slice(i + 1, i + 3);
      const nextRoma = digraph[nextPair] || mono[src[i + 1]] || "";
      if (nextRoma) out += nextRoma[0];
      continue;
    }
    out += mono[ch] || ch;
  }
  return out;
}

function buildSearchVariants(value) {
  const raw = String(value ?? "");
  const variants = new Set();
  const push = (v) => {
    const n = normalizeSearchText(v);
    if (n) variants.add(n);
  };

  push(raw);
  push(toHiragana(raw));
  push(toKatakana(raw));
  push(kanaToRomaji(raw));
  push(kanaToRomaji(toKatakana(raw)));
  return Array.from(variants);
}

function getLatestPositivePrice(sleeve) {
  const arr = Array.isArray(sleeve && sleeve.weeklyPrices) ? sleeve.weeklyPrices : [];
  let latest = null;
  for (const x of arr) {
    const week = toISODate(x && x.week);
    const price = numOrNull(x && x.price);
    if (!week || !(price > 0)) continue;
    if (!latest || week > latest.week) latest = { week, price };
  }
  return latest ? latest.price : null;
}

async function getAutocompleteIndex() {
  if (__autocompleteIndexPromise) return await __autocompleteIndexPromise;

  __autocompleteIndexPromise = (async () => {
    const data = await loadData();
    const sleeves = Array.isArray(data && data.sleeves) ? data.sleeves : [];
    return sleeves
      .map((s) => {
        const name = String(s && s.name || "").trim();
        const id = String(s && s.id || "").trim();
        if (!name || !id) return null;
        return {
          id,
          name,
          series: String(s && s.series || "").trim(),
          searchKeys: buildSearchVariants(name),
          detailHref: buildSleeveDetailHref(id),
          imageUrl: String(s && s.imageUrl || "").trim(),
          latestPrice: getLatestPositivePrice(s)
        };
      })
      .filter(Boolean);
  })();

  try {
    return await __autocompleteIndexPromise;
  } catch (e) {
    __autocompleteIndexPromise = null;
    throw e;
  }
}

function findAutocompleteCandidates(indexItems, query, maxItems = AUTOCOMPLETE_MAX_ITEMS) {
  const queryVariants = buildSearchVariants(query);
  if (!queryVariants.length) return [];

  const starts = [];
  const contains = [];
  for (const item of indexItems) {
    const keys = Array.isArray(item.searchKeys) && item.searchKeys.length
      ? item.searchKeys
      : [normalizeSearchText(item.name)];
    let bestPos = Infinity;
    for (const key of keys) {
      for (const q of queryVariants) {
        const pos = key.indexOf(q);
        if (pos >= 0 && pos < bestPos) bestPos = pos;
      }
    }
    if (!Number.isFinite(bestPos)) continue;
    if (bestPos === 0) starts.push(item);
    else contains.push({ item, pos: bestPos });
  }

  starts.sort((a, b) => {
    const al = (a.searchKeys && a.searchKeys[0]) ? a.searchKeys[0].length : String(a.name || "").length;
    const bl = (b.searchKeys && b.searchKeys[0]) ? b.searchKeys[0].length : String(b.name || "").length;
    if (al !== bl) return al - bl;
    return a.name.localeCompare(b.name, "ja");
  });

  contains.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    const al = (a.item.searchKeys && a.item.searchKeys[0]) ? a.item.searchKeys[0].length : String(a.item.name || "").length;
    const bl = (b.item.searchKeys && b.item.searchKeys[0]) ? b.item.searchKeys[0].length : String(b.item.name || "").length;
    if (al !== bl) return al - bl;
    return a.item.name.localeCompare(b.item.name, "ja");
  });

  const merged = starts.concat(contains.map((x) => x.item));
  return merged.slice(0, Math.max(1, maxItems));
}

function defaultNavigateToDetail(item) {
  if (!item || !item.id) return;
  try { sessionStorage.setItem(LAST_SELECTED_SLEEVE_ID_KEY, item.id); } catch (_) { }
  location.href = item.detailHref || buildSleeveDetailHref(item.id);
}

function defaultNavigateToZukan(query) {
  const q = String(query || "").trim();
  recordSearchHistory(q);
  location.href = q ? `./sleeves/?q=${encodeURIComponent(q)}` : "./sleeves/";
}

function wireSleeveAutocomplete(input, options = {}) {
  if (!input || input.dataset.autocompleteWired === "1") return null;
  input.dataset.autocompleteWired = "1";

  const minChars = Number.isFinite(options.minChars) ? Math.max(1, options.minChars) : AUTOCOMPLETE_MIN_CHARS;
  const maxItems = Number.isFinite(options.maxItems) ? Math.max(1, options.maxItems) : AUTOCOMPLETE_MAX_ITEMS;
  const anchorEl = options.anchorEl || input.parentElement;
  if (!anchorEl) return null;

  anchorEl.classList.add("has-search-autocomplete");

  const list = document.createElement("div");
  list.className = "search-autocomplete";
  list.hidden = true;
  list.setAttribute("role", "listbox");

  const listId = `search-autocomplete-${Math.random().toString(36).slice(2, 10)}`;
  list.id = listId;
  input.setAttribute("autocomplete", "off");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", listId);
  input.setAttribute("aria-expanded", "false");
  anchorEl.appendChild(list);

  let open = false;
  let activeIndex = -1;
  let currentItems = [];
  let debounceTimer = null;
  let indexItems = null;
  let indexLoadFailed = false;
  const layerEls = [anchorEl, anchorEl.closest("#dashboardTopbarSlot"), anchorEl.closest(".dashboard-topbar"), anchorEl.closest(".header")]
    .filter((el, idx, arr) => el && arr.indexOf(el) === idx);
  const setLayerOpen = (isOpen) => {
    for (const el of layerEls) {
      el.classList.toggle("is-search-autocomplete-open", isOpen);
    }
  };

  const close = () => {
    open = false;
    activeIndex = -1;
    currentItems = [];
    list.hidden = true;
    list.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    setLayerOpen(false);
  };

  const openList = () => {
    open = true;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    setLayerOpen(true);
  };

  const setActive = (next) => {
    if (!currentItems.length) {
      activeIndex = -1;
      input.removeAttribute("aria-activedescendant");
      return;
    }
    if (!Number.isFinite(next) || next < 0) {
      activeIndex = -1;
      const nodes = list.querySelectorAll(".search-suggest-item");
      for (let i = 0; i < nodes.length; i += 1) {
        nodes[i].classList.remove("is-active");
        nodes[i].setAttribute("aria-selected", "false");
      }
      input.removeAttribute("aria-activedescendant");
      return;
    }
    const bounded = ((next % currentItems.length) + currentItems.length) % currentItems.length;
    activeIndex = bounded;
    const nodes = list.querySelectorAll(".search-suggest-item");
    for (let i = 0; i < nodes.length; i += 1) {
      const isActive = i === activeIndex;
      nodes[i].classList.toggle("is-active", isActive);
      nodes[i].setAttribute("aria-selected", isActive ? "true" : "false");
      if (isActive) {
        input.setAttribute("aria-activedescendant", nodes[i].id);
        nodes[i].scrollIntoView({ block: "nearest" });
      }
    }
  };

  const render = () => {
    list.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (let i = 0; i < currentItems.length; i += 1) {
      const item = currentItems[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "search-suggest-item";
      btn.id = `${listId}-opt-${i}`;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", i === activeIndex ? "true" : "false");
      const thumbHtml = item.imageUrl
        ? `<img class="search-suggest-thumb" src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer"
             onerror="this.onerror=null; this.closest('.search-suggest-thumb-wrap')?.classList.add('is-empty'); this.remove();">`
        : "";
      const subInfo = item.series ? escapeHtml(item.series) : "シリーズ情報なし";
      btn.innerHTML = `
        <span class="search-suggest-thumb-wrap${item.imageUrl ? "" : " is-empty"}" aria-hidden="true">${thumbHtml}</span>
        <span class="search-suggest-main">
          <span class="search-suggest-name">${escapeHtml(item.name)}</span>
          <span class="search-suggest-sub">${subInfo}</span>
        </span>
        <span class="search-suggest-price">${item.latestPrice == null ? "—" : `${Number(item.latestPrice).toLocaleString()}円`}</span>
      `;
      btn.setAttribute("aria-label", `${item.name} の詳細ページへ移動`);
      btn.addEventListener("mouseenter", () => setActive(i));
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const onPick = typeof options.onPick === "function" ? options.onPick : defaultNavigateToDetail;
        onPick(item);
      });
      frag.appendChild(btn);
    }

    const q = String(input.value || "").trim();
    const historyCandidates = readSearchHistory()
      .filter((h) => normalizeSearchText(h).includes(normalizeSearchText(q)))
      .slice(0, 3);
    if (historyCandidates.length) {
      const historyWrap = document.createElement("div");
      historyWrap.className = "search-suggest-history";
      const title = document.createElement("div");
      title.className = "search-suggest-history-title";
      title.textContent = "最近の検索";
      historyWrap.appendChild(title);
      for (const h of historyCandidates) {
        const hb = document.createElement("button");
        hb.type = "button";
        hb.className = "search-suggest-history-item";
        hb.innerHTML = `
          <span class="search-suggest-history-icon" aria-hidden="true">↺</span>
          <span class="search-suggest-history-text">${escapeHtml(h)}</span>
        `;
        hb.addEventListener("mousedown", (e) => {
          e.preventDefault();
          input.value = h;
          const onAction = typeof options.onAction === "function" ? options.onAction : defaultNavigateToZukan;
          onAction(h);
        });
        historyWrap.appendChild(hb);
      }
      frag.appendChild(historyWrap);
    }

    if (q) {
      const actionBtn = document.createElement("button");
      actionBtn.type = "button";
      actionBtn.className = "search-suggest-action";
      actionBtn.innerHTML = `
        <span class="search-suggest-action-label">「${escapeHtml(q)}」で図鑑を検索する</span>
        <span class="search-suggest-action-arrow" aria-hidden="true">↗</span>
      `;
      actionBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const onAction = typeof options.onAction === "function" ? options.onAction : defaultNavigateToZukan;
        onAction(q);
      });
      frag.appendChild(actionBtn);
    }

    if (!frag.childNodes.length) {
      close();
      return;
    }

    list.appendChild(frag);
    openList();
    setActive(activeIndex);
  };

  const update = async () => {
    const query = String(input.value || "").trim();
    if (query.length < minChars) {
      close();
      return;
    }
    if (!indexItems && !indexLoadFailed) {
      try {
        indexItems = await getAutocompleteIndex();
      } catch (_) {
        indexLoadFailed = true;
        close();
        return;
      }
    }
    if (!indexItems) {
      close();
      return;
    }

    currentItems = findAutocompleteCandidates(indexItems, query, maxItems);
    activeIndex = -1;
    render();
  };

  input.addEventListener("input", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      update().catch(() => { close(); });
    }, 50);
  });

  input.addEventListener("focus", () => {
    if (String(input.value || "").trim().length >= minChars) {
      update().catch(() => { close(); });
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      }
      return;
    }
    if (!open || !currentItems.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(activeIndex < 0 ? 0 : activeIndex + 1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(activeIndex < 0 ? currentItems.length - 1 : activeIndex - 1);
      return;
    }
    if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const item = currentItems[activeIndex];
      const onPick = typeof options.onPick === "function" ? options.onPick : defaultNavigateToDetail;
      onPick(item);
    }
  });

  document.addEventListener("mousedown", (e) => {
    if (!anchorEl.contains(e.target)) close();
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (!anchorEl.contains(document.activeElement)) close();
    }, 0);
  });

  return { close };
}

/* ----- fetch with timeout ----- */
async function fetchJsonWithTimeout(url, { timeoutMs = 12000, cacheMode = "default" } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: cacheMode,
      signal: controller.signal,
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) throw new Error(`データ取得に失敗しました（HTTP ${res.status}）`);
    return await res.json();
  } catch (e) {
    if (e && e.name === "AbortError") {
      throw new Error("データ取得がタイムアウトしました。時間をおいて再読み込みしてください。");
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function fetchPrimaryData() {
  const sources = [
    { url: LOCAL_DATA_URL, timeoutMs: 2500, cacheMode: "reload" },
    { url: GAS_URL, timeoutMs: 12000, cacheMode: "no-store" }
  ];

  let lastError = null;
  let bestData = null;
  let bestCount = -1;
  for (const source of sources) {
    const resolvedUrl = new URL(source.url, document.baseURI || location.href).href;
    try {
      const data = await fetchJsonWithTimeout(resolvedUrl, {
        timeoutMs: source.timeoutMs,
        cacheMode: source.cacheMode
      });
      const usableSleeveCount = countUsableSleeves(data);
      if (usableSleeveCount > bestCount) {
        bestData = data;
        bestCount = usableSleeveCount;
      }
      if (isUsableDataPayload(data)) {
        return data;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (bestData) return bestData;
  throw lastError || new Error("データ取得に失敗しました");
}

function readSessionCacheEntry() {
  try {
    const raw = sessionStorage.getItem(DATA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Number.isFinite(parsed.cachedAt)) return null;
    if (parsed.data == null) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function readPersistentCacheEntry() {
  try {
    const raw = localStorage.getItem(DATA_PERSISTENT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Number.isFinite(parsed.cachedAt)) return null;
    if (parsed.data == null) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function readSessionCache() {
  const entry = readSessionCacheEntry();
  if (!entry) return null;
  if ((Date.now() - entry.cachedAt) > DATA_CACHE_TTL_MS) return null;
  if (!isUsableDataPayload(entry.data)) return null;
  return entry.data ?? null;
}

function readPersistentCache() {
  const entry = readPersistentCacheEntry();
  if (!entry) return null;
  if ((Date.now() - entry.cachedAt) > DATA_CACHE_TTL_MS) return null;
  if (!isUsableDataPayload(entry.data)) return null;
  return entry.data ?? null;
}

function writeSessionCache(data) {
  try {
    sessionStorage.setItem(DATA_CACHE_KEY, JSON.stringify({
      cachedAt: Date.now(),
      data
    }));
  } catch (_) { }
}

function writePersistentCache(data) {
  try {
    localStorage.setItem(DATA_PERSISTENT_CACHE_KEY, JSON.stringify({
      cachedAt: Date.now(),
      data
    }));
  } catch (_) { }
}

/* ----- central loadData() ----- */
async function loadData({ forceRefresh = false, ttlMs = DATA_CACHE_TTL_MS } = {}) {
  const withinTtl = (entry) => !!(entry && Number.isFinite(entry.cachedAt) && (Date.now() - entry.cachedAt) <= ttlMs);

  if (!forceRefresh && withinTtl(__dataCacheMem)) {
    return __dataCacheMem.data;
  }

  if (!forceRefresh) {
    const cached = readSessionCache();
    if (cached != null) {
      __dataCacheMem = { cachedAt: Date.now(), data: cached };
      return cached;
    }

    const persistentCached = readPersistentCache();
    if (persistentCached != null) {
      __dataCacheMem = { cachedAt: Date.now(), data: persistentCached };
      writeSessionCache(persistentCached);
      return persistentCached;
    }

    const staleEntry = readSessionCacheEntry() || readPersistentCacheEntry();
    if (staleEntry && (Date.now() - staleEntry.cachedAt) <= DATA_STALE_MAX_MS) {
      __dataCacheMem = { cachedAt: staleEntry.cachedAt, data: staleEntry.data };
      if (!__dataCachePromise) {
        __dataCachePromise = (async () => {
          const fresh = await fetchPrimaryData();
          __dataCacheMem = { cachedAt: Date.now(), data: fresh };
          writeSessionCache(fresh);
          writePersistentCache(fresh);
          try {
            document.dispatchEvent(new CustomEvent("pokeSleeve:dataRefreshed", { detail: fresh }));
          } catch (_) {}
          return fresh;
        })();
        __dataCachePromise.finally(() => {
          __dataCachePromise = null;
        });
      }
      return staleEntry.data;
    }
  }

  if (!forceRefresh && __dataCachePromise) {
    return await __dataCachePromise;
  }

  __dataCachePromise = (async () => {
    const data = await fetchPrimaryData();
    __dataCacheMem = { cachedAt: Date.now(), data };
    writeSessionCache(data);
    writePersistentCache(data);
    return data;
  })();

  try {
    return await __dataCachePromise;
  } finally {
    __dataCachePromise = null;
  }
}

/* ----- Header/Footer injection ----- */
function injectHeaderFooter() {
  try {
    const headSlot = document.getElementById("site-header");
    const suppressGlobalHeader = document.body?.dataset?.hideGlobalHeader === "1";
    if (headSlot) {
      headSlot.innerHTML = suppressGlobalHeader ? "" : HEADER_HTML;
    }

    const footSlot = document.getElementById("site-footer");
    if (footSlot) footSlot.innerHTML = FOOTER_HTML;
    injectMobileBottomNav();

    wireHeaderOffsetSync();
    syncHeaderOffset();
    ensureCategoryNavsRendered().catch(() => {});
    requestAnimationFrame(syncHeaderOffset);
    setTimeout(syncHeaderOffset, 120);
  } catch (e) {
    console.error("injectHeaderFooter error", e);
  } finally {
    document.dispatchEvent(new CustomEvent("site:injected"));
  }
}

function injectDashboardChrome({ sidebarActive = "", topbarActive = "", sidebarSlotId = "dashboardSidebarSlot", topbarSlotId = "dashboardTopbarSlot" } = {}) {
  const sidebarSlot = document.getElementById(sidebarSlotId);
  if (sidebarSlot) {
    const active = sidebarSlot.dataset.dashboardSidebarActive || sidebarActive;
    sidebarSlot.parentElement?.classList?.add("has-dashboard-slot");
    sidebarSlot.innerHTML = buildDashboardSidebarHtml(active);
  }

  const topbarSlot = document.getElementById(topbarSlotId);
  if (topbarSlot) {
    const active = topbarSlot.dataset.dashboardTopbarActive || topbarActive;
    topbarSlot.parentElement?.classList?.add("has-dashboard-slot");
    topbarSlot.innerHTML = buildDashboardTopbarHtml(active);
  }

  injectMobileBottomNav();
}

function getMobileBottomNavKeyFromHref(href) {
  const value = String(href || "");
  if (value.includes("sleeves")) return "zukan";
  if (value.includes("surge")) return "surge";
  if (value.includes("growth")) return "growth";
  if (value.includes("ranking")) return "ranking";
  if (value.includes("index")) return "index";
  return "";
}

function syncMobileBottomNavActive(activeKey = getCurrentNavKey()) {
  const links = document.querySelectorAll(".mobile-bottom-link");
  for (const link of links) {
    const key = getMobileBottomNavKeyFromHref(link.getAttribute("href"));
    link.classList.toggle("is-active", key === activeKey);
  }
}

function injectMobileBottomNav({ activeKey = getCurrentNavKey() } = {}) {
  if (!document.body) return;
  const existing = document.querySelector(".mobile-bottom-nav");
  if (existing) {
    existing.setAttribute("data-common-mobile-bottom-nav", "1");
    syncMobileBottomNavActive(activeKey);
    document.body.classList.add("has-mobile-bottom-nav");
    return;
  }

  document.body.insertAdjacentHTML("beforeend", buildMobileBottomNavHtml(activeKey));
  document.body.classList.add("has-mobile-bottom-nav");
}

function wireDashboardSearch() {
  const inputs = document.querySelectorAll("#dashboardSearchInput");
  if (!inputs.length) return;

  inputs.forEach((input) => {
    if (!input || input.dataset.dashboardSearchWired === "1") return;
    input.dataset.dashboardSearchWired = "1";

    wireSleeveAutocomplete(input, {
      minChars: 1,
      maxItems: 8,
      anchorEl: input.closest(".topbar-search")
    });

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      if (event.defaultPrevented) return;
      const q = input.value.trim();
      recordSearchHistory(q);
      location.href = q ? buildSiteHref(`sleeves/?q=${encodeURIComponent(q)}`) : buildSiteHref("sleeves/");
    });
  });
}

function wireDashboardSidebarCategoryToggle() {
  const shell = document.getElementById("sidebarCategoryShell");
  const button = document.getElementById("sidebarCategoryToggle");
  const panel = document.getElementById("categoryNav");
  const list = panel ? panel.querySelector(".category-nav-list") : null;
  if (!shell || !button || !panel || !list || button.dataset.sidebarCategoryWired === "1") return;
  button.dataset.sidebarCategoryWired = "1";

  const setOpen = (open) => {
    shell.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
  };

  const syncVisibility = () => {
    const hasItems = !!list.querySelector(".category-nav-item");
    shell.hidden = !hasItems;
    if (!hasItems) setOpen(false);
  };

  button.addEventListener("click", () => {
    if (shell.hidden) return;
    setOpen(!shell.classList.contains("is-open"));
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node)) return;
    if (shell.contains(event.target)) return;
    setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  const observer = new MutationObserver(syncVisibility);
  observer.observe(list, { childList: true, subtree: true });
  syncVisibility();
}

async function setupDashboardChrome(options = {}) {
  injectDashboardChrome(options);
  wireDashboardSearch();
  try {
    await ensureCategoryNavsRendered(options.sleeves || null);
  } catch (_) {
    // no-op: the page can still render without category data
  }
  wireDashboardSidebarCategoryToggle();
}

function syncHeaderOffset() {
  const header = document.querySelector("#site-header .header");
  if (!header) {
    document.documentElement.style.setProperty("--site-header-h", "0px");
    document.body.classList.remove("has-fixed-header");
    return;
  }

  const h = Math.ceil(header.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--site-header-h", `${h}px`);
  document.body.classList.add("has-fixed-header");
}

function wireHeaderOffsetSync() {
  if (__headerOffsetWired) return;
  __headerOffsetWired = true;

  window.addEventListener("resize", syncHeaderOffset, { passive: true });
  window.addEventListener("orientationchange", syncHeaderOffset, { passive: true });

  if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
    document.fonts.ready.then(syncHeaderOffset).catch(() => {});
  }
}

function wireHeaderMenu() {
  const header = document.querySelector("#site-header .header");
  const button = document.getElementById("headerMenuBtn");
  const categoryPanel = document.getElementById("headerCategoryNav");
  if (!header || !button || button.dataset.menuWired === "1") return;

  if (!categoryPanel) {
    button.hidden = true;
    return;
  }

  const updatePanelPosition = () => {
    if (window.innerWidth > 740) {
      categoryPanel.style.removeProperty("--category-nav-top");
      categoryPanel.style.removeProperty("--category-nav-left");
      categoryPanel.style.removeProperty("--category-nav-width");
      return;
    }

    const headerRect = header.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const width = Math.min(320, Math.max(220, window.innerWidth - 24));
    const left = Math.min(
      Math.max(12, buttonRect.left - headerRect.left),
      Math.max(12, header.clientWidth - width - 12)
    );
    const top = Math.max(12, buttonRect.bottom - headerRect.top + 8);

    categoryPanel.style.setProperty("--category-nav-top", `${Math.round(top)}px`);
    categoryPanel.style.setProperty("--category-nav-left", `${Math.round(left)}px`);
    categoryPanel.style.setProperty("--category-nav-width", `${Math.round(width)}px`);
  };

  const applyButtonState = (expanded) => {
    button.setAttribute("aria-expanded", expanded ? "true" : "false");
    button.setAttribute("aria-controls", "headerCategoryNav");
    button.setAttribute("aria-label", expanded ? "カテゴリーを閉じる" : "カテゴリーを開く");
  };

  const closeMenu = () => {
    categoryPanel.classList.remove("is-mobile-drawer-open");
    header.classList.remove("is-mobile-category-open");
    categoryPanel.hidden = true;
    categoryPanel.style.display = "none";
    applyButtonState(false);
    updatePanelPosition();
    syncHeaderOffset();
  };

  const toggleMenu = () => {
    const isOpen = categoryPanel.classList.toggle("is-mobile-drawer-open");
    header.classList.toggle("is-mobile-category-open", isOpen);
    categoryPanel.hidden = !isOpen;
    categoryPanel.style.display = isOpen ? "grid" : "none";
    applyButtonState(isOpen);
    updatePanelPosition();
    syncHeaderOffset();
    if (isOpen) {
      if (!syncHeaderCategoryFromHomeSidebar()) {
        ensureCategoryNavsRendered().catch(() => {});
      }
    }
  };

  button.dataset.menuWired = "1";
  applyButtonState(false);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu();
  });

  categoryPanel.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("a") : null;
    if (target) closeMenu();
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node)) return;
    if (header.contains(event.target)) return;
    if (categoryPanel.contains(event.target)) return;
    closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 740) {
      closeMenu();
    } else {
      applyButtonState(categoryPanel.classList.contains("is-mobile-drawer-open"));
      updatePanelPosition();
    }
  }, { passive: true });

  window.addEventListener("orientationchange", updatePanelPosition, { passive: true });
}

function ensureFavicon() {
  const href = new URL(FAVICON_PATH, document.baseURI || location.href).href;
  const rels = ["icon", "shortcut icon", "apple-touch-icon"];
  for (const rel of rels) {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", rel);
      document.head.appendChild(link);
    }
    link.setAttribute("href", href);
    link.setAttribute("type", "image/svg+xml");
  }
}

/* ----- Navigation active handling ----- */
function setActiveNav() {
  const key = getCurrentNavKey();

  const links = document.querySelectorAll(".nav a[data-nav]");
  for (const a of links) {
    a.classList.toggle("is-active", a.getAttribute("data-nav") === key);
  }
  syncMobileBottomNavActive(key);
}

/* ----- Header search wiring (Enter => index?q=) ----- */
function wireHeaderSearch() {
  const search = document.querySelector(".header-search #search");
  if (!search || search.dataset.headerSearchWired === "1") return;
  search.dataset.headerSearchWired = "1";

  wireSleeveAutocomplete(search, {
    minChars: AUTOCOMPLETE_MIN_CHARS,
    maxItems: AUTOCOMPLETE_MAX_ITEMS,
    anchorEl: search.closest(".search-wrap")
  });

  search.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (e.defaultPrevented) return;
    const q = search.value.trim();
    recordSearchHistory(q);
    if (!q) { location.href = "./sleeves/"; return; }
    location.href = "./sleeves/?q=" + encodeURIComponent(q);
  });
}

/* ----- Utility to safely get header search (await site:injected) ----- */
async function waitForInjected(timeoutMs = 2000) {
  if (document.getElementById("search")) return document.getElementById("search");
  return new Promise((resolve) => {
    let done = false;
    const onInjected = () => {
      if (done) return;
      done = true;
      resolve(document.getElementById("search"));
    };
    document.addEventListener("site:injected", onInjected, { once: true });
    setTimeout(() => {
      if (done) return;
      done = true;
      resolve(document.getElementById("search"));
    }, timeoutMs);
  });
}

function getDetailIdFromHref(href) {
  try {
    const u = new URL(href, location.href);
    const legacyId = (u.searchParams.get("id") || "").trim();
    if (legacyId) return legacyId;
    const segments = u.pathname.split("/").filter(Boolean);
    const sleeveIndex = segments.findIndex((segment) => segment === "sleeve");
    if (sleeveIndex < 0 || sleeveIndex >= segments.length - 1) return null;
    const id = decodeURIComponent(segments[sleeveIndex + 1] || "").trim();
    return id || null;
  } catch (_) {
    return null;
  }
}

function markSelectedSleeveLinks() {
  let selectedId = null;
  try {
    selectedId = (sessionStorage.getItem(LAST_SELECTED_SLEEVE_ID_KEY) || "").trim();
  } catch (_) {
    selectedId = null;
  }

  const links = document.querySelectorAll('a[data-sleeve-link="1"]');
  for (const a of links) {
    const id = getDetailIdFromHref(a.href);
    a.classList.toggle("is-selected-sleeve", !!selectedId && id === selectedId);
  }
}

function wireSleeveSelectionFeedback() {
  if (__sleeveFeedbackWired) return;
  __sleeveFeedbackWired = true;

  markSelectedSleeveLinks();

  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[data-sleeve-link="1"]') : null;
    if (!a) return;

    const id = getDetailIdFromHref(a.href);
    if (id) {
      try { sessionStorage.setItem(LAST_SELECTED_SLEEVE_ID_KEY, id); } catch (_) { }
    }
    markSelectedSleeveLinks();

    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((a.target || "").toLowerCase() === "_blank") return;

    e.preventDefault();
    a.classList.add("is-picked");
    const href = a.href;
    setTimeout(() => { location.href = href; }, 130);
  }, true);

  if (document.body) {
    const mo = new MutationObserver(() => { markSelectedSleeveLinks(); });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 20000);
  }
}

/* ----- Expose globals ----- */
window.common = {
  escapeHtml,
  toISODate,
  numOrNull,
  readLocalArticles,
  writeLocalArticles,
  getFlowMetrics,
  buildFlowBadgeHtml,
  uniq,
  normalizeSleeveTextValue,
  getSleeveCategoryValues,
  getSleeveCategoryBuckets,
  sleeveMatchesGroup,
  countSleevesByGroup,
  buildSleeveGroupHref,
  collectGroupDetailItems,
  sleeveMatchesDetailTag,
  buildSleeveCategoryHref,
  collectSleeveTypes,
  sleeveMatchesType,
  buildSleeveTypeHref,
  fetchJsonWithTimeout,
  loadData,
  buildSiteHref,
  buildSleeveDetailHref,
  setStructuredData,
  updateItemListStructuredData,
  updateArticleStructuredData,
  buildCategoryNavMarkup,
  renderCategoryNav,
  ensureCategoryNavsRendered,
  injectHeaderFooter,
  injectDashboardChrome,
  injectMobileBottomNav,
  setupDashboardChrome,
  setActiveNav,
  wireHeaderSearch,
  wireDashboardSearch,
  wireSleeveAutocomplete,
  recordSearchHistory,
  wireSleeveSelectionFeedback,
  waitForInjected,
  GAS_URL
};

window.GAS_URL = GAS_URL;

/* ----- Auto-init on DOMContentLoaded ----- */
document.addEventListener("DOMContentLoaded", () => {
  try { ensureFavicon(); } catch (e) { console.error(e); }
  injectHeaderFooter();
  try {
    if (document.getElementById("dashboardSidebarSlot") || document.getElementById("dashboardTopbarSlot")) {
      injectDashboardChrome();
      wireDashboardSearch();
      wireDashboardSidebarCategoryToggle();
      ensureCategoryNavsRendered()
        .then(() => wireDashboardSidebarCategoryToggle())
        .catch(() => {});
    }
  } catch (e) { console.error(e); }

  try {
    const warmCache = () => { loadData().catch(() => {}); };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(warmCache, { timeout: 1200 });
    } else {
      setTimeout(warmCache, 150);
    }
  } catch (e) {
    console.error(e);
  }

  try { setActiveNav(); } catch (e) { console.error(e); }
  try { wireHeaderMenu(); } catch (e) { console.error(e); }
  try { wireHeaderSearch(); } catch (e) { console.error(e); }
  try { wireSleeveSelectionFeedback(); } catch (e) { console.error(e); }

  document.addEventListener("site:injected", () => {
    try { setActiveNav(); } catch (e) { console.error(e); }
    try { wireHeaderMenu(); } catch (e) { console.error(e); }
    try { wireHeaderSearch(); } catch (e) { console.error(e); }
    try { markSelectedSleeveLinks(); } catch (e) { console.error(e); }
  }, { once: true });
});


