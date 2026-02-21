/**
 * Main application entry point.
 * Wires together data fetching, rendering, toggle controls, and auto-refresh.
 */

let currentGrouping = 'brand';
const REFRESH_INTERVAL = 3600000; // 1 hour in ms

async function init() {
  const data = await fetchHeatmapData();

  if (data && data.length > 0) {
    document.getElementById('loading').classList.add('hidden');
    renderHeatmap(data, currentGrouping);
    updateTimestamp();
    updateETFCount(data);
  } else {
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
      if (cached) {
        // Reset to overview when switching grouping
        renderHeatmap(cached, currentGrouping);
      }
    });
  });

  // Auto-refresh every hour
  setInterval(async () => {
    const newData = await fetchHeatmapData();
    if (newData) {
      // Re-render current view (preserves zoom state if in detail)
      if (currentView === 'detail' && currentGroup) {
        const grouped = d3.group(newData.filter(d => d.price !== null || d.aum > 0), d => d[activeGroupBy]);
        const groupETFs = grouped.get(currentGroup);
        if (groupETFs) {
          allData = newData;
          zoomIntoGroup(currentGroup, groupETFs);
        } else {
          renderHeatmap(newData, currentGrouping);
        }
      } else {
        renderHeatmap(newData, currentGrouping);
      }
      updateTimestamp();
      updateETFCount(newData);
    }
  }, REFRESH_INTERVAL);

  // Re-render on window resize (debounced, preserves zoom state)
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const cached = getCachedData();
      if (!cached) return;

      if (currentView === 'detail' && currentGroup) {
        const grouped = d3.group(cached.filter(d => d.price !== null || d.aum > 0), d => d[activeGroupBy]);
        const groupETFs = grouped.get(currentGroup);
        if (groupETFs) {
          zoomIntoGroup(currentGroup, groupETFs);
        }
      } else {
        renderOverview(cached, currentGrouping);
      }
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

document.addEventListener('DOMContentLoaded', init);
