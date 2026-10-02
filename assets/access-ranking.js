// Ranking content is static HTML. JavaScript only sets up the shared navigation.
window.common.setupDashboardChrome({ sidebarActive: "access-ranking", topbarActive: "market" }).catch(() => {
  // A navigation setup failure must not remove the static ranking cards.
});
