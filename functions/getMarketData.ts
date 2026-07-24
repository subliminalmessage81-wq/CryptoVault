import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, retries = 3, delay = 1200): Promise<any> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.status === 429) {
      if (i < retries - 1) await sleep(delay * (i + 1));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  throw new Error("Rate limited after retries");
}

async function getTokenHistory(coinId: string) {
  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 3600;
    const data = await fetchWithRetry(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`
    );
    return { coinId, prices: data.prices || [], volumes: data.total_volumes || [] };
  } catch (e) {
    return { coinId, prices: [], volumes: [], error: String(e) };
  }
}

async function getAllHistory() {
  const coins = ["bitcoin", "ethereum", "dogecoin", "tether"];
  const results: Record<string, any> = {};
  // Stagger requests to avoid 429s — 800ms apart
  for (let i = 0; i < coins.length; i++) {
    if (i > 0) await sleep(800);
    results[coins[i]] = await getTokenHistory(coins[i]);
  }
  return results;
}

async function getCurrentPrices() {
  try {
    const data = await fetchWithRetry(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,dogecoin,tether&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true"
    );
    return {
      bitcoin:  { usd: data.bitcoin?.usd,  change24h: data.bitcoin?.usd_24h_change,  marketCap: data.bitcoin?.usd_market_cap,  volume: data.bitcoin?.usd_24h_vol },
      ethereum: { usd: data.ethereum?.usd, change24h: data.ethereum?.usd_24h_change, marketCap: data.ethereum?.usd_market_cap, volume: data.ethereum?.usd_24h_vol },
      dogecoin: { usd: data.dogecoin?.usd, change24h: data.dogecoin?.usd_24h_change, marketCap: data.dogecoin?.usd_market_cap, volume: data.dogecoin?.usd_24h_vol },
      tether:   { usd: data.tether?.usd,   change24h: data.tether?.usd_24h_change,   marketCap: data.tether?.usd_market_cap,   volume: data.tether?.usd_24h_vol },
    };
  } catch (e) {
    return {};
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch current prices first, then history sequentially
    const currentPrices = await getCurrentPrices();
    await sleep(600);
    const history = await getAllHistory();

    return Response.json({
      currentPrices,
      history,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});