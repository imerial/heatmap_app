/**
 * Zoomable D3.js Treemap Heatmap
 *
 * Two levels:
 *   1. Overview: groups (brands or strategies) as large colored tiles
 *   2. Drill-down: individual ETFs within a selected group
 *
 * Click a group to zoom in. Click "Back" to zoom out.
 */

let currentView = 'overview'; // 'overview' or 'detail'
let currentGroup = null;
let allData = null;
let activeGroupBy = 'brand';

function renderHeatmap(data, groupBy) {
  allData = data;
  activeGroupBy = groupBy;
  currentView = 'overview';
  currentGroup = null;
  updateBreadcrumb(null);
  renderOverview(data, groupBy);
}

/**
 * OVERVIEW: Render groups as large tiles.
 * Each tile shows group name, ETF count, and weighted avg % change.
 */
function renderOverview(data, groupBy) {
  const container = document.getElementById('heatmap-container');
  const width = container.clientWidth;
  const height = container.clientHeight;

  d3.select('#heatmap-container').selectAll('*').remove();

  if (!data || data.length === 0) return;

  const validData = data.filter(d => d.price !== null || d.aum > 0);
  const grouped = d3.group(validData, d => d[groupBy]);

  // Build group-level summary data
  const groupSummaries = Array.from(grouped, ([key, etfs]) => {
    const totalAUM = etfs.reduce((s, e) => s + Math.max(e.aum || (e.volume * (e.price || 1)) || 1, 1), 0);
    const weightedChange = etfs.reduce((s, e) => {
      const w = Math.max(e.aum || (e.volume * (e.price || 1)) || 1, 1);
      return s + (e.changesPercentage || 0) * w;
    }, 0) / totalAUM;

    return {
      name: key,
      value: totalAUM,
      avgChange: weightedChange,
      etfCount: etfs.length,
      etfs: etfs,
    };
  });

  const hierarchyData = {
    name: 'root',
    children: groupSummaries,
  };

  const root = d3.hierarchy(hierarchyData)
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);

  const treemap = d3.treemap()
    .size([width, height])
    .paddingInner(3)
    .paddingOuter(4)
    .round(true);

  treemap(root);

  const colorScale = createColorScale();

  const svg = d3.select('#heatmap-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const leaves = root.leaves();

  const cells = svg.selectAll('g.cell')
    .data(leaves)
    .join('g')
    .attr('class', 'cell')
    .attr('transform', d => `translate(${d.x0},${d.y0})`)
    .style('cursor', 'pointer');

  // Background rectangle
  cells.append('rect')
    .attr('width', d => Math.max(0, d.x1 - d.x0))
    .attr('height', d => Math.max(0, d.y1 - d.y0))
    .attr('fill', d => colorScale(d.data.avgChange || 0))
    .attr('rx', 4)
    .attr('stroke', '#1a1a2e')
    .attr('stroke-width', 1.5);

  // Text content for each group tile
  cells.each(function(d) {
    const g = d3.select(this);
    const w = d.x1 - d.x0;
    const h = d.y1 - d.y0;

    if (w < 40 || h < 30) return;

    const cx = w / 2;
    const cy = h / 2;

    // Group name
    const nameFontSize = w < 70 ? 11 : w < 120 ? 14 : w < 200 ? 17 : 20;
    g.append('text')
      .attr('x', cx)
      .attr('y', cy - (h > 60 ? 14 : 4))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', h > 60 ? 'auto' : 'central')
      .attr('fill', '#fff')
      .attr('font-size', nameFontSize + 'px')
      .attr('font-weight', '700')
      .attr('font-family', 'inherit')
      .style('pointer-events', 'none')
      .text(truncateText(d.data.name, w - 16, nameFontSize));

    if (h < 55) return;

    // Average % change
    const changeFontSize = Math.max(nameFontSize - 3, 10);
    g.append('text')
      .attr('x', cx)
      .attr('y', cy + 4)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.9)')
      .attr('font-size', changeFontSize + 'px')
      .attr('font-weight', '600')
      .attr('font-family', 'inherit')
      .style('pointer-events', 'none')
      .text(formatChange(d.data.avgChange));

    if (h < 75) return;

    // ETF count
    const countFontSize = Math.max(changeFontSize - 2, 9);
    g.append('text')
      .attr('x', cx)
      .attr('y', cy + 22)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.6)')
      .attr('font-size', countFontSize + 'px')
      .attr('font-family', 'inherit')
      .style('pointer-events', 'none')
      .text(d.data.etfCount + ' ETF' + (d.data.etfCount !== 1 ? 's' : ''));
  });

  // Click handler: zoom into group
  cells.on('click', function(event, d) {
    zoomIntoGroup(d.data.name, d.data.etfs);
  });

  // Tooltip for overview
  cells.select('rect')
    .on('mouseover', function(event, d) {
      showGroupTooltip(event, d.data);
    })
    .on('mousemove', function(event) { moveTooltip(event); })
    .on('mouseout', function() { hideTooltip(); });
}

/**
 * DETAIL: Render individual ETFs within a group.
 */
function zoomIntoGroup(groupName, etfs) {
  currentView = 'detail';
  currentGroup = groupName;
  updateBreadcrumb(groupName);

  const container = document.getElementById('heatmap-container');
  const width = container.clientWidth;
  const height = container.clientHeight;

  d3.select('#heatmap-container').selectAll('*').remove();

  const hierarchyData = {
    name: groupName,
    children: etfs.map(e => ({
      ticker: e.ticker,
      name: e.ticker,
      fullName: e.name,
      value: Math.max(e.aum || (e.volume * (e.price || 1)) || 1, 1),
      change: e.changesPercentage,
      price: e.price,
      volume: e.volume,
      aum: e.aum,
      brand: e.brand,
      strategy: e.strategy,
    }))
  };

  const root = d3.hierarchy(hierarchyData)
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);

  const treemap = d3.treemap()
    .size([width, height])
    .paddingInner(2)
    .paddingOuter(4)
    .round(true);

  treemap(root);

  const colorScale = createColorScale();

  const svg = d3.select('#heatmap-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const leaves = root.leaves();

  const cells = svg.selectAll('g.cell')
    .data(leaves)
    .join('g')
    .attr('class', 'cell')
    .attr('transform', d => `translate(${d.x0},${d.y0})`);

  // Background rect
  cells.append('rect')
    .attr('width', d => Math.max(0, d.x1 - d.x0))
    .attr('height', d => Math.max(0, d.y1 - d.y0))
    .attr('fill', d => colorScale(d.data.change || 0))
    .attr('rx', 2)
    .attr('stroke', '#1a1a2e')
    .attr('stroke-width', 0.5);

  // Text labels
  cells.each(function(d) {
    const g = d3.select(this);
    const w = d.x1 - d.x0;
    const h = d.y1 - d.y0;

    if (w < 30 || h < 18) return;

    const tickerSize = w < 50 ? 9 : w < 80 ? 11 : w < 130 ? 14 : 18;
    const changeSize = Math.max(tickerSize - 3, 8);

    // Ticker
    g.append('text')
      .attr('x', w / 2)
      .attr('y', h / 2 - (h > 40 ? 4 : 0))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', h > 40 ? 'auto' : 'central')
      .attr('fill', '#fff')
      .attr('font-size', tickerSize + 'px')
      .attr('font-weight', '700')
      .attr('font-family', 'inherit')
      .style('pointer-events', 'none')
      .text(d.data.ticker);

    // % change
    if (h > 40 && w > 40) {
      g.append('text')
        .attr('x', w / 2)
        .attr('y', h / 2 + changeSize + 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.85)')
        .attr('font-size', changeSize + 'px')
        .attr('font-weight', '500')
        .attr('font-family', 'inherit')
        .style('pointer-events', 'none')
        .text(formatChange(d.data.change));
    }

    // Price (only in larger cells)
    if (h > 65 && w > 70) {
      g.append('text')
        .attr('x', w / 2)
        .attr('y', h / 2 + changeSize + 16)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.5)')
        .attr('font-size', (changeSize - 1) + 'px')
        .attr('font-family', 'inherit')
        .style('pointer-events', 'none')
        .text(formatPrice(d.data.price));
    }
  });

  // Tooltip handlers
  cells.select('rect')
    .on('mouseover', function(event, d) { showTooltip(event, d); })
    .on('mousemove', function(event) { moveTooltip(event); })
    .on('mouseout', function() { hideTooltip(); });
}

/**
 * Navigate back to overview
 */
function zoomOut() {
  if (currentView === 'detail' && allData) {
    renderOverview(allData, activeGroupBy);
    currentView = 'overview';
    currentGroup = null;
    updateBreadcrumb(null);
  }
}

/**
 * Update the breadcrumb / back navigation
 */
function updateBreadcrumb(groupName) {
  const el = document.getElementById('breadcrumb');
  if (!el) return;

  if (groupName) {
    el.innerHTML = `<button id="back-btn" onclick="zoomOut()">\u2190 All Groups</button><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">${groupName}</span>`;
    el.classList.add('visible');
  } else {
    el.innerHTML = '';
    el.classList.remove('visible');
  }
}

/**
 * Show tooltip for group overview tiles
 */
function showGroupTooltip(event, data) {
  const tip = document.getElementById('tooltip');
  if (!tip) return;

  const changeClass = data.avgChange >= 0 ? 'tt-positive' : 'tt-negative';
  const topGainer = data.etfs.reduce((best, e) => (e.changesPercentage || 0) > (best.changesPercentage || 0) ? e : best, data.etfs[0]);
  const topLoser = data.etfs.reduce((worst, e) => (e.changesPercentage || 0) < (worst.changesPercentage || 0) ? e : worst, data.etfs[0]);

  tip.innerHTML = `
    <div class="tt-ticker">${data.name}</div>
    <div class="tt-name">${data.etfCount} ETFs</div>
    <div class="tt-row">
      <span class="tt-label">Avg Change</span>
      <span class="tt-value ${changeClass}">${formatChange(data.avgChange)}</span>
    </div>
    <div class="tt-row">
      <span class="tt-label">Top Gainer</span>
      <span class="tt-value tt-positive">${topGainer.ticker} ${formatChange(topGainer.changesPercentage)}</span>
    </div>
    <div class="tt-row">
      <span class="tt-label">Top Loser</span>
      <span class="tt-value tt-negative">${topLoser.ticker} ${formatChange(topLoser.changesPercentage)}</span>
    </div>
  `;

  tip.style.display = 'block';
  positionTooltip(event);
}

/**
 * Truncates text to fit within a given pixel width.
 */
function truncateText(text, maxWidth, fontSize) {
  const avgCharWidth = fontSize * 0.58;
  const maxChars = Math.floor(maxWidth / avgCharWidth);
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 1) + '\u2026';
}
