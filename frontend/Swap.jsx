import { useState, useEffect } from "react";
import { ArrowDownUp, RefreshCw, Loader, ExternalLink, AlertCircle, CheckCircle } from "lucide-react";

const FEE_URL = "/functions/recordFee";
const PLATFORM_FEE_RATE = 0.0008; // 0.08%

const TOKENS = [
  { id: "bitcoin",  symbol: "BTC",  name: "Bitcoin",  icon: "₿", color: "#F7931A", coingecko: "bitcoin"  },
  { id: "ethereum", symbol: "ETH",  name: "Ethereum", icon: "Ξ", color: "#627EEA", coingecko: "ethereum" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", icon: "Ð", color: "#C2A633", coingecko: "dogecoin" },
  { id: "tether",   symbol: "USDT", name: "Tether",   icon: "₮", color: "#26A17B", coingecko: "tether"   },
];

// Supported swap pairs via well-known DEX aggregators
// We use Uniswap for ETH/USDT, Changelly deep-links for cross-chain
const CHANGELLY_BASE = "https://changelly.com/exchange";
const UNISWAP_BASE   = "https://app.uniswap.org/#/swap";

// Uniswap token contract addresses (Ethereum mainnet)
const UNISWAP_ADDRS = {
  ETH:  "ETH",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  // BTC/DOGE not native on Uniswap — use Changelly
};

function getSwapUrl(fromSymbol, toSymbol, amount) {
  // ETH <-> USDT: use Uniswap
  const uniPairs = new Set(["ETH-USDT", "USDT-ETH"]);
  const pair = `${fromSymbol}-${toSymbol}`;
  if (uniPairs.has(pair)) {
    const inputCurrency  = UNISWAP_ADDRS[fromSymbol];
    const outputCurrency = UNISWAP_ADDRS[toSymbol];
    return `${UNISWAP_BASE}?inputCurrency=${inputCurrency}&outputCurrency=${outputCurrency}&exactAmount=${amount || ""}`;
  }
  // Everything else: Changelly
  return `${CHANGELLY_BASE}/${fromSymbol.toLowerCase()}-to-${toSymbol.toLowerCase()}?amount=${amount || "1"}`;
}

function getProviderName(fromSymbol, toSymbol) {
  const pair = `${fromSymbol}-${toSymbol}`;
  if (["ETH-USDT", "USDT-ETH"].includes(pair)) return "Uniswap";
  return "Changelly";
}

export default function SwapPage() {
  const [fromToken, setFromToken] = useState(TOKENS[0]); // BTC
  const [toToken,   setToToken]   = useState(TOKENS[2]); // DOGE
  const [amount,    setAmount]    = useState("");
  const [prices,    setPrices]    = useState({});
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [flipping,  setFlipping]  = useState(false);
  const [feeInfo,   setFeeInfo]   = useState(null);    // last recorded fee
  const [feeLoading, setFeeLoading] = useState(false);

  // Fetch live prices from CoinGecko via our existing backend
  useEffect(() => {
    async function fetchPrices() {
      setLoadingPrices(true);
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,dogecoin,tether&vs_currencies=usd"
        );
        const data = await res.json();
        setPrices({
          bitcoin:  data.bitcoin?.usd  || 0,
          ethereum: data.ethereum?.usd || 0,
          dogecoin: data.dogecoin?.usd || 0,
          tether:   data.tether?.usd   || 0,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingPrices(false);
      }
    }
    fetchPrices();
  }, []);

  const fromPrice = prices[fromToken.coingecko] || 0;
  const toPrice   = prices[toToken.coingecko]   || 0;

  const numAmount    = parseFloat(amount) || 0;
  const fromUSD      = numAmount * fromPrice;
  const estimatedOut = toPrice > 0 ? fromUSD / toPrice : 0;
  const rate         = toPrice > 0 && fromPrice > 0 ? fromPrice / toPrice : null;
  const provider     = getProviderName(fromToken.symbol, toToken.symbol);

  function flipTokens() {
    setFlipping(true);
    setTimeout(() => {
      setFromToken(toToken);
      setToToken(fromToken);
      setAmount("");
      setFlipping(false);
    }, 180);
  }

  async function handleSwap() {
    const url = getSwapUrl(fromToken.symbol, toToken.symbol, amount);
    setFeeLoading(true);
    setFeeInfo(null);
    try {
      const res = await fetch(FEE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromToken: fromToken.symbol,
          toToken:   toToken.symbol,
          inputAmount: numAmount,
          provider: getProviderName(fromToken.symbol, toToken.symbol),
        }),
      });
      const data = await res.json();
      if (data.ok) setFeeInfo(data.fee);
    } catch (_) {}
    finally { setFeeLoading(false); }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const canSwap = fromToken.id !== toToken.id && numAmount > 0;

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0",
      fontFamily: "'Inter', sans-serif", padding: "28px 24px",
      maxWidth: "500px", margin: "0 auto",
    }}>
      {/* Title */}
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700 }}>Swap</h2>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
          Convert between tokens via Uniswap or Changelly
        </p>
      </div>

      {/* Main swap card */}
      <div style={{
        background: "#13131f", border: "1px solid #2d2d3d",
        borderRadius: "20px", padding: "20px", marginBottom: "16px",
      }}>

        {/* FROM */}
        <div style={{ marginBottom: "6px" }}>
          <label style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>From</label>
        </div>
        <div style={{
          display: "flex", gap: "10px", alignItems: "center",
          background: "#0a0a0f", borderRadius: "14px", padding: "14px",
          border: "1px solid #2d2d3d", marginBottom: "8px",
        }}>
          <TokenSelect value={fromToken} onChange={setFromToken} exclude={toToken.id} />
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            style={{
              flex: 1, background: "none", border: "none", color: "#e2e8f0",
              fontSize: "22px", fontWeight: 700, textAlign: "right", outline: "none",
            }}
          />
        </div>
        {amount && fromUSD > 0 && (
          <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748b", textAlign: "right" }}>
            ≈ ${fromUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}

        {/* Flip button */}
        <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
          <button
            onClick={flipTokens}
            style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "#1e1e2e", border: "1px solid #2d2d3d",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.18s",
              transform: flipping ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <ArrowDownUp size={16} color="#94a3b8" />
          </button>
        </div>

        {/* TO */}
        <div style={{ marginTop: "4px", marginBottom: "6px" }}>
          <label style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>To (estimated)</label>
        </div>
        <div style={{
          display: "flex", gap: "10px", alignItems: "center",
          background: "#0a0a0f", borderRadius: "14px", padding: "14px",
          border: "1px solid #2d2d3d",
        }}>
          <TokenSelect value={toToken} onChange={setToToken} exclude={fromToken.id} />
          <div style={{ flex: 1, textAlign: "right" }}>
            {loadingPrices ? (
              <Loader size={16} color="#64748b" style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <span style={{ fontSize: "22px", fontWeight: 700, color: numAmount > 0 ? "#22c55e" : "#475569" }}>
                {numAmount > 0 && estimatedOut > 0
                  ? estimatedOut < 0.001
                    ? estimatedOut.toExponential(4)
                    : estimatedOut.toLocaleString("en-US", { maximumFractionDigits: 6 })
                  : "0.00"
                }
              </span>
            )}
          </div>
        </div>
        {numAmount > 0 && estimatedOut > 0 && (
          <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#64748b", textAlign: "right" }}>
            ≈ ${(estimatedOut * toPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}
      </div>

      {/* Rate info */}
      {rate && !loadingPrices && (
        <div style={{
          background: "#13131f", border: "1px solid #2d2d3d",
          borderRadius: "14px", padding: "14px 16px", marginBottom: "16px",
          display: "flex", flexDirection: "column", gap: "8px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ color: "#64748b" }}>Exchange rate</span>
            <span style={{ fontWeight: 600 }}>
              1 {fromToken.symbol} ≈{" "}
              {rate < 0.001
                ? rate.toExponential(4)
                : rate.toLocaleString("en-US", { maximumFractionDigits: 6 })}{" "}
              {toToken.symbol}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ color: "#64748b" }}>Provider</span>
            <span style={{
              fontWeight: 600, color: provider === "Uniswap" ? "#627EEA" : "#F7931A",
              display: "flex", alignItems: "center", gap: "4px",
            }}>
              {provider} <ExternalLink size={11} />
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ color: "#64748b" }}>Platform fee</span>
            <span style={{ color: "#94a3b8" }}>
              {numAmount > 0
                ? `${(numAmount * 0.0008).toFixed(8)} ${fromToken.symbol} ≈ $${(numAmount * 0.0008 * fromPrice).toFixed(4)}`
                : "0.08% of swap"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ color: "#64748b" }}>Network fees</span>
            <span style={{ color: "#94a3b8" }}>Paid on {provider}</span>
          </div>
        </div>
      )}

      {/* Provider info banner */}
      <div style={{
        background: provider === "Uniswap" ? "#0f1428" : "#1a120a",
        border: `1px solid ${provider === "Uniswap" ? "#627EEA33" : "#F7931A33"}`,
        borderRadius: "12px", padding: "12px 14px", marginBottom: "20px",
        fontSize: "12px", color: "#94a3b8", lineHeight: "1.5",
      }}>
        {provider === "Uniswap" ? (
          <>
            <span style={{ color: "#627EEA", fontWeight: 600 }}>⟠ Uniswap</span> — ETH ↔ USDT swaps execute directly on-chain via Ethereum.
            Connect your wallet on Uniswap to confirm the transaction.
          </>
        ) : (
          <>
            <span style={{ color: "#F7931A", fontWeight: 600 }}>⬡ Changelly</span> — cross-chain swaps via a non-custodial exchange.
            No wallet connection needed — just provide a destination address on Changelly.
          </>
        )}
      </div>

      {/* Swap button */}
      <button
        onClick={handleSwap}
        disabled={!canSwap}
        style={{
          width: "100%", padding: "16px", borderRadius: "14px", border: "none",
          cursor: canSwap ? "pointer" : "not-allowed",
          background: canSwap
            ? `linear-gradient(135deg, ${fromToken.color}, ${toToken.color})`
            : "#1e1e2e",
          color: canSwap ? "#fff" : "#475569",
          fontWeight: 700, fontSize: "16px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          transition: "opacity 0.2s",
        }}
      >
        {feeLoading ? <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> Recording fee...</> : (
          <><ExternalLink size={16} />
          {canSwap
            ? `Swap ${fromToken.symbol} → ${toToken.symbol} on ${provider}`
            : "Enter an amount to swap"
          }</>
        )}
      </button>

      {/* Platform fee notice */}
      {numAmount > 0 && (
        <div style={{
          background: "#13131f", border: "1px solid #2d2d3d",
          borderRadius: "12px", padding: "12px 16px", marginBottom: "12px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "12px",
        }}>
          <span style={{ color: "#64748b" }}>Platform fee (0.08%)</span>
          <span style={{ fontWeight: 700, color: "#26A17B" }}>
            {feeLoading
              ? "calculating..."
              : feeInfo
              ? `$${Number(feeInfo.feeUSDT).toFixed(6)} USDT`
              : `≈ ${(numAmount * FEE_RATE).toFixed(8)} ${fromToken.symbol}`
            }
          </span>
        </div>
      )}

      {feeInfo && (
        <div style={{
          background: "#0f1020", border: "1px solid #6366f133",
          borderRadius: "12px", padding: "11px 14px", marginTop: "12px",
          fontSize: "12px", color: "#94a3b8", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>✓ Platform fee recorded</span>
          <span style={{ color: "#26A17B", fontWeight: 700 }}>${parseFloat(feeInfo.feeUSDT).toFixed(6)} USDT</span>
        </div>
      )}

      <p style={{ textAlign: "center", color: "#475569", fontSize: "11px", marginTop: "16px", lineHeight: "1.6" }}>
        CryptoVault opens {provider} in a new tab. Actual rates and fees are set by {provider}.<br />
        Always verify the transaction before confirming on-chain.
      </p>

      <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

// ─── Token selector dropdown ─────────────────────────────────────────────────
function TokenSelect({ value, onChange, exclude }) {
  const [open, setOpen] = useState(false);
  const options = TOKENS.filter((t) => t.id !== exclude);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "#1e1e2e", border: "1px solid #2d2d3d",
          borderRadius: "10px", padding: "8px 12px",
          cursor: "pointer", minWidth: "110px",
        }}
      >
        <span style={{ fontSize: "18px", color: value.color }}>{value.icon}</span>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0" }}>{value.symbol}</span>
        <span style={{ fontSize: "10px", color: "#64748b", marginLeft: "2px" }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
          background: "#1e1e2e", border: "1px solid #2d2d3d",
          borderRadius: "12px", overflow: "hidden", minWidth: "150px",
          boxShadow: "0 8px 24px #00000066",
        }}>
          {options.map((token) => (
            <button
              key={token.id}
              onClick={() => { onChange(token); setOpen(false); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: "10px",
                padding: "11px 14px", background: "none", border: "none",
                cursor: "pointer", color: "#e2e8f0",
                borderBottom: "1px solid #2d2d3d",
              }}
            >
              <span style={{ fontSize: "18px", color: token.color }}>{token.icon}</span>
              <div style={{ textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>{token.symbol}</p>
                <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>{token.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}