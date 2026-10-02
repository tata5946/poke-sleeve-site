// The ranking cards and filter options are generated into the HTML at build time.
// JavaScript only filters existing cards; it never fetches or replaces ranking data.
(() => {
  const year = document.getElementById("releaseYear");
  const series = document.getElementById("series");
  const priceBand = document.getElementById("priceBand");
  const clear = document.getElementById("clear");
  const chips = document.getElementById("activeFilters");
  const mobileCards = [...document.querySelectorAll("[data-access-mobile-item]")];
  const desktopCards = [...document.querySelectorAll("[data-static-ranking-item]")];
  const fields = { releaseYear: year, series, priceBand };

  function applyFilters() {
    const band = priceBand.value ? priceBand.value.split("-").map(Number) : null;
    function matches(card) {
      if (year.value && card.dataset.releaseYear !== year.value) return false;
      if (series.value && card.dataset.series !== series.value) return false;
      if (band) {
        if (!card.dataset.rankingCurrent) return false;
        const price = Number(card.dataset.rankingCurrent);
        if (!Number.isFinite(price) || price < band[0] || price > band[1]) return false;
      }
      return true;
    }
    for (const card of [...mobileCards, ...desktopCards]) card.hidden = !matches(card);
    for (const id of ["top1", "top2", "top3Card", "top3", "restSection"]) {
      const section = document.getElementById(id);
      section.hidden = ![...section.querySelectorAll("[data-static-ranking-item]")].some(card => !card.hidden);
    }
    const count = mobileCards.filter(card => !card.hidden).length;
    document.getElementById("countInfo").textContent = `${count}件`;
    document.getElementById("accessRankingEmpty").hidden = count > 0;
    chips.replaceChildren();
    for (const [key, field] of Object.entries(fields)) {
      if (!field.value) continue;
      const label = field.options[field.selectedIndex].textContent;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ranking-filter-chip";
      button.setAttribute("aria-label", `${label} を解除`);
      button.textContent = label;
      const remove = document.createElement("span");
      remove.className = "ranking-filter-chip-remove";
      remove.setAttribute("aria-hidden", "true");
      remove.textContent = "×";
      button.appendChild(remove);
      button.addEventListener("click", () => { field.value = ""; applyFilters(); });
      chips.appendChild(button);
    }
    const hasFilters = Object.values(fields).some(field => field.value);
    chips.classList.toggle("is-visible", hasFilters);
    clear.classList.toggle("has-filters", hasFilters);
  }

  for (const field of Object.values(fields)) field.addEventListener("change", applyFilters);
  clear.addEventListener("click", () => {
    for (const field of Object.values(fields)) field.value = "";
    applyFilters();
  });
  applyFilters();
  window.common.setupDashboardChrome({ sidebarActive: "access-ranking", topbarActive: "market" }).catch(() => {
    // A navigation setup failure must not remove the static ranking cards.
  });
})();
