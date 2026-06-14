import { useState, useEffect } from "react";
import { Save, CheckCircle, AlertCircle, Loader, Trash2, Shield } from "lucide-react";

const SETTINGS_URL = "/functions/walletSettings";

const FIELDS = [
  {
    key: "btcAddress",
    label: "Bitcoin (BTC)",
    icon: "₿",
    color: "#F7931A",
    placeholder: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    hint: "Starts with 1, 3, or bc1",
    validate: (v) => !v || /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(v),
  },
  {
    key: "ethAddress",
    label: "Ethereum (ETH)",
    icon: "Ξ",
    color: "#627EEA",
    placeholder: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    hint: "Starts with 0x, 42 characters total",
    validate: (v) => !v || /^0x[a-fA-F0-9]{40}$/.test(v),
  },
  {
    key: "dogeAddress",
    label: "Dogecoin (DOGE)",
    icon: "Ð",
    color: "#C2A633",
    placeholder: "DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L",
    hint: "Starts with D",
    validate: (v) => !v || /^D[a-zA-Z0-9]{25,34}$/.test(v),
  },
  {
    key: "usdtAddress",
    label: "Tether USDT (ERC-20)",
    icon: "₮",
    color: "#26A17B",
    placeholder: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    hint: "Same as your ETH address — USDT lives on Ethereum",
    validate: (v) => !v || /^0x[a-fA-F0-9]{40}$/.test(v),
  },
];

function AddressField({ field, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const isValid = field.validate(value);
  const isEmpty = !value?.trim();
  const showError = !isEmpty && !isValid;

  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <div style={{
          width: 28, height: 28, borderRadius: "8px",
          background: field.color + "22",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "14px", color: field.color, fontWeight: 700,
        }}>
          {field.icon}
        </div>
        <label style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0" }}>{field.label}</label>
        {!isEmpty && isValid  && <CheckCircle size={14} color="#22c55e" style={{ marginLeft: "auto" }} />}
        {showError            && <AlertCircle size={14} color="#ef4444" style={{ marginLeft: "auto" }} />}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={field.placeholder}
        spellCheck={false}
        autoComplete="off"
        style={{
          width: "100%", background: "#0d0d1a",
          border: `1px solid ${showError ? "#ef444466" : focused ? field.color + "88" : "#2d2d4d"}`,
          borderRadius: "12px", padding: "12px 14px",
          color: isEmpty ? "#64748b" : "#e2e8f0",
          fontSize: "13px", fontFamily: "monospace",
          boxSizing: "border-box", outline: "none", transition: "border-color 0.15s",
        }}
      />
      <p style={{ margin: "5px 0 0", fontSize: "11px", color: showError ? "#ef4444" : "#475569" }}>
        {showError ? `Invalid ${field.label} address format` : field.hint}
      </p>
    </div>
  );
}

export default function SettingsPage({ onSave }) {
  const [form, setForm] = useState({ label: "", btcAddress: "", ethAddress: "", dogeAddress: "", usdtAddress: "" });
  const [savedForm, setSavedForm] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [clearing, setClearing]   = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [errorMsg, setErrorMsg]   = useState("");
  const [lastSaved, setLastSaved] = useState(null);

  // Load saved settings on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(SETTINGS_URL, { method: "GET" });
        const data = await res.json();
        if (data.settings) {
          const s = {
            label:       data.settings.label       || "",
            btcAddress:  data.settings.btcAddress  || "",
            ethAddress:  data.settings.ethAddress  || "",
            dogeAddress: data.settings.dogeAddress || "",
            usdtAddress: data.settings.usdtAddress || "",
          };
          setForm(s);
          setSavedForm(s);
          setLastSaved(data.settings.updated_date || null);
        }
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);

  const allValid   = FIELDS.every((f) => f.validate(form[f.key]));
  const hasChanges = JSON.stringify(form) !== JSON.stringify(savedForm);
  const hasAnyAddress = FIELDS.some((f) => form[f.key]?.trim());

  const handleSave = async () => {
    if (!allValid) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch(SETTINGS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSavedForm({ ...form });
      setLastSaved(data.settings?.updated_date || new Date().toISOString());
      setSaveStatus("success");
      // Navigate to portfolio after short delay
      setTimeout(() => { setSaveStatus(null); if (onSave) onSave(); }, 1200);
    } catch (e) {
      setErrorMsg(e.message);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    const cleared = { label: "", btcAddress: "", ethAddress: "", dogeAddress: "", usdtAddress: "" };
    try {
      const res = await fetch(SETTINGS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleared),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clear failed");
      setForm(cleared);
      setSavedForm(cleared);
      setLastSaved(data.settings?.updated_date || new Date().toISOString());
      setSaveStatus("success");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e) {
      setErrorMsg(e.message);
      setSaveStatus("error");
    } finally {
      setClearing(false);
    }
  };

  // Copy ETH → USDT shortcut
  const handleCopyEth = () => {
    if (form.ethAddress) setForm((f) => ({ ...f, usdtAddress: f.ethAddress }));
  };

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f", flexDirection: "column", gap: "12px" }}>
        <Loader size={32} color="#6366f1" style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>Loading settings...</p>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'Inter', sans-serif", padding: "24px", maxWidth: "600px", margin: "0 auto" }}>

      {/* Title */}
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700 }}>Settings</h2>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
          Wallet addresses are saved to the database and loaded automatically on every visit.
        </p>
      </div>

      {/* Wallet label */}
      <div style={{ background: "#13131f", border: "1px solid #2d2d3d", borderRadius: "16px", padding: "20px", marginBottom: "16px" }}>
        <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#94a3b8", marginBottom: "8px" }}>
          Wallet Label (optional)
        </label>
        <input
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          placeholder="My Main Wallet"
          maxLength={40}
          style={{
            width: "100%", background: "#0d0d1a", border: "1px solid #2d2d4d",
            borderRadius: "10px", padding: "11px 14px", color: "#e2e8f0",
            fontSize: "14px", boxSizing: "border-box", outline: "none",
          }}
        />
      </div>

      {/* Address fields */}
      <div style={{ background: "#13131f", border: "1px solid #2d2d3d", borderRadius: "16px", padding: "20px 20px 8px", marginBottom: "16px" }}>
        <p style={{ margin: "0 0 18px", fontSize: "13px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Wallet Addresses
        </p>
        {FIELDS.map((field) => (
          <AddressField
            key={field.key}
            field={field}
            value={form[field.key]}
            onChange={(v) => setForm((f) => ({ ...f, [field.key]: v }))}
          />
        ))}

        {/* ETH → USDT copy shortcut */}
        {form.ethAddress && !form.usdtAddress && (
          <button
            onClick={handleCopyEth}
            style={{
              width: "100%", padding: "10px", marginBottom: "12px",
              background: "#0f1f1a", border: "1px dashed #26A17B66",
              borderRadius: "10px", color: "#26A17B", fontSize: "12px",
              cursor: "pointer", fontWeight: 600,
            }}
          >
            ₮ Use ETH address for USDT (ERC-20)
          </button>
        )}
      </div>

      {/* Privacy note */}
      <div style={{
        background: "#0f1020", border: "1px solid #6366f122", borderRadius: "12px",
        padding: "12px 16px", marginBottom: "20px",
        display: "flex", alignItems: "flex-start", gap: "10px",
      }}>
        <Shield size={16} color="#6366f1" style={{ marginTop: "2px", flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: "12px", color: "#64748b", lineHeight: "1.6" }}>
          Only your <strong style={{ color: "#94a3b8" }}>public wallet addresses</strong> are stored — never private keys or seed phrases. Addresses are read-only and used solely to fetch balances from public blockchains.
        </p>
      </div>

      {/* Last saved */}
      {lastSaved && (
        <p style={{ margin: "0 0 14px", fontSize: "12px", color: "#475569", textAlign: "center" }}>
          Last saved: {new Date(lastSaved).toLocaleString()}
        </p>
      )}

      {/* Status banners */}
      {saveStatus === "success" && (
        <div style={{ background: "#16302b", border: "1px solid #22c55e44", borderRadius: "12px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#22c55e", fontSize: "13px", fontWeight: 600 }}>
          <CheckCircle size={16} /> Saved! Taking you to Portfolio...
        </div>
      )}
      {saveStatus === "error" && (
        <div style={{ background: "#2d1515", border: "1px solid #ef444444", borderRadius: "12px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#ef4444", fontSize: "13px" }}>
          <AlertCircle size={16} /> {errorMsg || "Failed to save settings"}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={handleSave}
          disabled={saving || !allValid || !hasChanges}
          style={{
            flex: 1, padding: "14px",
            background: saving || !allValid || !hasChanges ? "#1e1e2e" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none", borderRadius: "12px",
            color: saving || !allValid || !hasChanges ? "#475569" : "#fff",
            fontWeight: 700, fontSize: "15px",
            cursor: saving || !allValid || !hasChanges ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            transition: "all 0.2s",
          }}
        >
          {saving
            ? <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> Saving...</>
            : <><Save size={16} /> {hasChanges ? "Save & Go to Portfolio" : "Already Saved"}</>}
        </button>

        {hasAnyAddress && (
          <button
            onClick={handleClear}
            disabled={clearing}
            style={{
              padding: "14px 18px", background: "#1e1e2e",
              border: "1px solid #2d2d3d", borderRadius: "12px",
              color: "#64748b", cursor: clearing ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: "6px",
              fontSize: "13px", fontWeight: 600,
            }}
          >
            {clearing ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={14} />}
            Clear
          </button>
        )}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
