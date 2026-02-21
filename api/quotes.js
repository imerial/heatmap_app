import { readFileSync } from 'fs';
import { join } from 'path';

const BATCH_SIZE = 60;

async function fetchWithRetry(url, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, delay * (i + 1)));
        continue;
      }
      console.error(`FMP returned ${response.status} for ${url}`);
      return [];
    } catch (err) {
      console.error(`Fetch error (attempt ${i + 1}):`, err.message);
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
    }
  }
  return [];
}

export default async function handler(req, res) {
  try {
    const catalogPath = join(process.cwd(), 'data', 'etf-catalog.json');
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));
    const apiKey = process.env.FMP_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const tickers = catalog.map(e => e.ticker);
    const batches = [];
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      batches.push(tickers.slice(i, i + BATCH_SIZE));
    }

    const quoteResults = await Promise.all(
      batches.map(batch =>
        fetchWithRetry(
          `https://financialmodelingprep.com/api/v3/quote/${batch.join(',')}?apikey=${apiKey}`
        )
      )
    );

    const allQuotes = quoteResults.flat();
    const quoteMap = {};
    for (const q of allQuotes) {
      if (q && q.symbol) {
        quoteMap[q.symbol] = q;
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
        volume: quote.volume ?? 0,
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
