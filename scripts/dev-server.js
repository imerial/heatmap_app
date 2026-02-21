/**
 * Local development server.
 * Serves static files from public/ and fetches real data from Yahoo Finance.
 * No API key needed.
 *
 * Usage: node scripts/dev-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4567;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CATALOG_PATH = path.join(__dirname, '..', 'data', 'etf-catalog.json');
const BATCH_SIZE = 20;

async function fetchRealQuotes() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  const tickers = catalog.map(e => e.ticker);

  const batches = [];
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    batches.push(tickers.slice(i, i + BATCH_SIZE));
  }

  console.log(`  Fetching ${tickers.length} ETFs in ${batches.length} batches from Yahoo Finance...`);

  const results = await Promise.all(
    batches.map(async (batch) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${batch.join(',')}&range=1d&interval=1d`;
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!response.ok) {
          console.error(`  Yahoo batch error: HTTP ${response.status}`);
          return {};
        }
        return await response.json();
      } catch (err) {
        console.error(`  Yahoo fetch error:`, err.message);
        return {};
      }
    })
  );

  // Merge all batch results
  const quoteMap = {};
  for (const result of results) {
    if (result.spark) continue; // error response, skip
    for (const [symbol, data] of Object.entries(result)) {
      if (data && data.close && Array.isArray(data.close) && data.close.length > 0) {
        const close = data.close[data.close.length - 1];
        const prevClose = data.chartPreviousClose || close;
        const change = close - prevClose;
        const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

        quoteMap[symbol] = {
          price: close,
          change: Math.round(change * 100) / 100,
          changesPercentage: Math.round(changePct * 100) / 100,
        };
      }
    }
  }

  const matched = Object.keys(quoteMap).length;

  const merged = catalog.map(etf => {
    const quote = quoteMap[etf.ticker] || {};
    return {
      ticker: etf.ticker,
      name: etf.name,
      brand: etf.brand,
      strategy: etf.strategy,
      aum: etf.aum || 0,
      price: quote.price ?? null,
      change: quote.change ?? 0,
      changesPercentage: quote.changesPercentage ?? 0,
      volume: 0,
    };
  });

  console.log(`  Got quotes for ${matched}/${catalog.length} ETFs`);
  return merged;
}

// Cache data for 5 minutes locally
let cachedData = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/quotes') {
    try {
      const now = Date.now();
      if (cachedData && (now - cacheTimestamp) < CACHE_TTL) {
        console.log(`  Serving cached data (${Math.round((CACHE_TTL - (now - cacheTimestamp)) / 1000)}s remaining)`);
      } else {
        cachedData = await fetchRealQuotes();
        cacheTimestamp = Date.now();
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(cachedData));
    } catch (err) {
      console.error('  API error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(PUBLIC_DIR, filePath);

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Tidal ETF Heatmap - Dev Server`);
  console.log(`  ──────────────────────────────`);
  console.log(`  Local:  http://localhost:${PORT}`);
  console.log(`  Data:   LIVE (Yahoo Finance - no API key needed)`);
  console.log(`\n  Press Ctrl+C to stop\n`);
});
