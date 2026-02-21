/**
 * Main application entry point.
 * Wires together data fetching, rendering, toggle controls,
 * search, summary stats, and auto-refresh.
 */

let currentGrouping = 'strategy'; // default to strategy (11 clean groups)
const REFRESH_INTERVAL = 3600000; // 1 hour

async function init() {
  const data = await fetchHeatmapData();

  if (data && data.length > 0) {
    document.getElementById('loading').classList.add('hidden');
    renderHeatmap(data, currentGrouping);
    updateTimestamp();
    updateStats(data);
  } else {
    document.getElementById('loading').querySelector('p').textContent =
      'Connection issue. Retrying...';
    setTimeout(init, 5000);
    return;
  }

  // Set the default toggle button as active
  const defaultBtn = document.querySelector(`.toggle-btn[data-group="${currentGrouping}"]`);
  if (defaultBtn) defaultBtn.classList.add('active');

  // Toggle buttons
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.dataset.group === currentGrouping) return;

      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentGrouping = this.dataset.group;

      const cached = getCachedData();
      if (cached) {
        renderHeatmap(cached, currentGrouping);
      }
    });
  });

  // Search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      const val = this.value.trim();
      debounceTimer = setTimeout(() => {
        performSearch(val);
      }, 250);
    });

    // Escape to clear search
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        this.value = '';
        performSearch('');
      }
    });
  }

  // Auto-refresh every hour
  setInterval(async () => {
    const newData = await fetchHeatmapData();
    if (newData) {
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
      updateStats(newData);
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

/**
 * Update the summary stats bar
 */
function updateStats(data) {
  if (!data) return;

  const withPrice = data.filter(d => d.price !== null);
  const total = withPrice.length;

  const totalEl = document.getElementById('stat-total');
  if (totalEl) totalEl.textContent = total;

  // Average change
  const avgChange = total > 0
    ? withPrice.reduce((s, d) => s + (d.changesPercentage || 0), 0) / total
    : 0;
  const avgEl = document.getElementById('stat-avg');
  if (avgEl) {
    avgEl.textContent = formatChange(avgChange);
    avgEl.classList.remove('positive', 'negative');
    avgEl.classList.add(avgChange >= 0 ? 'positive' : 'negative');
  }

  // Gainers & losers
  const gainers = withPrice.filter(d => (d.changesPercentage || 0) > 0).length;
  const losers = withPrice.filter(d => (d.changesPercentage || 0) < 0).length;

  const gainersEl = document.getElementById('stat-gainers');
  if (gainersEl) gainersEl.textContent = gainers;

  const losersEl = document.getElementById('stat-losers');
  if (losersEl) losersEl.textContent = losers;
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

document.addEventListener('DOMContentLoaded', init);
