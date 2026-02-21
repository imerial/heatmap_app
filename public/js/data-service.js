/**
 * Data service — fetches ETF data from the serverless API.
 * Caches data client-side for instant re-renders on toggle switches.
 */

let cachedData = null;

async function fetchHeatmapData() {
  try {
    const response = await fetch('/api/quotes');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    cachedData = await response.json();

    // Hide error banner on success
    const errorEl = document.getElementById('error');
    if (errorEl) {
      errorEl.classList.remove('visible');
    }

    return cachedData;
  } catch (error) {
    console.error('Failed to fetch ETF data:', error);

    // Show error banner
    const errorEl = document.getElementById('error');
    if (errorEl) {
      errorEl.textContent = 'Failed to load live data. ' +
        (cachedData ? 'Showing cached data.' : 'Retrying...');
      errorEl.classList.add('visible');
    }

    return cachedData; // Return stale data if available
  }
}

function getCachedData() {
  return cachedData;
}
