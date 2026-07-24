import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ETHERSCAN_API_KEY = Deno.env.get("ETHERSCAN_API_KEY") || "";

// USDT ERC-20 contract address on Ethereum mainnet
const USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

// V2 base URL
const ETHERSCAN_V2 = "https://api.etherscan.io/v2/api?chainid=1";

// ─── Bitcoin (Blockchain.info) ────────────────────────────────────────────────
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

// ─── Ethereum (Etherscan V2) ──────────────────────────────────────────────────
async function getEthereumData(address: string) {
  try {
    const [balRes, txRes] = await Promise.all([
      fetch(`${ETHERSCAN_V2}&module=account&action=balance&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`),
      fetch(`${ETHERSCAN_V2}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${ETHERSCAN_API_KEY}`),
    ]);
    const balData = await balRes.json();
    const txData = await txRes.json();

    const balanceWei = balData.result && /^\d+$/.test(balData.result) ? BigInt(balData.result) : BigInt(0);
    const balanceETH = Number(balanceWei) / 1e18;

    const transactions = (Array.isArray(txData.result) ? txData.result : []).slice(0, 10).map((tx: any) => ({
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

// ─── Dogecoin (Dogechain.info) ────────────────────────────────────────────────
async function getDogecoinData(address: string) {
  try {
    const [balRes, txRes] = await Promise.all([
      fetch(`https://dogechain.info/api/v1/address/balance/${address}`),
      fetch(`https://dogechain.info/api/v1/address/transactions/${address}/1`),
    ]);
    const balData = await balRes.json();
    const txData = await txRes.json();

    const balanceDOGE = parseFloat(balData.balance || "0");

    const transactions = (txData.transactions || []).slice(0, 10).map((tx: any) => {
      const isReceive = (tx.outputs || []).some((o: any) => o.address === address);
      const amount = isReceive
        ? (tx.outputs || []).filter((o: any) => o.address === address)
            .reduce((sum: number, o: any) => sum + parseFloat(o.value || "0"), 0)
        : (tx.inputs || []).filter((i: any) => i.address === address)
            .reduce((sum: number, i: any) => sum + parseFloat(i.value || "0"), 0);
      return {
        hash: tx.hash,
        type: isReceive ? "receive" : "send",
        amount,
        timestamp: (tx.time || 0) * 1000,
        confirmations: tx.confirmations || 0,
      };
    });

    return { chain: "doge", address, balance: balanceDOGE, transactions };
  } catch (e) {
    return { chain: "doge", address, balance: 0, transactions: [], error: String(e) };
  }
}

// ─── USDT (Etherscan V2 ERC-20) ───────────────────────────────────────────────
async function getUSDTData(address: string) {
  try {
    const [balRes, txRes] = await Promise.all([
      fetch(`${ETHERSCAN_V2}&module=account&action=tokenbalance&contractaddress=${USDT_CONTRACT}&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`),
      fetch(`${ETHERSCAN_V2}&module=account&action=tokentx&contractaddress=${USDT_CONTRACT}&address=${address}&page=1&offset=10&sort=desc&apikey=${ETHERSCAN_API_KEY}`),
    ]);
    const balData = await balRes.json();
    const txData = await txRes.json();

    // USDT has 6 decimals
    const rawBal = balData.result;
    const balanceRaw = rawBal && /^\d+$/.test(rawBal) ? BigInt(rawBal) : BigInt(0);
    const balanceUSDT = Number(balanceRaw) / 1e6;

    const transactions = (Array.isArray(txData.result) ? txData.result : []).slice(0, 10).map((tx: any) => ({
      hash: tx.hash,
      type: tx.to?.toLowerCase() === address.toLowerCase() ? "receive" : "send",
      amount: /^\d+$/.test(tx.value || "") ? parseInt(tx.value) / 1e6 : 0,
      timestamp: parseInt(tx.timeStamp) * 1000,
      confirmations: parseInt(tx.confirmations || "0"),
      from: tx.from,
      to: tx.to,
    }));

    return { chain: "usdt", address, balance: balanceUSDT, transactions };
  } catch (e) {
    return { chain: "usdt", address, balance: 0, transactions: [], error: String(e) };
  }
}

// ─── Live prices (CoinGecko) ──────────────────────────────────────────────────
async function getLivePrices() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,dogecoin,tether&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true"
    );
    const data = await res.json();
    return {
      btc:  { usd: data.bitcoin?.usd,   change24h: data.bitcoin?.usd_24h_change,   volume: data.bitcoin?.usd_24h_vol },
      eth:  { usd: data.ethereum?.usd,  change24h: data.ethereum?.usd_24h_change,  volume: data.ethereum?.usd_24h_vol },
      doge: { usd: data.dogecoin?.usd,  change24h: data.dogecoin?.usd_24h_change,  volume: data.dogecoin?.usd_24h_vol },
      usdt: { usd: data.tether?.usd,    change24h: data.tether?.usd_24h_change,    volume: data.tether?.usd_24h_vol },
    };
  } catch (e) {
    return { btc: null, eth: null, doge: null, usdt: null };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { btcAddress, ethAddress, dogeAddress, usdtAddress } = body;

    if (!btcAddress && !ethAddress && !dogeAddress && !usdtAddress) {
      return Response.json(
        { error: "Provide at least one address: btcAddress, ethAddress, dogeAddress, or usdtAddress" },
        { status: 400 }
      );
    }

    const [prices, btcData, ethData, dogeData, usdtData] = await Promise.all([
      getLivePrices(),
      btcAddress  ? getBitcoinData(btcAddress)   : Promise.resolve(null),
      ethAddress  ? getEthereumData(ethAddress)  : Promise.resolve(null),
      dogeAddress ? getDogecoinData(dogeAddress) : Promise.resolve(null),
      usdtAddress ? getUSDTData(usdtAddress)     : Promise.resolve(null),
    ]);

    const wallets = [btcData, ethData, dogeData, usdtData].filter(Boolean).map((w: any) => {
      const price = (prices as any)[w.chain];
      return {
        ...w,
        priceUSD: price?.usd || 0,
        change24h: price?.change24h || 0,
        usdValue: w.balance * (price?.usd || 0),
      };
    });

    const totalUSD = wallets.reduce((sum, w) => sum + w.usdValue, 0);

    return Response.json({ wallets, prices, totalUSD, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});