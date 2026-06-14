import { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  RefreshCw,
  AlertCircle,
  Loader,
} from "lucide-react";

// ─── Chain metadata (static display config) ──────────────────────────────────
const CHAIN_META = {
  btc:  { name: "Bitcoin",  symbol: "BTC",  color: "#F7931A", icon: "₿" },
  eth:  { name: "Ethereum", symbol: "ETH",  color: "#627EEA", icon: "Ξ" },
  doge: { name: "Dogecoin", symbol: "DOGE", color: "#C2A633", icon: "Ð" },
  usdt: { name: "Tether",   symbol: "USDT", color: "#26A17B", icon: "₮" },
};

const SETTINGS_URL = "/functions/walletSettings";
const EMPTY_ADDRESSES = { btcAddress: "", ethAddress: "", dogeAddress: "", usdtAddress: "" };

const BACKEND_URL = "/functions/getWalletData";

function timeAgo(timestamp) {
  if (!timestamp) return "unknown";
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Sparkline({ change }) {
  const seed = change > 0 ? 1 : -1;
  const points = Array.from({ length: 12 }, (_, i) => {
    const noise = ((i * 13 + 7) % 17) - 8;
    return 40 + (seed > 0 ? -i * 2 : i * 2) + noise;
  }).reverse();
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const normalize = (v) => ((v - min) / range) * 36;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (points.length - 1)) * 100} ${38 - normalize(p)}`)
    .join(" ");
  return (
    <svg width="100" height="40" viewBox="0 0 100 40">
      <path d={path} fill="none" stroke={change >= 0 ? "#22c55e" : "#ef4444"}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AddressInput({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label style={{ display: "block", fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", background: "#0d0d1a", border: "1px solid #2d2d4d",
          borderRadius: "10px", padding: "10px 12px", color: "#e2e8f0",
          fontSize: "13px", boxSizing: "border-box", fontFamily: "monospace",
        }}
      />
    </div>
  );
}

export default function CryptoVaultDashboard({ savedAddresses }) {
  const [addresses, setAddresses] = useState(EMPTY_ADDRESSES);

  // When saved addresses load from Settings, pre-fill the form
  useEffect(() => {
    if (savedAddresses && Object.values(savedAddresses).some((v) => v)) {
      setAddresses((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.entries(savedAddresses).filter(([, v]) => v)),
      }));
    }
  }, [savedAddresses]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [wallets, setWallets] = useState([]);
  const [prices, setPrices] = useState({});
  const [totalUSD, setTotalUSD] = useState(0);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeChain, setActiveChain] = useState("btc");
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(true);
  const [sendForm, setSendForm] = useState({ to: "", amount: "" });

  const hasAnyAddress = Object.values(addresses).some((a) => a.trim() !== "");

  // Auto-load saved addresses from DB on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(SETTINGS_URL, { method: "GET" });
        const data = await res.json();
        if (data.settings) {
          const s = {
            btcAddress:  data.settings.btcAddress  || "",
            ethAddress:  data.settings.ethAddress  || "",
            dogeAddress: data.settings.dogeAddress || "",
            usdtAddress: data.settings.usdtAddress || "",
          };
          setAddresses(s);
          // If all addresses empty keep form open; otherwise auto-fetch
          const hasAny = Object.values(s).some((v) => v.trim());
          if (hasAny) setShowAddressForm(false);
        }
      } catch (_) {}
      finally { setSettingsLoading(false); }
    })();
  }, []);

  const fetchWalletData = useCallback(async () => {
    const payload = {};
    if (addresses.btcAddress.trim())  payload.btcAddress  = addresses.btcAddress.trim();
    if (addresses.ethAddress.trim())  payload.ethAddress  = addresses.ethAddress.trim();
    if (addresses.dogeAddress.trim()) payload.dogeAddress = addresses.dogeAddress.trim();
    if (addresses.usdtAddress.trim()) payload.usdtAddress = addresses.usdtAddress.trim();

    if (Object.keys(payload).length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch wallet data");
      setWallets(data.wallets || []);
      setPrices(data.prices || {});
      setTotalUSD(data.totalUSD || 0);
      setFetchedAt(data.fetchedAt);
      setShowAddressForm(false);
      // Set active chain to first wallet returned
      if (data.wallets?.length > 0) setActiveChain(data.wallets[0].chain);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [addresses]);

  const selectedWallet = wallets.find((w) => w.chain === activeChain);
  const selectedMeta = CHAIN_META[activeChain];
  const allTransactions = wallets
    .flatMap((w) => (w.transactions || []).map((tx) => ({ ...tx, chain: w.chain })))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'Inter', sans-serif", padding: "24px", maxWidth: "640px", margin: "0 auto" }}>

      {/* Action Buttons */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginBottom: "24px" }}>
          <button
            onClick={() => setShowAddressForm((v) => !v)}
            style={{
              background: "#1e1e2e", border: "1px solid #2d2d3d", borderRadius: "10px",
              color: "#94a3b8", padding: "8px 14px", cursor: "pointer", fontSize: "13px",
            }}
          >
            ⚙ Wallets
          </button>
          <button
            onClick={fetchWalletData}
            disabled={loading || !hasAnyAddress}
            style={{
              background: loading ? "#2d2d3d" : "#1e1e2e", border: "1px solid #2d2d3d",
              borderRadius: "10px", color: loading ? "#64748b" : "#94a3b8",
              padding: "8px 14px", cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: "6px", fontSize: "13px",
            }}
          >
            {loading
              ? <><Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> Syncing...</>
              : <><RefreshCw size={14} /> Sync</>}
          </button>
      </div>
      {/* Address Config Panel */}
      {showAddressForm && (
        <div style={{
          background: "#1a1a2e", border: "1px solid #2d2d4d", borderRadius: "16px",
          padding: "20px", marginBottom: "24px",
        }}>
          <p style={{ margin: "0 0 16px", fontWeight: 600, fontSize: "15px" }}>🔑 Enter Your Wallet Addresses</p>
          <AddressInput label="Bitcoin (BTC)" value={addresses.btcAddress}
            onChange={(v) => setAddresses((a) => ({ ...a, btcAddress: v }))}
            placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" />
          <AddressInput label="Ethereum (ETH)" value={addresses.ethAddress}
            onChange={(v) => setAddresses((a) => ({ ...a, ethAddress: v }))}
            placeholder="0x..." />
          <AddressInput label="Dogecoin (DOGE)" value={addresses.dogeAddress}
            onChange={(v) => setAddresses((a) => ({ ...a, dogeAddress: v }))}
            placeholder="DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L" />
          <AddressInput label="USDT (ERC-20 — same as ETH address)" value={addresses.usdtAddress}
            onChange={(v) => setAddresses((a) => ({ ...a, usdtAddress: v }))}
            placeholder="0x..." />
          <button
            onClick={fetchWalletData}
            disabled={!hasAnyAddress || loading}
            style={{
              width: "100%", padding: "13px", marginTop: "4px",
              background: hasAnyAddress ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#2d2d3d",
              border: "none", borderRadius: "10px", color: hasAnyAddress ? "#fff" : "#64748b",
              fontWeight: 700, fontSize: "15px", cursor: hasAnyAddress ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "Fetching..." : "Load Wallet Data"}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: "#2d1515", border: "1px solid #ef444444", borderRadius: "12px",
          padding: "14px 16px", marginBottom: "20px",
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <AlertCircle size={16} color="#ef4444" />
          <span style={{ fontSize: "13px", color: "#ef4444" }}>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && wallets.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
          <Loader size={32} style={{ animation: "spin 1s linear infinite", marginBottom: "12px" }} />
          <p style={{ margin: 0 }}>Fetching live blockchain data...</p>
        </div>
      )}

      {/* Main dashboard — only shown after data loads */}
      {wallets.length > 0 && (
        <>
          {/* Total Balance */}
          <div style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            border: "1px solid #2d2d4d", borderRadius: "20px", padding: "28px",
            marginBottom: "24px", textAlign: "center",
          }}>
            <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>
              Total Portfolio Value
            </p>
            <h1 style={{ fontSize: "42px", fontWeight: 800, margin: "0 0 8px 0", letterSpacing: "-1px" }}>
              ${totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h1>
            {fetchedAt && (
              <span style={{ color: "#64748b", fontSize: "12px" }}>
                Last synced: {new Date(fetchedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Chain Cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: wallets.length <= 3 ? `repeat(${wallets.length}, 1fr)` : "repeat(2, 1fr)",
            gap: "16px", marginBottom: "24px",
          }}>
            {wallets.map((wallet) => {
              const meta = CHAIN_META[wallet.chain] || {};
              return (
                <div
                  key={wallet.chain}
                  onClick={() => setActiveChain(wallet.chain)}
                  style={{
                    background: activeChain === wallet.chain ? "#1e1e2e" : "#13131f",
                    border: `1px solid ${activeChain === wallet.chain ? (meta.color || "#6366f1") + "66" : "#2d2d3d"}`,
                    borderRadius: "16px", padding: "18px", cursor: "pointer", transition: "all 0.2s",
                    boxShadow: activeChain === wallet.chain ? `0 0 20px ${meta.color || "#6366f1"}22` : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "20px" }}>{meta.icon}</span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: meta.color }}>{meta.symbol}</span>
                    </div>
                    <span style={{
                      fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "6px",
                      background: wallet.change24h >= 0 ? "#16302b" : "#2d1515",
                      color: wallet.change24h >= 0 ? "#22c55e" : "#ef4444",
                    }}>
                      {wallet.change24h >= 0 ? "+" : ""}{wallet.change24h?.toFixed(2)}%
                    </span>
                  </div>
                  <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#64748b" }}>{meta.name}</p>
                  <p style={{ margin: "0 0 2px", fontSize: "18px", fontWeight: 700 }}>
                    {wallet.chain === "usdt"
                      ? wallet.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })
                      : wallet.chain === "doge"
                      ? wallet.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })
                      : wallet.balance.toFixed(6)}{" "}
                    <span style={{ fontSize: "11px", color: meta.color }}>{meta.symbol}</span>
                  </p>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                    ${wallet.usdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div style={{ marginTop: "10px" }}>
                    <Sparkline change={wallet.change24h || 0} />
                  </div>
                  {wallet.error && (
                    <p style={{ margin: "6px 0 0", fontSize: "10px", color: "#ef4444" }}>⚠ Data partial</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* USDT note */}
          {wallets.some((w) => w.chain === "usdt") && (
            <div style={{
              background: "#0f1f1a", border: "1px solid #26A17B44", borderRadius: "10px",
              padding: "10px 14px", marginBottom: "20px",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <span style={{ fontSize: "16px" }}>₮</span>
              <span style={{ fontSize: "12px", color: "#26A17B" }}>USDT runs on Ethereum (ERC-20) — use your ETH address to receive Tether</span>
            </div>
          )}

          {/* Send / Receive Buttons */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
            <button
              onClick={() => { setShowSend(true); setShowReceive(false); }}
              style={{
                flex: 1, padding: "14px", borderRadius: "14px", border: "none", cursor: "pointer",
                background: showSend ? "#6366f1" : "#1e1e2e",
                color: showSend ? "#fff" : "#94a3b8",
                fontWeight: 600, fontSize: "15px", display: "flex",
                alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.2s",
              }}
            >
              <ArrowUpRight size={18} /> Send {selectedMeta?.symbol}
            </button>
            <button
              onClick={() => { setShowReceive(true); setShowSend(false); }}
              style={{
                flex: 1, padding: "14px", borderRadius: "14px", border: "none", cursor: "pointer",
                background: showReceive ? "#22c55e" : "#1e1e2e",
                color: showReceive ? "#fff" : "#94a3b8",
                fontWeight: 600, fontSize: "15px", display: "flex",
                alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.2s",
              }}
            >
              <ArrowDownLeft size={18} /> Receive {selectedMeta?.symbol}
            </button>
          </div>

          {/* Send Panel */}
          {showSend && (
            <div style={{
              background: "#1a1a2e", border: "1px solid #2d2d4d", borderRadius: "16px",
              padding: "20px", marginBottom: "24px",
            }}>
              <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>Send {selectedMeta?.symbol}</h3>
              {activeChain === "usdt" && (
                <p style={{ margin: "0 0 14px", fontSize: "12px", color: "#26A17B" }}>
                  ₮ Sending USDT via Ethereum — gas fees apply
                </p>
              )}
              <input
                value={sendForm.to}
                onChange={(e) => setSendForm((f) => ({ ...f, to: e.target.value }))}
                placeholder="Recipient address"
                style={{
                  width: "100%", background: "#0d0d1a", border: "1px solid #2d2d4d",
                  borderRadius: "10px", padding: "12px", color: "#e2e8f0", fontSize: "14px",
                  marginBottom: "12px", boxSizing: "border-box",
                }}
              />
              <div style={{ position: "relative", marginBottom: "16px" }}>
                <input
                  value={sendForm.amount}
                  onChange={(e) => setSendForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder={`Amount in ${selectedMeta?.symbol}`}
                  type="number"
                  style={{
                    width: "100%", background: "#0d0d1a", border: "1px solid #2d2d4d",
                    borderRadius: "10px", padding: "12px", color: "#e2e8f0", fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
                {sendForm.amount && selectedWallet?.priceUSD && (
                  <span style={{
                    position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                    fontSize: "12px", color: "#64748b",
                  }}>
                    ≈ ${(parseFloat(sendForm.amount) * selectedWallet.priceUSD).toFixed(2)}
                  </span>
                )}
              </div>
              <button style={{
                width: "100%", padding: "13px", background: "#6366f1", border: "none",
                borderRadius: "10px", color: "#fff", fontWeight: 700, fontSize: "15px", cursor: "pointer",
              }}>
                Confirm Send
              </button>
            </div>
          )}

          {/* Receive Panel */}
          {showReceive && selectedWallet && (
            <div style={{
              background: "#1a1a2e", border: "1px solid #2d2d4d", borderRadius: "16px",
              padding: "20px", marginBottom: "24px", textAlign: "center",
            }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "16px" }}>Receive {selectedMeta?.symbol}</h3>
              <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "16px" }}>
                Your {selectedMeta?.name} address{activeChain === "usdt" ? " (ERC-20 on Ethereum)" : ""}
              </p>
              <div style={{
                background: "#0d0d1a", border: "1px solid #2d2d4d", borderRadius: "10px",
                padding: "14px", fontFamily: "monospace", fontSize: "12px", color: "#94a3b8",
                wordBreak: "break-all", marginBottom: "12px",
              }}>
                {selectedWallet.address}
              </div>
              <button
                onClick={() => navigator.clipboard?.writeText(selectedWallet.address)}
                style={{
                  padding: "10px 24px", background: "#22c55e", border: "none",
                  borderRadius: "10px", color: "#fff", fontWeight: 600, cursor: "pointer",
                }}
              >
                Copy Address
              </button>
            </div>
          )}

          {/* Recent Transactions */}
          <div style={{
            background: "#13131f", border: "1px solid #2d2d3d", borderRadius: "16px", padding: "20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <Clock size={16} color="#64748b" />
              <span style={{ fontWeight: 600, fontSize: "15px" }}>Recent Transactions</span>
              <span style={{ marginLeft: "auto", fontSize: "11px", color: "#64748b" }}>All chains</span>
            </div>
            {allTransactions.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
                No transactions found
              </p>
            ) : (
              allTransactions.map((tx, i) => {
                const meta = CHAIN_META[tx.chain] || {};
                return (
                  <div
                    key={tx.hash || i}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 0",
                      borderBottom: i < allTransactions.length - 1 ? "1px solid #1e1e2e" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "10px",
                        background: tx.type === "receive" ? "#16302b" : "#2d1515",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        {tx.type === "receive"
                          ? <ArrowDownLeft size={16} color="#22c55e" />
                          : <ArrowUpRight size={16} color="#ef4444" />}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
                          {tx.type === "receive" ? "Received" : "Sent"}{" "}
                          <span style={{ color: meta.color }}>{meta.symbol}</span>
                        </p>
                        <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
                          {tx.hash ? `${tx.hash.slice(0, 8)}...${tx.hash.slice(-6)}` : "—"} · {timeAgo(tx.timestamp)}
                        </p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{
                        margin: 0, fontSize: "14px", fontWeight: 700,
                        color: tx.type === "receive" ? "#22c55e" : "#ef4444",
                      }}>
                        {tx.type === "receive" ? "+" : "-"}
                        {tx.chain === "doge" || tx.chain === "usdt"
                          ? tx.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })
                          : tx.amount.toFixed(6)}{" "}
                        {meta.symbol}
                      </p>
                      <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
                        {tx.confirmations > 0 ? `${tx.confirmations} conf.` : "⏳ pending"}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
