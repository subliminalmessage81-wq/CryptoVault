import { useState, useEffect, useCallback } from "react";
import {
  Shield, TrendingUp, Send, RefreshCw, CheckCircle,
  AlertCircle, Loader, ArrowDownRight, Clock, Coins,
  ExternalLink, Lock, Eye, EyeOff, ChevronDown, ChevronUp,
} from "lucide-react";

const FEE_URL = "/functions/recordFee";
const ADMIN_PIN   = "017455"; // Change this — stored client-side as basic access gate

const TOKEN_COLORS = { BTC: "#F7931A", ETH: "#627EEA", DOGE: "#C2A633", USDT: "#26A17B" };
const TOKEN_ICONS  = { BTC: "₿", ETH: "Ξ", DOGE: "Ð", USDT: "₮" };

function StatCard({ label, value, sub, color = "#6366f1", icon }) {
  return (
    <div style={{
      background: "#13131f", border: `1px solid ${color}33`,
      borderRadius: "16px", padding: "20px",
      display: "flex", flexDirection: "column", gap: "6px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
        <span style={{ fontSize: "20px" }}>{icon}</span>
      </div>
      <span style={{ fontSize: "26px", fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: "12px", color: "#475569" }}>{sub}</span>}
    </div>
  );
}

function FeeRow({ fee }) {
  const color = TOKEN_COLORS[fee.fromToken] || "#94a3b8";
  const icon  = TOKEN_ICONS[fee.fromToken]  || "?";
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "32px 1fr 1fr 1fr 90px",
      alignItems: "center", gap: "10px",
      padding: "11px 14px", borderBottom: "1px solid #1e1e2e",
      fontSize: "13px",
    }}>
      <span style={{ fontSize: "18px", color }}>{icon}</span>
      <div>
        <p style={{ margin: 0, fontWeight: 600 }}>{fee.fromToken} → {fee.toToken}</p>
        <p style={{ margin: 0, fontSize: "11px", color: "#475569" }}>{fee.provider}</p>
      </div>
      <div>
        <p style={{ margin: 0, fontWeight: 600 }}>{Number(fee.inputAmount).toLocaleString(undefined, { maximumFractionDigits: 8 })} {fee.fromToken}</p>
        <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
          Fee: {Number(fee.feeAmount).toFixed(8)} {fee.fromToken}
        </p>
      </div>
      <div>
        <p style={{ margin: 0, fontWeight: 700, color: "#26A17B" }}>${Number(fee.feeUSDT).toFixed(4)} USDT</p>
        <p style={{ margin: 0, fontSize: "11px", color: "#475569" }}>@ ${Number(fee.tokenPriceUSD).toLocaleString()}</p>
      </div>
      <span style={{
        padding: "3px 9px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
        background: fee.status === "collected" ? "#16302b" : fee.status === "withdrawn" ? "#1e1e2e" : "#2d1f0a",
        color: fee.status === "collected" ? "#22c55e" : fee.status === "withdrawn" ? "#475569" : "#f59e0b",
        textAlign: "center",
      }}>
        {fee.status}
      </span>
    </div>
  );
}

function WithdrawalRow({ w }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ border: "1px solid #2d2d3d", borderRadius: "12px", marginBottom: "8px", overflow: "hidden" }}>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "13px 16px", cursor: "pointer", background: "#13131f",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ArrowDownRight size={16} color="#26A17B" />
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>
              {Number(w.amountUSDT).toFixed(4)} USDT
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
              {new Date(w.created_date).toLocaleString()} · {w.feesIncluded} fees included
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            padding: "3px 9px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
            background: w.status === "confirmed" ? "#16302b" : w.status === "broadcast" ? "#0f1428" : "#2d1f0a",
            color: w.status === "confirmed" ? "#22c55e" : w.status === "broadcast" ? "#627EEA" : "#f59e0b",
          }}>
            {w.status}
          </span>
          {expanded ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "12px 16px", background: "#0d0d18", borderTop: "1px solid #1e1e2e", fontSize: "12px", color: "#94a3b8" }}>
          <p style={{ margin: "0 0 6px" }}><strong>Destination:</strong> <span style={{ fontFamily: "monospace" }}>{w.destinationAddress}</span></p>
          {w.txHash && <p style={{ margin: "0 0 6px" }}><strong>Tx Hash:</strong> <span style={{ fontFamily: "monospace" }}>{w.txHash}</span></p>}
          {w.notes && <p style={{ margin: 0 }}><strong>Notes:</strong> {w.notes}</p>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [unlocked,     setUnlocked]     = useState(false);
  const [pin,          setPin]          = useState("");
  const [pinError,     setPinError]     = useState(false);

  const [loading,      setLoading]      = useState(false);
  const [summary,      setSummary]      = useState(null);
  const [recentFees,   setRecentFees]   = useState([]);
  const [withdrawals,  setWithdrawals]  = useState([]);

  const [destAddress,  setDestAddress]  = useState("");
  const [notes,        setNotes]        = useState("");
  const [withdrawing,  setWithdrawing]  = useState(false);
  const [withdrawErr,  setWithdrawErr]  = useState("");
  const [withdrawOk,   setWithdrawOk]   = useState(null);
  const [showAddr,     setShowAddr]     = useState(false);
  const [confirmStep,  setConfirmStep]  = useState(false);

  const [activeTab,    setActiveTab]    = useState("overview"); // overview | fees | withdrawals

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(FEE_URL, { method: "GET" });
      const data = await res.json();
      setSummary(data.summary);
      setRecentFees(data.recentFees || []);
      setWithdrawals(data.withdrawals || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (unlocked) loadData(); }, [unlocked, loadData]);

  function handleUnlock() {
    if (pin === ADMIN_PIN) {
      setUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin("");
    }
  }

  async function handleWithdraw() {
    if (!/^0x[a-fA-F0-9]{40}$/.test(destAddress)) {
      setWithdrawErr("Invalid USDT ERC-20 address (must be 0x + 40 hex chars)");
      return;
    }
    if (!confirmStep) { setConfirmStep(true); return; }

    setWithdrawing(true);
    setWithdrawErr("");
    setWithdrawOk(null);
    try {
      const res = await fetch(FEE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw", destinationAddress: destAddress, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdrawal failed");
      setWithdrawOk(data);
      setDestAddress("");
      setNotes("");
      setConfirmStep(false);
      loadData(); // refresh
    } catch (e) {
      setWithdrawErr(e.message);
    } finally {
      setWithdrawing(false);
    }
  }

  // ── PIN Gate ────────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0a0a0f", display: "flex",
        alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{
          background: "#13131f", border: "1px solid #2d2d3d",
          borderRadius: "20px", padding: "36px 32px", width: "320px",
          textAlign: "center",
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: "14px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <Shield size={24} color="#fff" />
          </div>
          <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, color: "#e2e8f0" }}>Admin Access</h2>
          <p style={{ margin: "0 0 24px", fontSize: "13px", color: "#64748b" }}>Enter your admin PIN to continue</p>

          <input
            type="password"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setPinError(false); }}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            placeholder="••••••••"
            style={{
              width: "100%", background: "#0d0d1a",
              border: `1px solid ${pinError ? "#ef4444" : "#2d2d4d"}`,
              borderRadius: "12px", padding: "12px", color: "#e2e8f0",
              fontSize: "20px", textAlign: "center", letterSpacing: "6px",
              boxSizing: "border-box", outline: "none", marginBottom: "12px",
            }}
          />
          {pinError && (
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#ef4444" }}>Incorrect PIN</p>
          )}
          <button
            onClick={handleUnlock}
            style={{
              width: "100%", padding: "13px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none", borderRadius: "12px", color: "#fff",
              fontWeight: 700, fontSize: "15px", cursor: "pointer",
            }}
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  // ── Main Admin UI ────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0",
      fontFamily: "'Inter', sans-serif", padding: "24px",
      maxWidth: "900px", margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "10px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Shield size={18} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Admin Panel</h2>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>Platform fee management</p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#1e1e2e", border: "1px solid #2d2d3d",
            borderRadius: "10px", padding: "8px 14px", color: "#94a3b8",
            cursor: loading ? "not-allowed" : "pointer", fontSize: "13px",
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Sub-tab nav */}
      <div style={{
        display: "flex", gap: "4px", background: "#13131f",
        border: "1px solid #2d2d3d", borderRadius: "12px",
        padding: "4px", marginBottom: "24px", width: "fit-content",
      }}>
        {[
          { id: "overview",    label: "Overview",    icon: TrendingUp   },
          { id: "fees",        label: "Fee Log",     icon: Coins        },
          { id: "withdrawals", label: "Withdrawals", icon: Send         },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "7px 16px", borderRadius: "9px", border: "none",
              cursor: "pointer", fontSize: "13px", fontWeight: 600,
              background: activeTab === id ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent",
              color: activeTab === id ? "#fff" : "#64748b",
            }}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {loading && !summary && (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
          <Loader size={32} color="#6366f1" style={{ animation: "spin 1s linear infinite" }} />
        </div>
      )}

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
      {activeTab === "overview" && summary && (
        <>
          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "28px" }}>
            <StatCard
              label="Available USDT"
              value={`$${Number(summary.availableUSDT).toFixed(4)}`}
              sub="Ready to withdraw"
              color="#26A17B"
              icon="₮"
            />
            <StatCard
              label="Total Collected"
              value={`$${Number(summary.totalFeesUSDT).toFixed(4)}`}
              sub={`${summary.totalTransactions} transactions`}
              color="#6366f1"
              icon="📊"
            />
            <StatCard
              label="Total Withdrawn"
              value={`$${Number(summary.totalWithdrawnUSDT).toFixed(4)}`}
              sub={`${withdrawals.length} withdrawals`}
              color="#64748b"
              icon="📤"
            />
            <StatCard
              label="Fee Rate"
              value="0.08%"
              sub="Per transaction"
              color="#8b5cf6"
              icon="⚡"
            />
          </div>

          {/* By-token breakdown */}
          {Object.keys(summary.byToken || {}).length > 0 && (
            <div style={{ background: "#13131f", border: "1px solid #2d2d3d", borderRadius: "16px", padding: "20px", marginBottom: "24px" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Fees by Token
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {Object.entries(summary.byToken).map(([token, data]) => {
                  const color = TOKEN_COLORS[token] || "#94a3b8";
                  const icon  = TOKEN_ICONS[token]  || "?";
                  const pct   = summary.totalFeesUSDT > 0 ? (data.feeUSDT / summary.totalFeesUSDT) * 100 : 0;
                  return (
                    <div key={token}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color, fontSize: "16px" }}>{icon}</span>
                          <span style={{ fontSize: "14px", fontWeight: 600 }}>{token}</span>
                          <span style={{ fontSize: "11px", color: "#475569" }}>{data.count} swaps</span>
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#26A17B" }}>
                          ${Number(data.feeUSDT).toFixed(4)} USDT
                        </span>
                      </div>
                      <div style={{ height: "5px", background: "#1e1e2e", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "4px", transition: "width 0.5s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Withdraw panel */}
          <div style={{ background: "#13131f", border: "1px solid #26A17B44", borderRadius: "16px", padding: "22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
              <Send size={16} color="#26A17B" />
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Withdraw Collected Fees</h3>
              <span style={{
                marginLeft: "auto", padding: "3px 10px", borderRadius: "6px",
                background: "#16302b", color: "#22c55e", fontSize: "12px", fontWeight: 700,
              }}>
                {Number(summary.availableUSDT).toFixed(4)} USDT available
              </span>
            </div>

            {/* Destination address */}
            <label style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "6px" }}>
              Destination USDT (ERC-20) Address
            </label>
            <div style={{ position: "relative", marginBottom: "12px" }}>
              <input
                value={showAddr ? destAddress : destAddress ? destAddress.slice(0,6)+"••••••••"+destAddress.slice(-4) : ""}
                onChange={(e) => { if (showAddr) setDestAddress(e.target.value); }}
                onFocus={() => setShowAddr(true)}
                onBlur={() => setShowAddr(false)}
                placeholder="0x..."
                style={{
                  width: "100%", background: "#0d0d1a",
                  border: `1px solid ${withdrawErr ? "#ef444466" : "#2d2d4d"}`,
                  borderRadius: "12px", padding: "12px 42px 12px 14px", color: "#e2e8f0",
                  fontSize: "13px", fontFamily: "monospace", boxSizing: "border-box", outline: "none",
                }}
              />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowAddr((v) => !v)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                {showAddr ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Notes */}
            <label style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "6px" }}>Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Monthly withdrawal Q2"
              style={{
                width: "100%", background: "#0d0d1a", border: "1px solid #2d2d4d",
                borderRadius: "12px", padding: "11px 14px", color: "#e2e8f0",
                fontSize: "13px", boxSizing: "border-box", outline: "none", marginBottom: "14px",
              }}
            />

            {withdrawErr && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#ef4444", fontSize: "13px", marginBottom: "12px" }}>
                <AlertCircle size={14} /> {withdrawErr}
              </div>
            )}

            {withdrawOk && (
              <div style={{
                background: "#16302b", border: "1px solid #22c55e44", borderRadius: "12px",
                padding: "14px", marginBottom: "14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <CheckCircle size={16} color="#22c55e" />
                  <span style={{ color: "#22c55e", fontWeight: 700, fontSize: "14px" }}>
                    Withdrawal recorded — {Number(withdrawOk.totalUSDT).toFixed(4)} USDT
                  </span>
                </div>
                <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>
                  {withdrawOk.feesIncluded} fee records marked as withdrawn. Use the button below to complete the on-chain transfer.
                </p>
                <a
                  href={withdrawOk.broadcastLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    background: "#627EEA22", border: "1px solid #627EEA66",
                    borderRadius: "8px", padding: "8px 14px",
                    color: "#627EEA", fontSize: "13px", fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <ExternalLink size={13} /> Complete on Uniswap →
                </a>
              </div>
            )}

            {/* Confirm step */}
            {confirmStep && !withdrawOk && (
              <div style={{
                background: "#2d1f0a", border: "1px solid #f59e0b44", borderRadius: "12px",
                padding: "14px", marginBottom: "14px",
              }}>
                <p style={{ margin: "0 0 6px", color: "#f59e0b", fontWeight: 700, fontSize: "13px" }}>
                  ⚠ Confirm withdrawal
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                  This will mark <strong>{summary.collectedCount}</strong> fee records as withdrawn and generate an on-chain transfer link for <strong>{Number(summary.availableUSDT).toFixed(4)} USDT</strong> to <span style={{ fontFamily: "monospace" }}>{destAddress.slice(0,8)}…{destAddress.slice(-6)}</span>.
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleWithdraw}
                disabled={withdrawing || !destAddress || summary.availableUSDT <= 0}
                style={{
                  flex: 1, padding: "13px",
                  background: withdrawing || !destAddress || summary.availableUSDT <= 0
                    ? "#1e1e2e"
                    : confirmStep
                    ? "linear-gradient(135deg, #22c55e, #16a34a)"
                    : "linear-gradient(135deg, #26A17B, #16a34a)",
                  border: "none", borderRadius: "12px",
                  color: !destAddress || summary.availableUSDT <= 0 ? "#475569" : "#fff",
                  fontWeight: 700, fontSize: "14px",
                  cursor: withdrawing || !destAddress || summary.availableUSDT <= 0 ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}
              >
                {withdrawing
                  ? <><Loader size={15} style={{ animation: "spin 1s linear infinite" }} /> Processing...</>
                  : confirmStep
                  ? <><CheckCircle size={15} /> Confirm & Withdraw</>
                  : <><Send size={15} /> Withdraw {Number(summary.availableUSDT).toFixed(4)} USDT</>
                }
              </button>
              {confirmStep && (
                <button
                  onClick={() => setConfirmStep(false)}
                  style={{
                    padding: "13px 18px", background: "#1e1e2e",
                    border: "1px solid #2d2d3d", borderRadius: "12px",
                    color: "#64748b", cursor: "pointer", fontWeight: 600, fontSize: "13px",
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── FEE LOG TAB ──────────────────────────────────────────────────── */}
      {activeTab === "fees" && (
        <div style={{ background: "#13131f", border: "1px solid #2d2d3d", borderRadius: "16px", overflow: "hidden" }}>
          {/* Table header */}
          <div style={{
            display: "grid", gridTemplateColumns: "32px 1fr 1fr 1fr 90px",
            gap: "10px", padding: "11px 14px",
            background: "#0d0d18", borderBottom: "1px solid #2d2d3d",
            fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px",
          }}>
            <span />
            <span>Pair</span>
            <span>Amount</span>
            <span>Fee (USDT)</span>
            <span>Status</span>
          </div>

          {recentFees.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#475569" }}>
              <Coins size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
              <p style={{ margin: 0 }}>No fee records yet — fees are recorded when users initiate swaps.</p>
            </div>
          ) : (
            recentFees.map((fee) => <FeeRow key={fee.id} fee={fee} />)
          )}

          {recentFees.length > 0 && (
            <div style={{ padding: "10px 14px", background: "#0d0d18", borderTop: "1px solid #1e1e2e", fontSize: "11px", color: "#475569" }}>
              Showing last {recentFees.length} records
            </div>
          )}
        </div>
      )}

      {/* ── WITHDRAWALS TAB ──────────────────────────────────────────────── */}
      {activeTab === "withdrawals" && (
        <div>
          {withdrawals.length === 0 ? (
            <div style={{
              background: "#13131f", border: "1px solid #2d2d3d", borderRadius: "16px",
              padding: "48px", textAlign: "center", color: "#475569",
            }}>
              <Send size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
              <p style={{ margin: 0 }}>No withdrawals yet. Collected fees will appear here once withdrawn.</p>
            </div>
          ) : (
            withdrawals.map((w) => <WithdrawalRow key={w.id} w={w} />)
          )}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}