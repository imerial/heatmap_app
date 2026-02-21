/**
 * D3.js Treemap Heatmap Renderer
 * Renders ETF data as a grouped treemap with color-coded cells.
 */

function renderHeatmap(data, groupBy) {
  const container = document.getElementById('heatmap-container');
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Clear previous render
  d3.select('#heatmap-container').selectAll('*').remove();

  if (!data || data.length === 0) return;

  // Filter out ETFs with no data at all
  const validData = data.filter(d => d.price !== null || d.aum > 0);

  // Build hierarchy: root -> groups -> ETFs
  const grouped = d3.group(validData, d => d[groupBy]);
  const hierarchyData = {
    name: 'root',
    children: Array.from(grouped, ([key, values]) => ({
      name: key,
      children: values.map(v => ({
        ticker: v.ticker,
        name: v.ticker,
        fullName: v.name,
        // Size by AUM; fallback to volume*price; minimum 1
        value: Math.max(v.aum || (v.volume * (v.price || 1)) || 1, 1),
        change: v.changesPercentage,
        price: v.price,
        volume: v.volume,
        aum: v.aum,
        brand: v.brand,
        strategy: v.strategy,
      }))
    }))
  };

  // Sort groups by total value (largest groups first)
  hierarchyData.children.sort((a, b) => {
    const sumA = a.children.reduce((s, c) => s + c.value, 0);
    const sumB = b.children.reduce((s, c) => s + c.value, 0);
    return sumB - sumA;
  });

  const root = d3.hierarchy(hierarchyData)
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);

  const treemap = d3.treemap()
    .size([width, height])
    .paddingTop(18)
    .paddingInner(1.5)
    .paddingOuter(2)
    .round(true);

  treemap(root);

  const colorScale = createColorScale();

  const svg = d3.select('#heatmap-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // Render group backgrounds and labels
  const groups = root.children || [];
  groups.forEach(group => {
    // Group background
    svg.append('rect')
      .attr('x', group.x0)
      .attr('y', group.y0)
      .attr('width', group.x1 - group.x0)
      .attr('height', group.y1 - group.y0)
      .attr('fill', 'none')
      .attr('stroke', '#0f3460')
      .attr('stroke-width', 1);

    // Group label
    const groupWidth = group.x1 - group.x0;
    if (groupWidth > 40) {
      svg.append('text')
        .attr('x', group.x0 + 4)
        .attr('y', group.y0 + 13)
        .text(truncateText(group.data.name, groupWidth - 8, 11))
        .attr('fill', '#8899aa')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif')
        .style('pointer-events', 'none');
    }
  });

  // Render individual ETF cells
  const leaves = root.leaves();

  // Cell rectangles
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
    .attr('stroke', '#1a1a2e')
    .attr('stroke-width', 0.5)
    .attr('rx', 1)
    .style('cursor', 'pointer');

  // Ticker text
  cells.each(function(d) {
    const cellW = d.x1 - d.x0;
    const cellH = d.y1 - d.y0;
    const g = d3.select(this);

    if (cellW < 28 || cellH < 16) return; // Too small for any text

    const fontSize = cellW < 40 ? 8 : cellW < 60 ? 9 : cellW < 90 ? 11 : 13;
    const changeFontSize = Math.max(fontSize - 2, 7);

    // Ticker
    g.append('text')
      .attr('x', cellW / 2)
      .attr('y', cellH / 2 - (cellH > 30 ? 2 : 0))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', cellH > 30 ? 'auto' : 'central')
      .attr('fill', '#fff')
      .attr('font-size', fontSize + 'px')
      .attr('font-weight', '700')
      .attr('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif')
      .style('pointer-events', 'none')
      .text(d.data.ticker);

    // % change (only if cell is tall enough)
    if (cellH > 30 && cellW > 35) {
      g.append('text')
        .attr('x', cellW / 2)
        .attr('y', cellH / 2 + changeFontSize + 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.85)')
        .attr('font-size', changeFontSize + 'px')
        .attr('font-weight', '500')
        .attr('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif')
        .style('pointer-events', 'none')
        .text(formatChange(d.data.change));
    }
  });

  // Tooltip event handlers on the cell rects
  cells.select('rect')
    .on('mouseover', function(event, d) { showTooltip(event, d); })
    .on('mousemove', function(event) { moveTooltip(event); })
    .on('mouseout', function() { hideTooltip(); });
}

/**
 * Truncates text to fit within a given pixel width (approximate).
 */
function truncateText(text, maxWidth, fontSize) {
  const avgCharWidth = fontSize * 0.6;
  const maxChars = Math.floor(maxWidth / avgCharWidth);
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 1) + '\u2026';
}
