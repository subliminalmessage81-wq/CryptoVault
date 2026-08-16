import { useState, useEffect, useCallback } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Loader, BarChart2 } from "lucide-react";

const BACKEND_URL = "/functions/getMarketData";

const TOKEN_META = {
  bitcoin:  { symbol: "BTC",  name: "Bitcoin",  color: "#F7931A", icon: "₿",  id: "bitcoin"  },
  ethereum: { symbol: "ETH",  name: "Ethereum", color: "#627EEA", icon: "Ξ",  id: "ethereum" },
  dogecoin: { symbol: "DOGE", name: "Dogecoin", color: "#C2A633", icon: "Ð",  id: "dogecoin" },
  tether:   { symbol: "USDT", name: "Tether",   color: "#26A17B", icon: "₮",  id: "tether"   },
};

const TOKEN_ORDER = ["bitcoin", "ethereum", "dogecoin", "tether"];

function formatPrice(usd, symbol) {
  if (symbol === "DOGE" || symbol === "USDT") {
    return `$${usd?.toFixed(4) ?? "—"}`;
  }
  if (symbol === "ETH") return `$${usd?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "—"}`;
  return `$${usd?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "—"}`;
}

function formatVolume(v) {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
}

function formatMarketCap(v) {
  if (!v) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  return `$${v.toLocaleString()}`;
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────
function PriceChart({ prices, color, width = 600, height = 120 }) {
  if (!prices || prices.length < 2) {
    return (
      <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#64748b", fontSize: "13px" }}>No data</span>
      </div>
    );
  }

  const values = prices.map((p) => p[1]);
  const times  = prices.map((p) => p[0]);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const rangeV = maxV - minV || 1;
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const rangeT = maxT - minT || 1;

  const pad = { top: 10, bottom: 28, left: 8, right: 8 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const toX = (t) => pad.left + ((t - minT) / rangeT) * chartW;
  const toY = (v) => pad.top + chartH - ((v - minV) / rangeV) * chartH;

  const linePath = prices
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p[0]).toFixed(1)} ${toY(p[1]).toFixed(1)}`)
    .join(" ");

  // Gradient fill
  const fillPath = `${linePath} L ${toX(times[times.length - 1]).toFixed(1)} ${(pad.top + chartH).toFixed(1)} L ${toX(times[0]).toFixed(1)} ${(pad.top + chartH).toFixed(1)} Z`;

  // Time labels — first and last
  const fmtTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Price labels — min and max
  const isUp = values[values.length - 1] >= values[0];
  const gradId = `grad-${color.replace("#", "")}`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Horizontal grid lines */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={pad.left} y1={pad.top + chartH * (1 - f)}
          x2={pad.left + chartW} y2={pad.top + chartH * (1 - f)}
          stroke="#ffffff08" strokeWidth="1"
        />
      ))}

      {/* Fill area */}
      <path d={fillPath} fill={`url(#${gradId})`} />

      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Dot at current price */}
      <circle
        cx={toX(times[times.length - 1]).toFixed(1)}
        cy={toY(values[values.length - 1]).toFixed(1)}
        r="3.5" fill={color} stroke="#0a0a0f" strokeWidth="1.5"
      />

      {/* Time axis labels */}
      <text x={pad.left} y={height - 4} fill="#64748b" fontSize="10" textAnchor="start">
        {fmtTime(times[0])}
      </text>
      <text x={pad.left + chartW / 2} y={height - 4} fill="#64748b" fontSize="10" textAnchor="middle">
        {fmtTime(times[Math.floor(times.length / 2)])}
      </text>
      <text x={pad.left + chartW} y={height - 4} fill="#64748b" fontSize="10" textAnchor="end">
        {fmtTime(times[times.length - 1])}
      </text>
    </svg>
  );
}

// ─── Single token card with chart ────────────────────────────────────────────
function TokenCard({ coinId, priceData, history, expanded, onToggle }) {
  const meta = TOKEN_META[coinId];
  if (!meta) return null;

  const change = priceData?.change24h ?? 0;
  const isUp = change >= 0;
  const prices = history?.prices || [];

  // 1h change from first to last data point
  const h1Change = prices.length >= 2
    ? ((prices[prices.length - 1][1] - prices[0][1]) / prices[0][1]) * 100
    : null;

  return (
    <div style={{
      background: "#13131f",
      border: `1px solid ${expanded ? meta.color + "55" : "#2d2d3d"}`,
      borderRadius: "20px",
      overflow: "hidden",
      transition: "all 0.2s",
      boxShadow: expanded ? `0 0 24px ${meta.color}18` : "none",
    }}>
      {/* Card header — always visible */}
      <div
        onClick={onToggle}
        style={{ padding: "20px 24px", cursor: "pointer", userSelect: "none" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          {/* Left: icon + name */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: 44, height: 44, borderRadius: "14px",
              background: meta.color + "22",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "22px", color: meta.color, fontWeight: 700,
            }}>
              {meta.icon}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "16px" }}>{meta.name}</p>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>{meta.symbol} · 1h chart</p>
            </div>
          </div>

          {/* Right: price + badges */}
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: "0 0 6px", fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>
              {formatPrice(priceData?.usd, meta.symbol)}
            </p>
            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
              {/* 24h change */}
              <span style={{
                fontSize: "12px", fontWeight: 600, padding: "3px 8px", borderRadius: "6px",
                background: isUp ? "#16302b" : "#2d1515",
                color: isUp ? "#22c55e" : "#ef4444",
                display: "flex", alignItems: "center", gap: "3px",
              }}>
                {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {isUp ? "+" : ""}{change.toFixed(2)}% 24h
              </span>
              {/* 1h change */}
              {h1Change !== null && (
                <span style={{
                  fontSize: "12px", fontWeight: 600, padding: "3px 8px", borderRadius: "6px",
                  background: h1Change >= 0 ? "#16302b" : "#2d1515",
                  color: h1Change >= 0 ? "#22c55e" : "#ef4444",
                }}>
                  {h1Change >= 0 ? "+" : ""}{h1Change.toFixed(3)}% 1h
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: "flex", gap: "24px", marginTop: "16px", paddingTop: "14px",
          borderTop: "1px solid #1e1e2e",
        }}>
          <div>
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Market Cap</p>
            <p style={{ margin: "2px 0 0", fontSize: "13px", fontWeight: 600 }}>{formatMarketCap(priceData?.marketCap)}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>24h Volume</p>
            <p style={{ margin: "2px 0 0", fontSize: "13px", fontWeight: 600 }}>{formatVolume(priceData?.volume)}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>1h Range</p>
            <p style={{ margin: "2px 0 0", fontSize: "13px", fontWeight: 600 }}>
              {prices.length >= 2
                ? `${formatPrice(Math.min(...prices.map(p => p[1])), meta.symbol)} – ${formatPrice(Math.max(...prices.map(p => p[1])), meta.symbol)}`
                : "—"}
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#64748b" }}>{expanded ? "▲ collapse" : "▼ chart"}</span>
          </div>
        </div>
      </div>

      {/* Expandable chart */}
      {expanded && (
        <div style={{ padding: "0 20px 20px" }}>
          <div style={{
            background: "#0a0a0f", borderRadius: "14px",
            padding: "16px 12px 8px",
            border: "1px solid #1e1e2e",
          }}>
            <PriceChart prices={prices} color={meta.color} width={560} height={140} />
          </div>
          {history?.error && (
            <p style={{ margin: "8px 0 0", fontSize: "11px", color: "#ef4444" }}>
              ⚠ Chart data unavailable: {history.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Markets Page ─────────────────────────────────────────────────────────────
export default function MarketsPage() {
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [expanded, setExpanded] = useState({ bitcoin: true, ethereum: true, dogecoin: true, tether: true });
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setMarketData(data);
      setFetchedAt(data.fetchedAt);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  // Auto-refresh every 60s if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchMarkets, 60000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchMarkets]);

  const toggleCard = (coinId) =>
    setExpanded((e) => ({ ...e, [coinId]: !e[coinId] }));

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0",
      fontFamily: "'Inter', sans-serif", padding: "24px",
      maxWidth: "720px", margin: "0 auto",
    }}>
      {/* Controls */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            style={{
              background: autoRefresh ? "#16302b" : "#1e1e2e",
              border: `1px solid ${autoRefresh ? "#22c55e55" : "#2d2d3d"}`,
              borderRadius: "10px", color: autoRefresh ? "#22c55e" : "#64748b",
              padding: "8px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 600,
            }}
          >
            {autoRefresh ? "● Auto" : "○ Auto"}
          </button>
          <button
            onClick={fetchMarkets}
            disabled={loading}
            style={{
              background: "#1e1e2e", border: "1px solid #2d2d3d", borderRadius: "10px",
              color: loading ? "#64748b" : "#94a3b8", padding: "8px 14px",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: "6px", fontSize: "13px",
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            {loading ? "Loading..." : "Refresh"}
          </button>
      </div>
      {/* Last updated */}
      {fetchedAt && !loading && (
        <p style={{ margin: "0 0 20px", fontSize: "12px", color: "#64748b", textAlign: "right" }}>
          Updated: {new Date(fetchedAt).toLocaleTimeString()}
          {autoRefresh && " · auto-refreshes every 60s"}
        </p>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: "#2d1515", border: "1px solid #ef444444", borderRadius: "12px",
          padding: "14px 16px", marginBottom: "20px", fontSize: "13px", color: "#ef4444",
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !marketData && (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#64748b" }}>
          <Loader size={36} style={{ animation: "spin 1s linear infinite", marginBottom: "16px" }} />
          <p style={{ margin: 0, fontSize: "14px" }}>Fetching live market data...</p>
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#475569" }}>This takes ~15s due to rate limiting</p>
        </div>
      )}

      {/* Token cards */}
      {marketData && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {TOKEN_ORDER.map((coinId) => (
            <TokenCard
              key={coinId}
              coinId={coinId}
              priceData={marketData.currentPrices?.[coinId]}
              history={marketData.history?.[coinId]}
              expanded={expanded[coinId]}
              onToggle={() => toggleCard(coinId)}
            />
          ))}
        </div>
      )}

      {/* Refresh hint when showing stale data */}
      {marketData && !loading && (
        <p style={{ textAlign: "center", color: "#475569", fontSize: "12px", marginTop: "24px" }}>
          Charts show the past 60 minutes · Click any card to collapse/expand
        </p>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
