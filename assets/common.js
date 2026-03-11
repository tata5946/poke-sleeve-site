/**
 * common.js
 * - header/footer を #site-header / #site-footer に注入
 * - 注入完了時に custom event "site:injected" を発火
 * - setActiveNav(), wireHeaderSearch() を提供
 * - fetchJsonWithTimeout(), loadData() を共通化
 */

/* ----- Config ----- */
const GAS_URL = "https://script.google.com/macros/s/AKfycbxhonFM8hQmpcc3BzAoWVBMjHJbIU1i0QpxdqN9u9x7Gbyg8cLfgRb2Fiw7M-W7qz5Z/exec";
const FAVICON_PATH = "./assets/favicon.svg";
const DATA_CACHE_KEY = "pokeSleeve:dataCache:v1";
const DATA_CACHE_TTL_MS = 60 * 1000;
const LAST_SELECTED_SLEEVE_ID_KEY = "pokeSleeve:lastSelectedId";
const AUTOCOMPLETE_MIN_CHARS = 1;
const AUTOCOMPLETE_MAX_ITEMS = 8;
let __dataCacheMem = null;
let __dataCachePromise = null;
let __sleeveFeedbackWired = false;
let __headerOffsetWired = false;
let __autocompleteIndexPromise = null;

/* ----- Header / Footer HTML ----- */
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
        <span class="search-ico">🔎</span>
        <input type="text" id="search" placeholder="スリーブ名で検索..." autocomplete="off" />
      </div>
    </div>
    <div class="header-right">
      <a href="./policy.html">ポリシー</a>
    </div>
  </div>
  <div class="header-bottom">
    <div class="header-bottom-inner">
      <nav class="nav" aria-label="メインメニュー">
        <a href="./index.html" data-nav="index"><span class="ico" aria-hidden="true">🏠</span>ホーム</a>
        <a href="./zukan.html" data-nav="zukan"><span class="ico" aria-hidden="true">📚</span>図鑑</a>
        <a href="./ranking.html" data-nav="ranking"><span class="ico" aria-hidden="true">📊</span>価格ランキング</a>
        <a href="./growth.html" data-nav="growth"><span class="ico" aria-hidden="true">📈</span>高騰率</a>
        <a href="./surge.html" data-nav="surge"><span class="ico" aria-hidden="true">🔥</span>急上昇</a>
        <a href="./index-market.html" data-nav="market"><span class="ico" aria-hidden="true">🧭</span>スリーブ指数</a>
        <a href="./contact.html" data-nav="contact"><span class="ico" aria-hidden="true">✉️</span>お問い合わせ</a>
      </nav>
    </div>
  </div>
</div>
`;

const FOOTER_HTML = `
<footer class="site-footer">
  &copy; 2026 ポケスリ相場ナビ |
  <a href="./policy.html">プライバシーポリシー・免責事項</a>
</footer>
`;

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

function uniq(arr) {
  const s = new Set();
  for (const v of arr) {
    const t = (v == null) ? "" : String(v).trim();
    if (t) s.add(t);
  }
  return Array.from(s);
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[‐‑‒–—―ーｰ\-_.・･]/g, "");
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
          nameNorm: normalizeSearchText(name),
          detailHref: `./detail.html?id=${encodeURIComponent(id)}`,
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
  const q = normalizeSearchText(query);
  if (!q) return [];

  const starts = [];
  const contains = [];
  for (const item of indexItems) {
    const pos = item.nameNorm.indexOf(q);
    if (pos < 0) continue;
    if (pos === 0) starts.push(item);
    else contains.push({ item, pos });
  }

  starts.sort((a, b) => {
    if (a.nameNorm.length !== b.nameNorm.length) return a.nameNorm.length - b.nameNorm.length;
    return a.name.localeCompare(b.name, "ja");
  });

  contains.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    if (a.item.nameNorm.length !== b.item.nameNorm.length) return a.item.nameNorm.length - b.item.nameNorm.length;
    return a.item.name.localeCompare(b.item.name, "ja");
  });

  const merged = starts.concat(contains.map((x) => x.item));
  return merged.slice(0, Math.max(1, maxItems));
}

function defaultNavigateToDetail(item) {
  if (!item || !item.id) return;
  try { sessionStorage.setItem(LAST_SELECTED_SLEEVE_ID_KEY, item.id); } catch (_) { }
  location.href = item.detailHref || (`./detail.html?id=${encodeURIComponent(item.id)}`);
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

  const close = () => {
    open = false;
    activeIndex = -1;
    currentItems = [];
    list.hidden = true;
    list.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };

  const openList = () => {
    open = true;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
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
    if (!currentItems.length) {
      close();
      return;
    }

    const frag = document.createDocumentFragment();
    for (let i = 0; i < currentItems.length; i += 1) {
      const item = currentItems[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "search-suggest-item";
      btn.id = `${listId}-opt-${i}`;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", i === activeIndex ? "true" : "false");
      btn.innerHTML = `
        <span class="search-suggest-main">
          <span class="search-suggest-name">${escapeHtml(item.name)}</span>
          <span class="search-suggest-meta">${item.latestPrice == null ? "" : `${Number(item.latestPrice).toLocaleString()}円`}</span>
        </span>
      `;
      btn.addEventListener("mouseenter", () => setActive(i));
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const onPick = typeof options.onPick === "function" ? options.onPick : defaultNavigateToDetail;
        onPick(item);
      });
      frag.appendChild(btn);
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

function readSessionCache() {
  try {
    const raw = sessionStorage.getItem(DATA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Number.isFinite(parsed.cachedAt)) return null;
    if ((Date.now() - parsed.cachedAt) > DATA_CACHE_TTL_MS) return null;
    return parsed.data ?? null;
  } catch (_) {
    return null;
  }
}

function writeSessionCache(data) {
  try {
    sessionStorage.setItem(DATA_CACHE_KEY, JSON.stringify({
      cachedAt: Date.now(),
      data
    }));
  } catch (_) { }
}

/* ----- central loadData() ----- */
async function loadData({ forceRefresh = false, ttlMs = DATA_CACHE_TTL_MS } = {}) {
  if (!GAS_URL || GAS_URL.includes("PASTE_YOUR_WEB_APP_URL_HERE")) {
    throw new Error("GAS_URL が未設定です。assets/common.js の GAS_URL を確認してください。");
  }

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
  }

  if (!forceRefresh && __dataCachePromise) {
    return await __dataCachePromise;
  }

  __dataCachePromise = (async () => {
    const data = await fetchJsonWithTimeout(GAS_URL, { timeoutMs: 12000, cacheMode: "default" });
    __dataCacheMem = { cachedAt: Date.now(), data };
    writeSessionCache(data);
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
    if (headSlot) headSlot.innerHTML = HEADER_HTML;

    const footSlot = document.getElementById("site-footer");
    if (footSlot) footSlot.innerHTML = FOOTER_HTML;

    wireHeaderOffsetSync();
    syncHeaderOffset();
    requestAnimationFrame(syncHeaderOffset);
    setTimeout(syncHeaderOffset, 120);
  } catch (e) {
    console.error("injectHeaderFooter error", e);
  } finally {
    document.dispatchEvent(new CustomEvent("site:injected"));
  }
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

function ensureFavicon() {
  const href = new URL(FAVICON_PATH, location.href).href;
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
  const path = (location.pathname.split("/").pop() || "").toLowerCase();
  let key = "index";
  if (path.includes("ranking")) key = "ranking";
  else if (path.includes("zukan")) key = "zukan";
  else if (path.includes("growth")) key = "growth";
  else if (path.includes("surge")) key = "surge";
  else if (path.includes("market")) key = "market";
  else if (path.includes("contact")) key = "contact";
  else if (path.includes("detail")) key = "zukan";
  else if (path === "" || path === "index.html") key = "index";

  const links = document.querySelectorAll(".nav a[data-nav]");
  for (const a of links) {
    a.classList.toggle("is-active", a.getAttribute("data-nav") === key);
  }
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
    if (!q) { location.href = "./zukan.html"; return; }
    location.href = "./zukan.html?q=" + encodeURIComponent(q);
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
    const filename = (u.pathname.split("/").pop() || "").toLowerCase();
    if (filename !== "detail.html") return null;
    const id = (u.searchParams.get("id") || "").trim();
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

  const links = document.querySelectorAll('a[href*="detail.html?id="]');
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
    const a = e.target && e.target.closest ? e.target.closest('a[href*="detail.html?id="]') : null;
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
  uniq,
  fetchJsonWithTimeout,
  loadData,
  injectHeaderFooter,
  setActiveNav,
  wireHeaderSearch,
  wireSleeveAutocomplete,
  wireSleeveSelectionFeedback,
  waitForInjected,
  GAS_URL
};

window.GAS_URL = GAS_URL;

/* ----- Auto-init on DOMContentLoaded ----- */
document.addEventListener("DOMContentLoaded", () => {
  try { ensureFavicon(); } catch (e) { console.error(e); }
  injectHeaderFooter();

  try { setActiveNav(); } catch (e) { console.error(e); }
  try { wireHeaderSearch(); } catch (e) { console.error(e); }
  try { wireSleeveSelectionFeedback(); } catch (e) { console.error(e); }

  document.addEventListener("site:injected", () => {
    try { setActiveNav(); } catch (e) { console.error(e); }
    try { wireHeaderSearch(); } catch (e) { console.error(e); }
    try { markSelectedSleeveLinks(); } catch (e) { console.error(e); }
  }, { once: true });
});
