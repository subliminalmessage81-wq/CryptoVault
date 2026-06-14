import { useState, useEffect } from "react";
import { Wallet, BarChart2, ArrowLeftRight, Settings as SettingsIcon, Shield } from "lucide-react";
import Dashboard from "./Dashboard";
import Markets from "./Markets";
import Swap from "./Swap";
import SettingsPage from "./Settings";
import AdminPanel from "./Admin";

const TABS = [
  { id: "dashboard", label: "Portfolio", icon: Wallet         },
  { id: "markets",   label: "Markets",   icon: BarChart2       },
  { id: "swap",      label: "Swap",      icon: ArrowLeftRight  },
  { id: "settings",  label: "Settings",  icon: SettingsIcon    },
  { id: "admin",     label: "Admin",     icon: Shield          },
];

const SETTINGS_URL = "/functions/walletSettings";

export default function App() {
  const [activeTab, setActiveTab]       = useState("dashboard");
  const [savedAddresses, setSavedAddresses] = useState(null);

  // Load saved wallet settings once on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(SETTINGS_URL, { method: "GET" });
        const data = await res.json();
        if (data.settings) {
          setSavedAddresses({
            btcAddress:  data.settings.btcAddress  || "",
            ethAddress:  data.settings.ethAddress  || "",
            dogeAddress: data.settings.dogeAddress || "",
            usdtAddress: data.settings.usdtAddress || "",
          });
        } else {
          setSavedAddresses({});
        }
      } catch {
        setSavedAddresses({});
      }
    }
    loadSettings();
  }, []);

  function handleSettingsSaved(newAddresses) {
    if (newAddresses) setSavedAddresses(newAddresses);
    setActiveTab("dashboard");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", flexDirection: "column" }}>

      {/* ── Sticky Top Nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "#0d0d18cc",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #1e1e2e",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px",
        height: "56px",
        gap: "12px",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "9px", flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "9px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Wallet size={15} color="#fff" />
          </div>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.3px" }}>
            CryptoVault
          </span>
        </div>

        {/* Tab Pills */}
        <div style={{
          display: "flex", gap: "2px",
          background: "#13131f",
          border: "1px solid #2d2d3d",
          borderRadius: "12px",
          padding: "3px",
          overflowX: "auto",
        }}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            const isAdmin = id === "admin";
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                title={label}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "6px 12px", borderRadius: "9px", border: "none",
                  cursor: "pointer", fontSize: "12px", fontWeight: 600,
                  transition: "all 0.15s",
                  background: active
                    ? isAdmin
                      ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
                      : "linear-gradient(135deg, #6366f1, #8b5cf6)"
                    : "transparent",
                  color: active ? "#fff" : isAdmin ? "#7c3aed" : "#64748b",
                  boxShadow: active ? "0 2px 8px #6366f144" : "none",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ width: 110, flexShrink: 0 }} />
      </nav>

      {/* ── Page Content ── */}
      <div style={{ flex: 1 }}>
        {activeTab === "dashboard" && <Dashboard savedAddresses={savedAddresses} />}
        {activeTab === "markets"   && <Markets />}
        {activeTab === "swap"      && <Swap />}
        {activeTab === "settings"  && <SettingsPage onSave={handleSettingsSaved} />}
        {activeTab === "admin"     && <AdminPanel />}
      </div>

    </div>
  );
}
