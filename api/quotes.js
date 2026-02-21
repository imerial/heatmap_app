import { readFileSync } from 'fs';
import { join } from 'path';

const BATCH_SIZE = 20;

async function fetchWithRetry(url, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (response.ok) return response.json();
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, delay * (i + 1)));
        continue;
      }
      console.error(`Yahoo returned ${response.status}`);
      return {};
    } catch (err) {
      console.error(`Fetch error (attempt ${i + 1}):`, err.message);
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
    }
  }
  return {};
}

export default async function handler(req, res) {
  try {
    const catalogPath = join(process.cwd(), 'data', 'etf-catalog.json');
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));

    const tickers = catalog.map(e => e.ticker);
    const batches = [];
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      batches.push(tickers.slice(i, i + BATCH_SIZE));
    }

    // Fetch from Yahoo Finance spark endpoint (no API key needed)
    const batchResults = await Promise.all(
      batches.map(batch =>
        fetchWithRetry(
          `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${batch.join(',')}&range=1d&interval=1d`
        )
      )
    );

    // Merge all batch results into a single quote map
    const quoteMap = {};
    for (const result of batchResults) {
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

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(merged);
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Failed to fetch quotes' });
  }
}
