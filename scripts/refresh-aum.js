/**
 * AUM Refresh Script
 *
 * Fetches AUM data for all ETFs in the catalog using the FMP API.
 * Run manually or weekly: node scripts/refresh-aum.js
 *
 * Requires FMP_API_KEY environment variable.
 * Usage: FMP_API_KEY=your_key node scripts/refresh-aum.js
 */

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '..', 'data', 'etf-catalog.json');
const FMP_API_KEY = process.env.FMP_API_KEY;
const BATCH_SIZE = 5;
const DELAY_MS = 1200; // ~50 requests/min to stay safe

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAUM(ticker) {
  const url = `https://financialmodelingprep.com/api/v3/etf-holder/${ticker}?apikey=${FMP_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    // FMP ETF info endpoint
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchETFProfile(ticker) {
  const url = `https://financialmodelingprep.com/api/v3/profile/${ticker}?apikey=${FMP_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0].mktCap || 0;
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  if (!FMP_API_KEY) {
    console.error('Error: FMP_API_KEY environment variable is required.');
    console.error('Usage: FMP_API_KEY=your_key node scripts/refresh-aum.js');
    process.exit(1);
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  console.log(`Refreshing AUM for ${catalog.length} ETFs...`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < catalog.length; i += BATCH_SIZE) {
    const batch = catalog.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (etf) => {
        const mktCap = await fetchETFProfile(etf.ticker);
        if (mktCap && mktCap > 0) {
          etf.aum = mktCap;
          updated++;
          return true;
        }
        failed++;
        return false;
      })
    );

    const progress = Math.min(i + BATCH_SIZE, catalog.length);
    console.log(`Progress: ${progress}/${catalog.length} (${updated} updated, ${failed} failed)`);

    if (i + BATCH_SIZE < catalog.length) {
      await sleep(DELAY_MS);
    }
  }

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
  console.log(`\nDone! Updated ${updated}/${catalog.length} ETFs. ${failed} failed.`);
  console.log(`Catalog saved to ${CATALOG_PATH}`);
}

main().catch(console.error);
