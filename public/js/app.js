/**
 * Main application entry point.
 * Wires together data fetching, rendering, toggle controls, and auto-refresh.
 */

let currentGrouping = 'brand';
const REFRESH_INTERVAL = 3600000; // 1 hour in ms

async function init() {
  // Fetch initial data
  const data = await fetchHeatmapData();

  if (data && data.length > 0) {
    // Hide loading overlay
    document.getElementById('loading').classList.add('hidden');

    // Render heatmap
    renderHeatmap(data, currentGrouping);

    // Update metadata
    updateTimestamp();
    updateETFCount(data);
  } else {
    // Retry after 5 seconds if initial load fails
    document.getElementById('loading').querySelector('p').textContent =
      'Connection issue. Retrying...';
    setTimeout(init, 5000);
    return;
  }

  // Toggle buttons
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.dataset.group === currentGrouping) return;

      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentGrouping = this.dataset.group;

      const cached = getCachedData();
      if (cached) renderHeatmap(cached, currentGrouping);
    });
  });

  // Auto-refresh every hour
  setInterval(async () => {
    const newData = await fetchHeatmapData();
    if (newData) {
      renderHeatmap(newData, currentGrouping);
      updateTimestamp();
      updateETFCount(newData);
    }
  }, REFRESH_INTERVAL);

  // Re-render on window resize (debounced)
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const cached = getCachedData();
      if (cached) renderHeatmap(cached, currentGrouping);
    }, 250);
  });
}

function updateTimestamp() {
  const el = document.getElementById('last-updated');
  if (el) {
    const now = new Date();
    el.textContent = 'Updated ' + now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

function updateETFCount(data) {
  const el = document.getElementById('etf-count');
  if (el && data) {
    const withPrice = data.filter(d => d.price !== null).length;
    el.textContent = withPrice + ' ETFs';
  }
}

// Start the application
document.addEventListener('DOMContentLoaded', init);
