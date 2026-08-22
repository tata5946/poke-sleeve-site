const GAS_URL = "PASTE_YOUR_WEB_APP_URL_HERE";

    // -----------------------------
    // utils
    // -----------------------------
    function escapeHtml(str) {
      return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function showError(msg) {
      const el = document.getElementById("error");
      if (!el) return;
      el.style.display = "block";
      el.textContent = msg;
    }

    function hideError() {
      const el = document.getElementById("error");
      if (!el) return;
      el.style.display = "none";
      el.textContent = "";
    }

    function uniq(arr) {
      const s = new Set();
      for (const v of arr) {
        const t = (v == null) ? "" : String(v).trim();
        if (t) s.add(t);
      }
      return Array.from(s);
    }

    function parseBand(v) {
      if (!v) return null;
      const [a, b] = v.split("-").map(Number);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return { min: a, max: b };
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
        if (e && e.name === "AbortError") {
          throw new Error("データ取得がタイムアウトしました。時間をおいて再度お試しください。");
        }
        throw e;
      } finally {
        clearTimeout(t);
      }
    }

    async function loadData() {
      if (!GAS_URL || GAS_URL.includes("PASTE_YOUR_WEB_APP_URL_HERE")) {
        throw new Error("GAS_URL が未設定です。index.html の GAS_URL に WebアプリURL を貼ってください。");
      }
      const url = GAS_URL + "?v=" + Date.now();
      return await fetchJsonWithTimeout(url, { timeoutMs: 12000 });
    }

    // -----------------------------
    // weekly logic
    // -----------------------------
    function getWeeklyPair(sleeve) {
      const arr = Array.isArray(sleeve.weeklyPrices) ? sleeve.weeklyPrices : [];
      if (arr.length === 0) return null;

      const map = new Map();

      for (const x of arr) {
        const weekISO = toISODate(x.week);
        if (!weekISO) continue;

        const price = numOrNull(x.price);
        const count = numOrNull(x.count);

        const hasTrade = (price != null && price > 0);
        if (!hasTrade) continue;

        map.set(weekISO, { week: weekISO, price, count: count == null ? null : count });
      }

      if (map.size === 0) return null;

      const sorted = Array.from(map.values()).sort((a, b) => a.week.localeCompare(b.week));
      const latest = sorted[sorted.length - 1];
      const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

      return { latest, prev, sorted };
    }

    function getLatestWeeklyPrice(s) {
      const pair = getWeeklyPair(s);
      return pair ? pair.latest.price : null;
    }

    function getGlobalLatestTradeWeek(sleeves) {
      let maxWeek = null;
      for (const s of (Array.isArray(sleeves) ? sleeves : [])) {
        const p = getWeeklyPair(s);
        if (!p) continue;
        const w = String(p.latest.week || "");
        if (!w) continue;
        if (!maxWeek || w > maxWeek) maxWeek = w;
      }
      return maxWeek;
    }

    function getTotalTradeCount(sleeve) {
      const arr = Array.isArray(sleeve.weeklyPrices) ? sleeve.weeklyPrices : [];
      let sum = 0;
      let hasAny = false;

      for (const x of arr) {
        const c = numOrNull(x.count);
        if (Number.isFinite(c) && c > 0) {
          sum += c;
          hasAny = true;
        }
      }
      return hasAny ? sum : null;
    }

    function formatDelta(pair) {
      if (!pair) {
        return `<div class="delta"><span class="flat">直近の取引なし</span></div>`;
      }

      const { latest, prev } = pair;

      if (!prev) {
        const cntText = Number.isFinite(latest.count) ? ` / ${latest.count}件` : "";
        return `
          <div class="delta">
            <span class="flat">比較できる前回データなし</span>
            <span class="chip">直近 ${latest.price.toLocaleString()}円${cntText}</span>
          </div>
        `;
      }

      const diff = latest.price - prev.price;

      const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
      const abs = Math.abs(diff);

      let cls = "flat";
      let arrow = "→";
      if (diff > 0) { cls = "up"; arrow = "↑"; }
      if (diff < 0) { cls = "down"; arrow = "↓"; }

      let pct = "";
      if (prev.price !== 0) {
        const rate = (diff / prev.price) * 100;
        if (Number.isFinite(rate)) {
          const r = Math.abs(rate).toFixed(1);
          pct = `（${diff > 0 ? "+" : diff < 0 ? "-" : ""}${r}%）`;
        }
      }

      const prevCnt = Number.isFinite(prev.count) ? `${prev.count}件` : "—";
      const latestCnt = Number.isFinite(latest.count) ? `${latest.count}件` : "—";

      return `
        <div class="delta">
          <span class="delta-main ${cls}">${arrow} 前回取引週比 ${sign}${abs.toLocaleString()}円 ${escapeHtml(pct)}</span>
          <span class="chip">前回 ${prev.price.toLocaleString()}円 / ${prevCnt}</span>
          <span class="chip">直近 ${latest.price.toLocaleString()}円 / ${latestCnt}</span>
        </div>
      `;
    }

    // -----------------------------
    // growth (30日) helper
    // -----------------------------
    function isoToDate(iso) {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    function addDays(iso, days) {
      const d = isoToDate(iso);
      if (!d) return null;
      d.setDate(d.getDate() + days);
      return toISODate(d);
    }

    function getPriceAtOrBefore(sorted, targetISO) {
      if (!sorted || sorted.length === 0) return null;
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].week <= targetISO) return sorted[i];
      }
      return null;
    }

    function get30dGrowth(sleeve, latestWeek = null) {
      const pair = getWeeklyPair(sleeve);
      if (!pair) return null;
      const latest = pair.latest;
      if (latestWeek && latest.week !== latestWeek) return null;
      const sorted = pair.sorted;

      const targetISO = addDays(latest.week, -30);
      if (!targetISO) return null;

      const base = getPriceAtOrBefore(sorted, targetISO);
      if (!base || !Number.isFinite(base.price) || base.price === 0) return null;

      const diff = latest.price - base.price;
      const rate = (diff / base.price) * 100;
      if (!Number.isFinite(rate)) return null;

      return { latest, base, diff, rate };
    }

    // -----------------------------
    // rail (UI)
    // -----------------------------
    function scrollRail(id, dir = 1) {
      const el = document.getElementById(id);
      if (!el) return;
      const step = Math.max(280, Math.floor(el.clientWidth * 0.85));
      el.scrollBy({ left: dir * step, behavior: "smooth" });
    }

    function wireRailButtons() {
      const btns = document.querySelectorAll(".rail-btn");
      for (const b of btns) {
        b.addEventListener("click", () => {
          const railId = b.getAttribute("data-rail");
          const dir = b.classList.contains("left") ? -1 : 1;
          scrollRail(railId, dir);
        });
      }
    }

    function buildTileHTML(s, subHtml, chipsHtml, rank = null, popIndex = 0) {
      const imgSrc = String(s.imageUrl || "").trim();
      const img = imgSrc
        ? `<img class="tile-img" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(s.name ?? "")}" loading="lazy" referrerpolicy="no-referrer"
             onerror="this.onerror=null; this.style.display='none';">`
        : `<div class="tile-img"></div>`;
      const rankBadge = Number.isFinite(rank) ? `<span class="tile-rank-badge">${rank}位</span>` : "";
      const delay = Number.isFinite(popIndex) ? Math.max(0, popIndex) : 0;

      return `
        <a class="tile tile-pop" style="--pop-delay:${delay};" href="./detail.html?id=${encodeURIComponent(s.id ?? "")}" aria-label="${escapeHtml(s.name ?? "")}">
          ${rankBadge}
          ${img}
          <div class="tile-name">${escapeHtml(s.name ?? "")}</div>
          ${subHtml}
          <div class="chipline">${chipsHtml}</div>
        </a>
      `;
    }

    function runHeroIntro() {
      const heroMain = document.querySelector(".home-hero-main");
      if (!heroMain) return;
      document.body.classList.add("js-hero-anim");
      const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        heroMain.classList.add("is-enter");
        return;
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => heroMain.classList.add("is-enter"));
      });
    }

    let __headerTabVisibilityWired = false;
    function setupHeaderTabVisibility() {
      if (__headerTabVisibilityWired) return;
      __headerTabVisibilityWired = true;
      const hero = document.querySelector(".home-hero");
      if (!hero) return;
      document.body.classList.add("home-header-hidden");
      const apply = (showHeader) => document.body.classList.toggle("home-header-hidden", !showHeader);
      let rafId = null;
      let shown = false;
      const hysteresis = 56;
      const update = () => {
        rafId = null;
        const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--site-header-h")) || 64;
        const heroBottomY = hero.offsetTop + hero.offsetHeight;
        const showAtY = Math.max(0, heroBottomY - headerH);
        const hideAtY = Math.max(0, showAtY - hysteresis);
        const y = window.scrollY || window.pageYOffset || 0;
        if (!shown && y >= showAtY) { shown = true; apply(true); return; }
        if (shown && y <= hideAtY) { shown = false; apply(false); }
      };
      const onScrollLike = () => {
        if (rafId != null) return;
        rafId = requestAnimationFrame(update);
      };
      window.addEventListener("scroll", onScrollLike, { passive: true });
      window.addEventListener("resize", onScrollLike, { passive: true });
      onScrollLike();
    }

    function setupRankingReveal() {
      const sections = Array.from(document.querySelectorAll(".sections .section"));
      if (!sections.length) return;
      document.body.classList.add("js-rank-anim");
      const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced || !("IntersectionObserver" in window)) {
        sections.forEach((section) => section.classList.add("is-inview"));
        return;
      }
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.18) return;
          entry.target.classList.add("is-inview");
          observer.unobserve(entry.target);
        });
      }, { threshold: [0, 0.18, 0.25], rootMargin: "0px 0px -6% 0px" });
      sections.forEach((section) => observer.observe(section));
    }

    function setRankingLoadingState(mode, message = "") {
      const root = document.getElementById("rankingSections");
      const status = document.getElementById("rankingStatus");
      if (!root) return;
      root.classList.remove("is-loading", "is-ready", "is-error");
      root.classList.add(`is-${mode}`);
      root.setAttribute("aria-busy", mode === "loading" ? "true" : "false");
      if (!status) return;
      if (mode === "error") {
        status.hidden = false;
        status.textContent = message || "ランキングデータを表示できません。";
      } else {
        status.hidden = true;
        status.textContent = "";
      }
    }

    function hideIfEmpty(sectionEl, railEl, hasRows) {
      if (!sectionEl || !railEl) return false;
      sectionEl.hidden = !hasRows;
      if (!hasRows) railEl.innerHTML = "";
      return !!hasRows;
    }

    // -----------------------------
    // main
    // -----------------------------
    async function main() {
      // header差し込みが遅いと #search が無いことがあるので待つ
      const waitForSearch = async () => {
        for (let i = 0; i < 20; i++) {
          const s = document.getElementById("search");
          if (s) return s;
          await new Promise(r => setTimeout(r, 50));
        }
        return null;
      };

      setRankingLoadingState("loading");
      wireRailButtons();

      let data;
      try {
        data = await loadData();
      } catch (e) {
        setRankingLoadingState("error", "ランキングデータの読み込みに失敗しました。");
        showError(e.message || "不明なエラーが発生しました");
        return;
      }
      hideError();

      const sleeves = Array.isArray(data.sleeves) ? data.sleeves : [];
      const latestWeek = getGlobalLatestTradeWeek(sleeves);

      // ★URLクエリ ?q= を検索に反映（detail/index-market から戻る導線用）
      const url = new URL(location.href);
      const qParam = (url.searchParams.get("q") || "").trim();

      // searchInput は header 由来
      const searchInput = document.getElementById("search") || await waitForSearch();
      const heroSearchInput = document.getElementById("heroSearch");
      if (!searchInput) {
        showError("検索欄の初期化に失敗しました（headerが読み込めていません）");
        return;
      }
      if (qParam) searchInput.value = qParam;
      if (qParam && heroSearchInput) heroSearchInput.value = qParam;
      if (heroSearchInput) {
        heroSearchInput.addEventListener("input", () => {
          searchInput.value = heroSearchInput.value;
        });
      }
      const heroSearchForm = document.getElementById("heroSearchForm");
      if (heroSearchForm && heroSearchInput) {
        heroSearchForm.addEventListener("submit", (ev) => {
          ev.preventDefault();
          searchInput.value = heroSearchInput.value.trim();
          render();
          const target = document.querySelector(".main");
          if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }

      // セレクト初期化
      const releaseYearSel = document.getElementById("releaseYear");
      const seriesSel = document.getElementById("series");
      const priceBandSel = document.getElementById("priceBand");
      const sortOrderSel = document.getElementById("sortOrder");
      const clearBtn = document.getElementById("clear");
      const list = document.getElementById("list");

      const releaseYears = uniq(sleeves.map(s => s.releaseYear)).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
      const seriesList = uniq(sleeves.map(s => s.series)).sort();

      for (const y of releaseYears) {
        const opt = document.createElement("option");
        opt.value = String(y);
        opt.textContent = String(y);
        releaseYearSel.appendChild(opt);
      }
      for (const ser of seriesList) {
        const opt = document.createElement("option");
        opt.value = ser;
        opt.textContent = ser;
        seriesSel.appendChild(opt);
      }

      // ---- 棚データ作成 ----
      const priceRank = sleeves
        .map(s => ({ s, p: getLatestWeeklyPrice(s) }))
        .filter(x => x.p != null)
        .sort((a, b) => (b.p - a.p))
        .slice(0, 10)
        .map(x => x.s);

      const surgeRank = sleeves
        .map(s => {
          const pair = getWeeklyPair(s);
          if (!pair || !pair.prev) return null;
          if (latestWeek && pair.latest.week !== latestWeek) return null;
          const diff = pair.latest.price - pair.prev.price;
          return { s, pair, diff };
        })
        .filter(x => x && x.diff > 0)
        .sort((a, b) => b.diff - a.diff)
        .slice(0, 10);

      const growthRank = sleeves
        .map(s => {
          const g = get30dGrowth(s, latestWeek);
          if (!g) return null;
          return { s, g };
        })
        .filter(Boolean)
        .sort((a, b) => b.g.rate - a.g.rate)
        .slice(0, 10);

      // ---- 棚描画 ----
      const railSurge = document.getElementById("rail-surge");
      const railGrowth = document.getElementById("rail-growth");
      const railPrice = document.getElementById("rail-price");
      const sectionSurge = document.getElementById("section-surge");
      const sectionGrowth = document.getElementById("section-growth");
      const sectionPrice = document.getElementById("section-price");
      const rankingRoot = document.getElementById("rankingSections");

      railSurge.innerHTML = surgeRank.length ? surgeRank.map(({ s, pair, diff }, i) => {
        const cls = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
        const sign = diff > 0 ? "+" : diff < 0 ? "-" : "0";
        const pct = (pair.prev.price !== 0) ? ((diff / pair.prev.price) * 100) : null;
        const pctText = (pct == null || !Number.isFinite(pct)) ? "" : `(${pct.toFixed(1)}%)`;

        const subHtml = `
          <p class="tile-price">${pair.latest.price.toLocaleString()}円</p>
          <p class="tile-sub"><span class="${cls}">前回比 ${sign}${Math.abs(diff).toLocaleString()}円</span> ${escapeHtml(pctText)}</p>
        `;

        const chipsHtml = `
          <span class="chip">最新 ${pair.latest.week}</span>
          <span class="chip">前回 ${pair.prev.week}</span>
        `;
        return buildTileHTML(s, subHtml, chipsHtml, i + 1, i);
      }).join("") : "";

      railGrowth.innerHTML = growthRank.length ? growthRank.map(({ s, g }, i) => {
        const cls = g.diff > 0 ? "up" : g.diff < 0 ? "down" : "flat";
        const sign = g.diff > 0 ? "+" : g.diff < 0 ? "-" : "0";
        const rateAbs = Math.abs(g.rate).toFixed(1);

        const subHtml = `
          <p class="tile-price">${g.latest.price.toLocaleString()}円</p>
          <p class="tile-sub"><span class="${cls}">30日 ${sign}${Math.abs(g.diff).toLocaleString()}円</span>（${g.diff > 0 ? "+" : g.diff < 0 ? "-" : ""}${rateAbs}%）</p>
        `;

        const chipsHtml = `
          <span class="chip">基準 ${g.base.week}</span>
          <span class="chip">最新 ${g.latest.week}</span>
        `;
        return buildTileHTML(s, subHtml, chipsHtml, i + 1, i);
      }).join("") : "";

      railPrice.innerHTML = priceRank.length ? priceRank.map((s, i) => {
        const pair = getWeeklyPair(s);
        const p = pair ? pair.latest.price : null;
        const subHtml = `
          <p class="tile-price">${(p == null) ? "—" : `${p.toLocaleString()}円`}</p>
          <p class="tile-sub">${pair ? `直近 ${pair.latest.week}` : "直近データなし"}</p>
        `;
        const totalTrades = getTotalTradeCount(s);
        const chipsHtml = `
          <span class="chip">取引回数 ${totalTrades == null ? "—" : totalTrades.toLocaleString() + "件"}</span>
          <span class="chip">発売年 ${escapeHtml(s.releaseYear ?? "—")}</span>
        `;
        return buildTileHTML(s, subHtml, chipsHtml, i + 1, i);
      }).join("") : "";

      const shownSurge = hideIfEmpty(sectionSurge, railSurge, surgeRank.length > 0);
      const shownGrowth = hideIfEmpty(sectionGrowth, railGrowth, growthRank.length > 0);
      const shownPrice = hideIfEmpty(sectionPrice, railPrice, priceRank.length > 0);
      const hasRankingData = shownSurge || shownGrowth || shownPrice;
      if (rankingRoot) rankingRoot.hidden = !hasRankingData;
      setRankingLoadingState(hasRankingData ? "ready" : "error", hasRankingData ? "" : "ランキングデータがありません。");

      // ---- 一覧（検索・絞り込み） ----
      function getCardPrice(s) {
        return getLatestWeeklyPrice(s);
      }

      function render() {
        const kw = searchInput.value.trim().toLowerCase();
        const releaseYear = releaseYearSel.value;
        const series = seriesSel.value;
        const band = parseBand(priceBandSel.value);
        const sortOrder = sortOrderSel.value;

        list.innerHTML = "";

        const filtered = [];
        for (const s of sleeves) {
          if (kw && !String(s.name || "").toLowerCase().includes(kw)) continue;
          if (releaseYear && String(s.releaseYear ?? "") !== releaseYear) continue;
          if (series && String(s.series || "") !== series) continue;

          if (band) {
            const p = getCardPrice(s);
            if (p == null) continue;
            if (p < band.min || p > band.max) continue;
          }
          filtered.push(s);
        }

        filtered.sort((a, b) => {
          const pa = getCardPrice(a) ?? -1;
          const pb = getCardPrice(b) ?? -1;

          switch (sortOrder) {
            case "priceAsc": return pa - pb;
            case "nameAsc": return String(a.name ?? "").localeCompare(String(b.name ?? ""));
            case "releaseDesc": return (Number(b.releaseYear) || 0) - (Number(a.releaseYear) || 0);
            default: return pb - pa;
          }
        });

        if (filtered.length === 0) {
          list.innerHTML = `<div class="card"><div class="title">該当なし</div><div class="meta">条件に一致するスリーブがありません</div></div>`;
          return;
        }

        const frag = document.createDocumentFragment();

        for (const s of filtered) {
          const p = getCardPrice(s);
          const priceText = (p == null) ? "—" : `${p.toLocaleString()}円`;

          const weeklyPair = getWeeklyPair(s);
          const weeklyHtml = formatDelta(weeklyPair);

          const totalTrades = getTotalTradeCount(s);
          const totalTradesText = (totalTrades == null) ? "—" : `${totalTrades.toLocaleString()}件`;

          const imgSrc = String(s.imageUrl || "").trim();
          const detailHref = `./detail.html?id=${encodeURIComponent(s.id ?? "")}`;
          const imgHtml = imgSrc
            ? `<a class="thumb-link" href="${detailHref}" aria-label="${escapeHtml(s.name ?? "")}の詳細を見る"><img class="thumb" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(s.name ?? "")}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null; this.style.display='none';"></a>`
            : "";

          const div = document.createElement("div");
          div.className = "card";
          div.innerHTML = `
            ${imgHtml}
            <div class="title">${escapeHtml(s.name ?? "")}</div>

            <div class="price">${escapeHtml(priceText)} <span class="meta">（最新週次）</span></div>

            ${weeklyHtml}

            <div class="badges">
              <span class="badge">総取引：${escapeHtml(totalTradesText)}</span>
              <span class="badge">発売年：${escapeHtml(s.releaseYear ?? "")}</span>
              <span class="badge">${escapeHtml(s.condition ?? "")}</span>
              <span class="badge">${escapeHtml(s.series ?? "")}</span>
            </div>

            <a class="btn" href="${detailHref}">価格推移を見る →</a>
          `;
          frag.appendChild(div);
        }

        list.appendChild(frag);
      }

      // イベント（入力は軽くデバウンス）
      let t = null;
      searchInput.addEventListener("input", () => {
        if (heroSearchInput) heroSearchInput.value = searchInput.value;
        clearTimeout(t);
        t = setTimeout(render, 80);
      });

      releaseYearSel.addEventListener("change", render);
      seriesSel.addEventListener("change", render);
      priceBandSel.addEventListener("change", render);
      sortOrderSel.addEventListener("change", render);

      clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        if (heroSearchInput) heroSearchInput.value = "";
        releaseYearSel.value = "";
        seriesSel.value = "";
        priceBandSel.value = "";
        sortOrderSel.value = "priceDesc";
        render();
      });

      render();
    }

    runHeroIntro();
    document.addEventListener("site:injected", setupHeaderTabVisibility, { once: true });
    setupHeaderTabVisibility();
    setupRankingReveal();
    main();
