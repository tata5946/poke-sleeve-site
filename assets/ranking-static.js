// Cards, metrics and graphs are static HTML. JavaScript only initializes navigation.
window.common.setupDashboardChrome({
  sidebarActive: document.body.dataset.rankingActive,
  topbarActive: "market"
}).catch(() => {
  // Keep the static ranking visible if navigation initialization fails.
});
