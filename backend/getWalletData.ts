import { base44 } from "npm:@base44/sdk";

const ETHERSCAN_API_KEY = Deno.env.get("ETHERSCAN_API_KEY") || "";
const SOLANA_RPC_URL = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";

// ─── Bitcoin (Blockchain.info — no API key needed) ───────────────────────────
async function getBitcoinData(address: string) {
  try {
    const [balRes, txRes] = await Promise.all([
      fetch(`https://blockchain.info/balance?active=${address}&cors=true`),
      fetch(`https://blockchain.info/rawaddr/${address}?limit=10&cors=true`),
    ]);
    const balData = await balRes.json();
    const txData = await txRes.json();

    const balanceSatoshi = balData[address]?.final_balance || 0;
    const balanceBTC = balanceSatoshi / 1e8;

    const transactions = (txData.txs || []).slice(0, 10).map((tx: any) => {
      const isReceive = tx.out.some((o: any) => o.addr === address);
      const amount = tx.out
        .filter((o: any) => isReceive ? o.addr === address : o.addr !== address)
        .reduce((sum: number, o: any) => sum + o.value, 0) / 1e8;
      return {
        hash: tx.hash,
        type: isReceive ? "receive" : "send",
        amount,
        timestamp: tx.time * 1000,
        confirmations: tx.block_height ? 1 : 0,
      };
    });

    return { chain: "btc", address, balance: balanceBTC, transactions };
  } catch (e) {
    return { chain: "btc", address, balance: 0, transactions: [], error: String(e) };
  }
}

// ─── Ethereum (Etherscan) ─────────────────────────────────────────────────────
async function getEthereumData(address: string) {
  try {
    const [balRes, txRes] = await Promise.all([
      fetch(`https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`),
      fetch(`https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${ETHERSCAN_API_KEY}`),
    ]);
    const balData = await balRes.json();
    const txData = await txRes.json();

    const balanceWei = BigInt(balData.result || "0");
    const balanceETH = Number(balanceWei) / 1e18;

    const transactions = (txData.result || []).slice(0, 10).map((tx: any) => ({
      hash: tx.hash,
      type: tx.to?.toLowerCase() === address.toLowerCase() ? "receive" : "send",
      amount: Number(tx.value) / 1e18,
      timestamp: parseInt(tx.timeStamp) * 1000,
      confirmations: parseInt(tx.confirmations || "0"),
      from: tx.from,
      to: tx.to,
    }));

    return { chain: "eth", address, balance: balanceETH, transactions };
  } catch (e) {
    return { chain: "eth", address, balance: 0, transactions: [], error: String(e) };
  }
}

// ─── Solana (RPC) ─────────────────────────────────────────────────────────────
async function getSolanaData(address: string) {
  try {
    // Get balance
    const balRes = await fetch(SOLANA_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getBalance",
        params: [address, { commitment: "confirmed" }],
      }),
    });
    const balData = await balRes.json();
    const balanceLamports = balData.result?.value || 0;
    const balanceSOL = balanceLamports / 1e9;

    // Get recent transactions
    const sigRes = await fetch(SOLANA_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 2, method: "getSignaturesForAddress",
        params: [address, { limit: 10 }],
      }),
    });
    const sigData = await sigRes.json();
    const signatures = sigData.result || [];

    // Fetch transaction details for first 5
    const txDetails = await Promise.all(
      signatures.slice(0, 5).map(async (sig: any) => {
        const txRes = await fetch(SOLANA_RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 3, method: "getTransaction",
            params: [sig.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
          }),
        });
        const txData = await txRes.json();
        const tx = txData.result;
        if (!tx) return null;

        const preBalance = tx.meta?.preBalances?.[0] || 0;
        const postBalance = tx.meta?.postBalances?.[0] || 0;
        const diff = (postBalance - preBalance) / 1e9;

        return {
          hash: sig.signature,
          type: diff >= 0 ? "receive" : "send",
          amount: Math.abs(diff),
          timestamp: (tx.blockTime || 0) * 1000,
          confirmations: tx.meta?.err ? 0 : 1,
        };
      })
    );

    const transactions = txDetails.filter(Boolean);
    return { chain: "sol", address, balance: balanceSOL, transactions };
  } catch (e) {
    return { chain: "sol", address, balance: 0, transactions: [], error: String(e) };
  }
}

// ─── Price fetcher (CoinGecko — no key needed) ───────────────────────────────
async function getPrices() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true"
    );
    const data = await res.json();
    return {
      btc: { usd: data.bitcoin?.usd, change24h: data.bitcoin?.usd_24h_change, volume: data.bitcoin?.usd_24h_vol },
      eth: { usd: data.ethereum?.usd, change24h: data.ethereum?.usd_24h_change, volume: data.ethereum?.usd_24h_vol },
      sol: { usd: data.solana?.usd, change24h: data.solana?.usd_24h_change, volume: data.solana?.usd_24h_vol },
    };
  } catch (e) {
    return { btc: null, eth: null, sol: null, error: String(e) };
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { btcAddress, ethAddress, solAddress } = body;

  if (!btcAddress && !ethAddress && !solAddress) {
    return Response.json({ error: "Provide at least one wallet address (btcAddress, ethAddress, or solAddress)" }, { status: 400 });
  }

  const [prices, ...walletResults] = await Promise.all([
    getPrices(),
    btcAddress ? getBitcoinData(btcAddress) : Promise.resolve(null),
    ethAddress ? getEthereumData(ethAddress) : Promise.resolve(null),
    solAddress ? getSolanaData(solAddress) : Promise.resolve(null),
  ]);

  const wallets = walletResults.filter(Boolean).map((w: any) => {
    const price = prices[w.chain as keyof typeof prices] as any;
    return {
      ...w,
      priceUSD: price?.usd || 0,
      change24h: price?.change24h || 0,
      usdValue: w.balance * (price?.usd || 0),
    };
  });

  const totalUSD = wallets.reduce((sum, w) => sum + w.usdValue, 0);

  return Response.json({ wallets, prices, totalUSD, fetchedAt: new Date().toISOString() });
}