(function(root,factory){
  if(typeof module==='object' && module.exports) module.exports=factory(require('./pricing.js'));
  else root.ZukanSparkline=factory(root.SleevePricing);
})(typeof globalThis!=='undefined'?globalThis:this,function(pricing){
    function numOrNull(value) { if (value == null || value === "") return null; const n=Number(value); return Number.isFinite(n)?n:null; }
    function formatSparklinePriceLabel(value) {
      if (!Number.isFinite(value)) return "";
      if (Math.abs(value) >= 10000) {
        const man = value / 10000;
        return `${Number.isInteger(man) ? man.toFixed(0) : man.toFixed(1)}万`;
      }
      if (Math.abs(value) >= 1000) {
        return `${Math.round(value / 100) / 10}千`;
      }
      return `${Math.round(value)}`;
    }

    function formatSparklineWeekLabel(value) {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }

    function buildZukanSparkline(sleeve) {
      const pair = pricing.weeklyPair(sleeve);
      const rows = (Array.isArray(pair?.sorted) ? pair.sorted : [])
        .filter((row) => Number.isFinite(numOrNull(row?.price)) && numOrNull(row?.price) > 0)
        .slice(-8);
      const prices = rows.map((row) => numOrNull(row.price));

      if (prices.length < 2) {
        return "";
      }

      const first = prices[0];
      const last = prices[prices.length - 1];
      const trendClass = last > first ? "up" : last < first ? "down" : "flat";
      const width = 160;
      const height = 64;
      const chartLeft = 30;
      const chartRight = 156;
      const chartTop = 8;
      const chartBottom = 44;
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const range = Math.max(max - min, 1);
      const step = (chartRight - chartLeft) / Math.max(1, prices.length - 1);
      const points = prices.map((price, index) => {
        const x = chartLeft + (step * index);
        const y = chartBottom - (((price - min) / range) * (chartBottom - chartTop));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
      const firstX = chartLeft.toFixed(1);
      const lastX = (chartLeft + (step * (prices.length - 1))).toFixed(1);
      const areaPoints = `${firstX},${chartBottom} ${points} ${lastX},${chartBottom}`;
      const maxLabel = formatSparklinePriceLabel(max);
      const minLabel = formatSparklinePriceLabel(min);
      const startLabel = formatSparklineWeekLabel(rows[0]?.week);
      const endLabel = formatSparklineWeekLabel(rows[rows.length - 1]?.week);

      return `<span class="zukan-sparkline zukan-sparkline--${trendClass}" aria-label="直近${prices.length}週の価格推移。${minLabel}円から${maxLabel}円の範囲。"><svg viewBox="0 0 ${width} ${height}" focusable="false" aria-hidden="true"><line class="zukan-sparkline-axis" x1="${chartLeft}" y1="${chartTop}" x2="${chartLeft}" y2="${chartBottom}"></line><line class="zukan-sparkline-grid" x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}"></line><text class="zukan-sparkline-label" x="2" y="${chartTop + 3}">${maxLabel}</text><text class="zukan-sparkline-label" x="2" y="${chartBottom + 2}">${minLabel}</text><text class="zukan-sparkline-label zukan-sparkline-label--axis" x="${chartLeft}" y="61">${startLabel}</text><text class="zukan-sparkline-label zukan-sparkline-label--axis" x="${chartRight}" y="61" text-anchor="end">${endLabel}</text><polygon class="zukan-sparkline-area" points="${areaPoints}"></polygon><polyline class="zukan-sparkline-line" points="${points}"></polyline></svg></span>`;
    }


return {build:buildZukanSparkline};
});
