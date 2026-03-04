/* common.js
 - inject header/footer into #site-header / #site-footer
 - provide setActiveNav(), wireHeaderSearch()
 - provide fetchJsonWithTimeout() and loadData() with central GAS_URL
 - expose utility helpers used across pages
*/

/* ----- Config ----- */
// ここに Apps Script Webアプリ URL を一度だけ書いておく（各ページから個別に書かなくてOK）
const GAS_URL = "https://script.google.com/macros/s/AKfycbyl-TAhWBEVIgilTDv7lwS14T3_i9z57dUX4fqUVBS9gyr1EO7SaYy3aqP0V1gZtt6z/exec";

/* ----- Header / Footer HTML ----- */
/* 必要ならここをテンプレ化してロゴやリンクを書き換えてください */
const HEADER_HTML = `
  <div class="header">
    <div class="header-top">
      <a href="./index.html" class="brand">
        <div class="logo" aria-hidden="true"></div>
        <div>
          <h1 class="main-title"><span class="accent">ポケスリ</span>相場ナビ</h1>
        </div>
      </a>

      <div class="header-search" aria-label="サイト内検索">
        <div class="search-wrap">
          <span class="search-ico">🔍</span>
          <input type="text" id="search" placeholder="スリーブ名で検索…" autocomplete="off" />
        </div>
      </div>

      <div class="header-right">
        <a href="./policy.html">ポリシー</a>
      </div>
    </div>

    <div class="header-bottom">
      <div class="header-bottom-inner">
        <nav class="nav" aria-label="メインメニュー">
          <a href="./index.html" data-nav="index"><span class="ico" aria-hidden="true">🏷</span>一覧</a>
          <a href="./ranking.html" data-nav="ranking"><span class="ico" aria-hidden="true">🏆</span>価格ランキング</a>
          <a href="./growth.html" data-nav="growth"><span class="ico" aria-hidden="true">📈</span>高騰率</a>
          <a href="./surge.html" data-nav="surge"><span class="ico" aria-hidden="true">⚡</span>急上昇</a>
          <a href="./index-market.html" data-nav="market"><span class="ico" aria-hidden="true">📊</span>スリーブ指数</a>
        </nav>
      </div>
    </div>
  </div>
`;

const FOOTER_HTML = `
  <footer class="site-footer">
    <div class="container">
      © 2026 ポケスリ相場ナビ |
      <a href="./policy.html">プライバシーポリシー・免責事項</a>
    </div>
  </footer>
`;

/* ----- Utilities exposed globally ----- */
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
function uniq(arr) {
    const s = new Set();
    for (const v of arr) {
        const t = (v == null) ? "" : String(v).trim();
        if (t) s.add(t);
    }
    return Array.from(s);
}

/* fetch with timeout helper */
async function fetchJsonWithTimeout(url, { timeoutMs = 12000 } = {}) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            cache: "no-store",
            signal: controller.signal,
            headers: { "Accept": "application/json" }
        });
        if (!res.ok) throw new Error(`データ取得に失敗しました（HTTP ${res.status}）`);
        return await res.json();
    } catch (e) {
        if (e && e.name === "AbortError") throw new Error("データ取得がタイムアウトしました。時間をおいて再度お試しください。");
        throw e;
    } finally {
        clearTimeout(t);
    }
}

/* central loadData(): pages call window.loadData() */
async function loadData() {
    if (!GAS_URL || GAS_URL.includes("PASTE_YOUR_WEB_APP_URL_HERE")) {
        throw new Error("GAS_URL が未設定です。common.js の GAS_URL を確認してください。");
    }
    const url = GAS_URL + "?v=" + Date.now();
    return await fetchJsonWithTimeout(url, { timeoutMs: 12000 });
}

/* ----- Header/Footer injection and wiring ----- */
function injectHeaderFooter() {
    try {
        const headSlot = document.getElementById("site-header");
        if (headSlot) headSlot.innerHTML = HEADER_HTML;

        const footSlot = document.getElementById("site-footer");
        if (footSlot) footSlot.innerHTML = FOOTER_HTML;
    } catch (e) {
        // non-fatal
        console.error("injectHeaderFooter error", e);
    }
}

/* setActiveNav: path -> data-nav key */
function setActiveNav() {
    const path = (location.pathname.split("/").pop() || "").toLowerCase();
    let key = "index";
    if (path.includes("ranking")) key = "ranking";
    else if (path.includes("growth")) key = "growth";
    else if (path.includes("surge")) key = "surge";
    else if (path.includes("market")) key = "market";
    else if (path.includes("detail")) key = "index";
    else if (path === "" || path === "index.html") key = "index";

    const links = document.querySelectorAll(".nav a[data-nav]");
    for (const a of links) a.classList.toggle("is-active", a.getAttribute("data-nav") === key);
}

/* header search behavior: Enter => index.html?q=... (same as pages expect) */
function wireHeaderSearch() {
    const search = document.querySelector(".header-search #search");
    if (!search) return;
    search.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        const q = search.value.trim();
        if (!q) { location.href = "./index.html"; return; }
        location.href = "./index.html?q=" + encodeURIComponent(q);
    });
}

/* expose globally and init */
window.common = {
    escapeHtml,
    toISODate,
    numOrNull,
    uniq,
    fetchJsonWithTimeout,
    loadData
};

document.addEventListener("DOMContentLoaded", () => {
    injectHeaderFooter();
    setActiveNav();
    wireHeaderSearch();

    // If pages need header search input immediately, focus logic or prefill q param can go here.
});