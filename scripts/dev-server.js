/**
 * Local development server.
 * Serves static files from public/ and mocks the /api/quotes endpoint
 * with simulated price data so you can preview the heatmap without an API key.
 *
 * Usage: node scripts/dev-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4567;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CATALOG_PATH = path.join(__dirname, '..', 'data', 'etf-catalog.json');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function generateMockQuotes() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  return catalog.map(etf => {
    const basePrice = 10 + Math.random() * 90;
    const change = (Math.random() - 0.45) * 8; // slight positive bias, range ~-3.6 to +4.4
    return {
      ticker: etf.ticker,
      name: etf.name,
      brand: etf.brand,
      strategy: etf.strategy,
      aum: etf.aum || Math.floor(Math.random() * 2000000000) + 5000000, // simulate AUM if 0
      price: Math.round(basePrice * 100) / 100,
      change: Math.round(change * 100) / 100,
      changesPercentage: Math.round(change * 100) / 100,
      volume: Math.floor(Math.random() * 5000000) + 10000,
    };
  });
}

const server = http.createServer((req, res) => {
  // API mock
  if (req.url === '/api/quotes') {
    const data = generateMockQuotes();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data));
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
  console.log(`  API:    http://localhost:${PORT}/api/quotes`);
  console.log(`\n  Using mock data (random prices & changes)`);
  console.log(`  Press Ctrl+C to stop\n`);
});
