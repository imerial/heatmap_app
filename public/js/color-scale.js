/**
 * Creates a diverging color scale for the heatmap.
 * Deep red (-5%) -> neutral dark gray (0%) -> deep green (+5%)
 */
function createColorScale() {
  return d3.scaleLinear()
    .domain([-5, -2, -0.5, 0, 0.5, 2, 5])
    .range([
      '#b71c1c',  // deep red
      '#e53935',  // bright red
      '#5d4037',  // muted red-brown
      '#37474f',  // neutral dark
      '#2e7d32',  // muted green
      '#43a047',  // bright green
      '#1b5e20'   // deep green
    ])
    .clamp(true);
}

/**
 * Returns a text color (white or near-white) for readability on colored backgrounds.
 */
function getTextColor(changePercent) {
  return '#ffffff';
}

/**
 * Formats a percentage change value with sign and 2 decimal places.
 */
function formatChange(value) {
  if (value == null || isNaN(value)) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return sign + value.toFixed(2) + '%';
}

/**
 * Formats AUM as a human-readable string (e.g., "$1.2B", "$340M").
 */
function formatAUM(value) {
  if (!value || value <= 0) return 'N/A';
  if (value >= 1e9) return '$' + (value / 1e9).toFixed(1) + 'B';
  if (value >= 1e6) return '$' + (value / 1e6).toFixed(0) + 'M';
  if (value >= 1e3) return '$' + (value / 1e3).toFixed(0) + 'K';
  return '$' + value.toFixed(0);
}

/**
 * Formats price as a dollar amount.
 */
function formatPrice(value) {
  if (value == null) return 'N/A';
  return '$' + value.toFixed(2);
}
