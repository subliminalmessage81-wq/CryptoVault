import { useState, useEffect, useCallback } from "react";
import {
  Shield, RefreshCw, Send, TrendingUp, DollarSign,
  Clock, CheckCircle, AlertCircle, Loader, ExternalLink,
  ArrowDownRight, Layers, Lock, ChevronDown, ChevronUp,
} from "lucide-react";

const FEE_URL     = "/functions/recordFee";
const ADMIN_PASS  = "017455"; // change this in production

const TOKEN_COLORS = { BTC: "#F7931A", ETH: "#627EEA", DOGE: "#C2A633", USDT: "#26A17B" };
const TOKEN_ICONS  = { BTC: "₿", ETH: "Ξ", DOGE: "Ð", USDT: "₮" };

function StatCard({ icon: Icon, label, value, sub, color = "#6366f1" }) {
  return (
    <div style={{
      background: "#13131f", border: "1px solid #2d2d3d", borderRadius: "14px",
      padding: "18px", display: "flex", flexDirection: "column", gap: "6px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <div style={{
          width: 32, height: 32, borderRadius: "9px", background: color + "22",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {label}
        </span>
      </div>
      <span style={{ fontSize: "22px", fontWeight: 800, color: "#e2e8f0" }}>{value}</span>
      {sub && <span style={{ fontSize: "12px", color: "#475569" }}>{sub}</span>}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    pending:   { bg: "#1a1a2e", color: "#f59e0b", label: "Pending"   },
    collected: { bg: "#16302b", color: "#22c55e", label: "Collected" },
    withdrawn: { bg: "#0f1728", color: "#6366f1", label: "Withdrawn" },
    broadcast: { bg: "#1a1530", color: "#a78bfa", label: "Broadcast" },
    confirmed: { bg: "#16302b", color: "#22c55e", label: "Confirmed" },
    failed:    { bg: "#2d1515", color: "#ef4444", label: "Failed"    },
  }[status] || { bg: "#1e1e2e", color: "#94a3b8", label: status };

  return (
    <span style={{
      fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px",
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  );
}

// ── Admin Login Gate ─────────────────────────────────────────────────────────
function AdminLogin({ onUnlock }) {
  const [pass, setPass]     = useState("");
  const [error, setError]   = useState(false);
  const [shake, setShake]   = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (pass === ADMIN_PASS) {
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setTimeout(() => setError(false), 2000);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0f",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#13131f", border: "1px solid #2d2d3d", borderRadius: "20px",
        padding: "36px 32px", width: "360px", textAlign: "center",
        transform: shake ? "translateX(-6px)" : "none",
        transition: "transform 0.1s",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "16px",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <Lock size={24} color="#fff" />
        </div>
        <h2 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: 700, color: "#e2e8f0" }}>
          Admin Access
        </h2>
        <p style={{ margin: "0 0 24px", fontSize: "13px", color: "#64748b" }}>
          Enter your admin password to continue
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Admin password"
            autoFocus
            style={{
              width: "100%", background: "#0a0a0f",
              border: `1px solid ${error ? "#ef4444" : "#2d2d3d"}`,
              borderRadius: "12px", padding: "13px 14px", color: "#e2e8f0",
              fontSize: "15px", boxSizing: "border-box", outline: "none",
              marginBottom: "12px", textAlign: "center",
              transition: "border-color 0.2s",
            }}
          />
          {error && (
            <p style={{ color: "#ef4444", fontSize: "13px", margin: "0 0 10px" }}>
              Incorrect password
            </p>
          )}
          <button
            type="submit"
            style={{
              width: "100%", padding: "13px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none", borderRadius: "12px",
              color: "#fff", fontWeight: 700, fontSize: "15px", cursor: "pointer",
            }}
          >
            Unlock Admin Panel
          </button>
        </form>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Withdraw Modal ───────────────────────────────────────────────────────────
function WithdrawModal({ availableUSDT, onClose, onSuccess }) {
  const [address, setAddress]   = useState("");
  const [notes, setNotes]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);

  const isValidAddr = /^0x[a-fA-F0-9]{40}$/.test(address);

  async function handleWithdraw() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(FEE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw", destinationAddress: address, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdrawal failed");
      setResult(data);
      onSuccess();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#00000088",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: "#13131f", border: "1px solid #2d2d3d", borderRadius: "20px",
        padding: "28px", width: "min(480px, 95vw)", color: "#e2e8f0",
      }}>
        {result ? (
          // ── Success view ──
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: "#16302b",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            }}>
              <CheckCircle size={28} color="#22c55e" />
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 700 }}>
              Withdrawal Queued
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#64748b" }}>
              {result.totalUSDT?.toFixed(4)} USDT across {result.feesIncluded} transactions
            </p>
            <div style={{
              background: "#0a0a0f", border: "1px solid #2d2d3d", borderRadius: "12px",
              padding: "14px", marginBottom: "20px", textAlign: "left",
            }}>
              <p style={{ margin: "0 0 6px", fontSize: "11px", color: "#64748b" }}>DESTINATION</p>
              <p style={{ margin: "0 0 12px", fontSize: "12px", fontFamily: "monospace", color: "#94a3b8", wordBreak: "break-all" }}>
                {address}
              </p>
              <p style={{ margin: "0 0 6px", fontSize: "11px", color: "#64748b" }}>AMOUNT</p>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#22c55e" }}>
                {result.totalUSDT?.toFixed(6)} USDT
              </p>
            </div>
            <a
              href={result.broadcastLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                width: "100%", padding: "13px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none", borderRadius: "12px",
                color: "#fff", fontWeight: 700, fontSize: "14px",
                textDecoration: "none", marginBottom: "10px",
              }}
            >
              <ExternalLink size={15} /> Send on Uniswap
            </a>
            <button
              onClick={onClose}
              style={{
                width: "100%", padding: "11px", background: "#1e1e2e",
                border: "1px solid #2d2d3d", borderRadius: "12px",
                color: "#94a3b8", cursor: "pointer", fontWeight: 600,
              }}
            >
              Close
            </button>
          </div>
        ) : (
          // ── Withdraw form ──
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Withdraw USDT</h3>
              <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "20px" }}>×</button>
            </div>

            {/* Available balance */}
            <div style={{
              background: "#0a0a0f", border: "1px solid #26A17B33",
              borderRadius: "12px", padding: "14px", marginBottom: "20px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: "13px", color: "#64748b" }}>Available balance</span>
              <span style={{ fontSize: "20px", fontWeight: 800, color: "#26A17B" }}>
                {availableUSDT?.toFixed(4)} <span style={{ fontSize: "13px" }}>USDT</span>
              </span>
            </div>

            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              USDT Destination (ERC-20)
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              style={{
                width: "100%", background: "#0a0a0f",
                border: `1px solid ${address && !isValidAddr ? "#ef4444" : "#2d2d3d"}`,
                borderRadius: "12px", padding: "12px 14px", color: "#e2e8f0",
                fontSize: "13px", fontFamily: "monospace",
                boxSizing: "border-box", outline: "none", marginBottom: "6px",
              }}
            />
            {address && !isValidAddr && (
              <p style={{ margin: "0 0 12px", fontSize: "11px", color: "#ef4444" }}>
                Must be a valid 0x ERC-20 address (42 chars)
              </p>
            )}
            {address && isValidAddr && (
              <p style={{ margin: "0 0 12px", fontSize: "11px", color: "#22c55e" }}>
                ✓ Valid USDT ERC-20 address
              </p>
            )}

            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px", marginTop: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Monthly fee collection"
              rows={2}
              style={{
                width: "100%", background: "#0a0a0f", border: "1px solid #2d2d3d",
                borderRadius: "12px", padding: "12px 14px", color: "#e2e8f0",
                fontSize: "13px", boxSizing: "border-box", outline: "none",
                resize: "none", marginBottom: "20px",
              }}
            />

            {error && (
              <div style={{
                background: "#2d1515", border: "1px solid #ef444444",
                borderRadius: "10px", padding: "11px 14px", marginBottom: "14px",
                display: "flex", gap: "8px", alignItems: "center",
                color: "#ef4444", fontSize: "13px",
              }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <button
              onClick={handleWithdraw}
              disabled={loading || !isValidAddr || availableUSDT <= 0}
              style={{
                width: "100%", padding: "14px",
                background: loading || !isValidAddr || availableUSDT <= 0
                  ? "#1e1e2e"
                  : "linear-gradient(135deg, #26A17B, #16a085)",
                border: "none", borderRadius: "12px",
                color: loading || !isValidAddr || availableUSDT <= 0 ? "#475569" : "#fff",
                fontWeight: 700, fontSize: "15px",
                cursor: loading || !isValidAddr || availableUSDT <= 0 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              {loading
                ? <><Loader size={15} style={{ animation: "spin 1s linear infinite" }} /> Processing...</>
                : <><Send size={15} /> Withdraw {availableUSDT?.toFixed(4)} USDT</>
              }
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Admin Panel ─────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [unlocked, setUnlocked]           = useState(false);
  const [data, setData]                   = useState(null);
  const [loading, setLoading]             = useState(false);
  const [showWithdraw, setShowWithdraw]   = useState(false);
  const [showHistory, setShowHistory]     = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(FEE_URL, { method: "GET" });
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (unlocked) fetchData();
  }, [unlocked, fetchData]);

  if (!unlocked) return <AdminLogin onUnlock={() => setUnlocked(true)} />;

  const summary     = data?.summary     || {};
  const recentFees  = data?.recentFees  || [];
  const withdrawals = data?.withdrawals || [];

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0",
      fontFamily: "'Inter', sans-serif", padding: "28px 24px",
      maxWidth: "900px", margin: "0 auto",
    }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: 38, height: 38, borderRadius: "11px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Shield size={18} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800 }}>Admin Panel</h2>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>Platform fee management & withdrawals</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#13131f", border: "1px solid #2d2d3d",
            borderRadius: "10px", padding: "9px 14px",
            color: "#94a3b8", cursor: "pointer", fontSize: "13px", fontWeight: 600,
          }}
        >
          <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px", marginBottom: "28px",
      }}>
        <StatCard
          icon={DollarSign}
          label="Available USDT"
          value={`$${(summary.availableUSDT || 0).toFixed(4)}`}
          sub="Ready to withdraw"
          color="#26A17B"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Collected"
          value={`$${(summary.totalFeesUSDT || 0).toFixed(4)}`}
          sub={`${summary.totalTransactions || 0} transactions`}
          color="#6366f1"
        />
        <StatCard
          icon={ArrowDownRight}
          label="Total Withdrawn"
          value={`$${(summary.totalWithdrawnUSDT || 0).toFixed(4)}`}
          sub={`${withdrawals.length} withdrawals`}
          color="#8b5cf6"
        />
        <StatCard
          icon={Layers}
          label="Fee Rate"
          value="0.08%"
          sub="Per swap transaction"
          color="#F7931A"
        />
      </div>

      {/* Per-token breakdown */}
      {Object.keys(summary.byToken || {}).length > 0 && (
        <div style={{
          background: "#13131f", border: "1px solid #2d2d3d",
          borderRadius: "16px", padding: "20px", marginBottom: "20px",
        }}>
          <p style={{ margin: "0 0 16px", fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Fees by Token
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {Object.entries(summary.byToken).map(([token, info]) => (
              <div key={token} style={{
                background: "#0a0a0f", border: `1px solid ${TOKEN_COLORS[token] || "#2d2d3d"}44`,
                borderRadius: "12px", padding: "14px 18px",
                display: "flex", alignItems: "center", gap: "10px",
              }}>
                <span style={{ fontSize: "22px", color: TOKEN_COLORS[token] || "#e2e8f0" }}>
                  {TOKEN_ICONS[token] || token}
                </span>
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 700 }}>{token}</p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
                    {info.count} swaps · ${info.feeUSDT.toFixed(4)} USDT
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Withdraw button */}
      <button
        onClick={() => setShowWithdraw(true)}
        disabled={(summary.availableUSDT || 0) <= 0}
        style={{
          width: "100%", padding: "15px",
          background: (summary.availableUSDT || 0) > 0
            ? "linear-gradient(135deg, #26A17B, #16a085)"
            : "#1e1e2e",
          border: "none", borderRadius: "14px",
          color: (summary.availableUSDT || 0) > 0 ? "#fff" : "#475569",
          fontWeight: 700, fontSize: "16px",
          cursor: (summary.availableUSDT || 0) > 0 ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          marginBottom: "20px",
        }}
      >
        <Send size={16} />
        {(summary.availableUSDT || 0) > 0
          ? `Withdraw ${(summary.availableUSDT || 0).toFixed(4)} USDT to Address`
          : "No fees available to withdraw"
        }
      </button>

      {/* Recent Fees */}
      <div style={{
        background: "#13131f", border: "1px solid #2d2d3d",
        borderRadius: "16px", overflow: "hidden", marginBottom: "16px",
      }}>
        <div
          onClick={() => {}}
          style={{
            padding: "16px 20px", borderBottom: "1px solid #2d2d3d",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock size={15} color="#6366f1" />
            <span style={{ fontSize: "14px", fontWeight: 700 }}>Recent Fee Collections</span>
            {recentFees.length > 0 && (
              <span style={{
                fontSize: "11px", padding: "2px 7px", borderRadius: "5px",
                background: "#6366f122", color: "#6366f1", fontWeight: 700,
              }}>
                {recentFees.length}
              </span>
            )}
          </div>
        </div>

        {recentFees.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#475569" }}>
            <TrendingUp size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: "14px" }}>No fees collected yet</p>
            <p style={{ margin: "4px 0 0", fontSize: "12px" }}>Fees appear here once users complete swaps</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #2d2d3d" }}>
                  {["Date", "Pair", "Input", "Fee (token)", "Fee (USDT)", "Provider", "Status"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentFees.map((fee) => (
                  <tr key={fee.id} style={{ borderBottom: "1px solid #1e1e2e" }}>
                    <td style={{ padding: "11px 14px", color: "#64748b", whiteSpace: "nowrap" }}>
                      {new Date(fee.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                      <span style={{ color: TOKEN_COLORS[fee.fromToken] }}>{fee.fromToken}</span>
                      <span style={{ color: "#475569" }}> → </span>
                      <span style={{ color: TOKEN_COLORS[fee.toToken] || "#94a3b8" }}>{fee.toToken}</span>
                    </td>
                    <td style={{ padding: "11px 14px", fontFamily: "monospace", color: "#e2e8f0" }}>
                      {fee.inputAmount?.toFixed(6)}
                    </td>
                    <td style={{ padding: "11px 14px", fontFamily: "monospace", color: TOKEN_COLORS[fee.fromToken] || "#94a3b8" }}>
                      {fee.feeAmount?.toFixed(8)}
                    </td>
                    <td style={{ padding: "11px 14px", fontFamily: "monospace", fontWeight: 600, color: "#26A17B" }}>
                      ${fee.feeUSDT?.toFixed(6)}
                    </td>
                    <td style={{ padding: "11px 14px", color: "#94a3b8" }}>
                      {fee.provider}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <StatusBadge status={fee.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Withdrawal history */}
      <div style={{
        background: "#13131f", border: "1px solid #2d2d3d",
        borderRadius: "16px", overflow: "hidden",
      }}>
        <button
          onClick={() => setShowHistory(!showHistory)}
          style={{
            width: "100%", padding: "16px 20px",
            background: "none", border: "none", cursor: "pointer",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderBottom: showHistory ? "1px solid #2d2d3d" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ArrowDownRight size={15} color="#8b5cf6" />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0" }}>Withdrawal History</span>
            {withdrawals.length > 0 && (
              <span style={{
                fontSize: "11px", padding: "2px 7px", borderRadius: "5px",
                background: "#8b5cf622", color: "#8b5cf6", fontWeight: 700,
              }}>
                {withdrawals.length}
              </span>
            )}
          </div>
          {showHistory ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
        </button>

        {showHistory && (
          withdrawals.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#475569" }}>
              <p style={{ margin: 0, fontSize: "14px" }}>No withdrawals yet</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #2d2d3d" }}>
                    {["Date", "Amount (USDT)", "Fees Included", "Destination", "Status"].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: "11px", textTransform: "uppercase" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id} style={{ borderBottom: "1px solid #1e1e2e" }}>
                      <td style={{ padding: "11px 14px", color: "#64748b", whiteSpace: "nowrap" }}>
                        {new Date(w.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td style={{ padding: "11px 14px", fontWeight: 700, color: "#26A17B", fontFamily: "monospace" }}>
                        ${w.amountUSDT?.toFixed(6)}
                      </td>
                      <td style={{ padding: "11px 14px", color: "#94a3b8" }}>
                        {w.feesIncluded} records
                      </td>
                      <td style={{ padding: "11px 14px", fontFamily: "monospace", color: "#94a3b8", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {w.destinationAddress}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <StatusBadge status={w.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {showWithdraw && (
        <WithdrawModal
          availableUSDT={summary.availableUSDT || 0}
          onClose={() => setShowWithdraw(false)}
          onSuccess={fetchData}
        />
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
