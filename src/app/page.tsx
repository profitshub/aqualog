"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LOCATIONS } from "@/lib/config";

type Screen = "role" | "logger-form" | "validating";

function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  const toggle = () => {
    const next = !dark; setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
    localStorage.setItem("aqualog-theme", next ? "dark" : "light");
  };
  return (
    <button
      onClick={toggle}
      style={{ position: "fixed", top: 16, right: 16, zIndex: 50, width: 34, height: 34, borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", color: "var(--text-muted)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {dark ? "☀" : "☽"}
    </button>
  );
}

const slide = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit:    { opacity: 0, y: -16, transition: { duration: 0.2 } },
};

export default function EntryPage() {
  const router = useRouter();
  const [screen, setScreen]  = useState<Screen>("role");
  const [name,   setName]    = useState("");
  const [email,  setEmail]   = useState("");
  const [error,  setError]   = useState("");
  const [savedName, setSavedName] = useState<string | null>(null);

  useEffect(() => {
    const n = localStorage.getItem("aqualog-name");
    const e = localStorage.getItem("aqualog-email");
    const a = localStorage.getItem("aqualog-authorized");
    if (n) setSavedName(n);
    if (n && e && a === "1") { setName(n); setEmail(e); }
  }, []);

  async function validateLogger() {
    if (!name.trim() || !email.trim()) return;
    setScreen("validating");
    setError("");
    try {
      const r = await fetch("/api/validate-logger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await r.json() as { authorized: boolean; name?: string; location?: string; reason?: string };
      if (json.authorized && json.location) {
        const resolvedName = json.name ?? name.trim();
        localStorage.setItem("aqualog-name",       resolvedName);
        localStorage.setItem("aqualog-email",      email.trim().toLowerCase());
        localStorage.setItem("aqualog-location",   json.location);
        localStorage.setItem("aqualog-authorized", "1");
        router.push("/log");
      } else {
        setError(json.reason ?? "Not authorized.");
        setScreen("logger-form");
      }
    } catch {
      setError("Network error. Try again.");
      setScreen("logger-form");
    }
  }

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg-base)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <ThemeToggle />

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: "linear-gradient(135deg, #00D4AA 0%, #00A880 100%)", margin: "0 auto 0.875rem", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 32px rgba(0,212,170,0.25)" }}>
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
            <path d="M16 4C16 4 8 14 8 19.5C8 24.2 11.6 28 16 28C20.4 28 24 24.2 24 19.5C24 14 16 4 16 4Z" fill="#080B10" fillOpacity="0.9"/>
            <rect x="19" y="6" width="3" height="12" rx="1.5" fill="#080B10" fillOpacity="0.6"/>
            <circle cx="20.5" cy="20" r="2.5" fill="#080B10" fillOpacity="0.6"/>
          </svg>
        </div>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.25rem" }}>AquaLog</h1>
        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Golden Tulip Hotels · Utility Logging</p>
      </div>

      <div style={{ width: "100%", maxWidth: 380 }}>
        <AnimatePresence mode="wait">

          {/* ── Role picker ── */}
          {screen === "role" && (
            <motion.div key="role" {...slide}>
              <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.875rem", textAlign: "center" }}>
                How are you signing in?
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {/* Logger */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setScreen("logger-form")}
                  style={{ display: "flex", alignItems: "center", gap: "1rem", background: "var(--bg-surface)", border: "1px solid var(--bg-border)", borderRadius: 16, padding: "1.25rem", cursor: "pointer", textAlign: "left", width: "100%" }}
                >
                  <div style={{ width: 50, height: 50, borderRadius: 14, background: "var(--brand-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>📋</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem", marginBottom: "0.2rem" }}>
                      I&apos;m a Logger
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Submit water &amp; temperature readings
                      {savedName && <span style={{ color: "var(--brand)" }}> · {savedName}</span>}
                    </p>
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: "1.2rem" }}>›</span>
                </motion.button>

                {/* Admin */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { window.location.href = "/api/auth/google"; }}
                  style={{ display: "flex", alignItems: "center", gap: "1rem", background: "var(--bg-surface)", border: "1px solid var(--bg-border)", borderRadius: 16, padding: "1.25rem", cursor: "pointer", textAlign: "left", width: "100%" }}
                >
                  <div style={{ width: 50, height: 50, borderRadius: 14, background: "rgba(239,68,68,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>🛡</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem", marginBottom: "0.2rem" }}>
                      I&apos;m an Admin
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Manage logs, staff &amp; settings across locations
                    </p>
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: "1.2rem" }}>›</span>
                </motion.button>
              </div>

              {/* Location chips (info only) */}
              <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                {LOCATIONS.map(l => (
                  <span key={l.id} style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: 999, background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", color: "var(--text-muted)" }}>
                    📍 {l.name}
                  </span>
                ))}
              </div>

              <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.68rem", color: "var(--text-muted)" }}>
                AquaLog · Golden Tulip Hotels &amp; Resorts
              </p>
            </motion.div>
          )}

          {/* ── Logger sign-in form ── */}
          {(screen === "logger-form" || screen === "validating") && (
            <motion.div key="form" {...slide}>
              <button
                onClick={() => { setScreen("role"); setError(""); }}
                style={{ fontSize: "0.82rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.35rem" }}
              >
                ← Back
              </button>

              <div className="card" style={{ padding: "1.5rem" }}>
                <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "1.125rem" }}>
                  Sign in to continue logging
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                  <div>
                    <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem", fontWeight: 500 }}>Full Name</label>
                    <input
                      className="input-field"
                      placeholder="e.g. Emeka Obi"
                      value={name}
                      onChange={e => { setName(e.target.value); setError(""); }}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem", fontWeight: 500 }}>Work Email</label>
                    <input
                      className="input-field"
                      type="email"
                      inputMode="email"
                      placeholder="your.name@goldentulip.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(""); }}
                      onKeyDown={e => e.key === "Enter" && validateLogger()}
                    />
                  </div>

                  {error && (
                    <div style={{ background: "var(--danger-dim)", border: "1px solid var(--danger)", borderRadius: 10, padding: "0.75rem 1rem", fontSize: "0.8rem", color: "var(--danger)", lineHeight: 1.5 }}>
                      🚫 {error}
                    </div>
                  )}

                  <button
                    className="btn-primary"
                    onClick={validateLogger}
                    disabled={screen === "validating" || !name.trim() || !email.trim()}
                    style={{ marginTop: "0.25rem" }}
                  >
                    {screen === "validating" ? "Checking…" : "Continue →"}
                  </button>
                </div>
              </div>

              <p style={{ textAlign: "center", fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "1rem", lineHeight: 1.5 }}>
                Your location is detected automatically from your email.<br />
                Not authorised? Contact your hotel manager.
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
