/**
 * Tooltip management for the heatmap.
 */

const tooltipEl = (() => {
  // Wait for DOM — return getter
  return () => document.getElementById('tooltip');
})();

function showTooltip(event, d) {
  const tip = tooltipEl();
  if (!tip) return;

  const data = d.data;
  const changeClass = data.change >= 0 ? 'tt-positive' : 'tt-negative';

  tip.innerHTML = `
    <div class="tt-ticker">${data.ticker}</div>
    <div class="tt-name">${data.fullName || data.name || ''}</div>
    <div class="tt-row">
      <span class="tt-label">Price</span>
      <span class="tt-value">${formatPrice(data.price)}</span>
    </div>
    <div class="tt-row">
      <span class="tt-label">Change</span>
      <span class="tt-value ${changeClass}">${formatChange(data.change)}</span>
    </div>
    <div class="tt-row">
      <span class="tt-label">AUM</span>
      <span class="tt-value">${formatAUM(data.aum)}</span>
    </div>
    <div class="tt-row">
      <span class="tt-label">Volume</span>
      <span class="tt-value">${data.volume ? data.volume.toLocaleString() : 'N/A'}</span>
    </div>
    <div class="tt-row">
      <span class="tt-label">Brand</span>
      <span class="tt-value">${data.brand}</span>
    </div>
    <div class="tt-row">
      <span class="tt-label">Strategy</span>
      <span class="tt-value">${data.strategy}</span>
    </div>
  `;

  tip.style.display = 'block';
  positionTooltip(event);
}

function moveTooltip(event) {
  positionTooltip(event);
}

function hideTooltip() {
  const tip = tooltipEl();
  if (tip) tip.style.display = 'none';
}

function positionTooltip(event) {
  const tip = tooltipEl();
  if (!tip) return;

  const padding = 12;
  const tipRect = tip.getBoundingClientRect();
  let x = event.clientX + padding;
  let y = event.clientY + padding;

  // Keep tooltip on screen
  if (x + tipRect.width > window.innerWidth) {
    x = event.clientX - tipRect.width - padding;
  }
  if (y + tipRect.height > window.innerHeight) {
    y = event.clientY - tipRect.height - padding;
  }

  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}
