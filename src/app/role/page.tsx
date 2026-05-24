"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function RolePage() {
  const router  = useRouter();
  const [name,    setName]    = useState("");
  const [loading, setLoading] = useState<"admin" | "logger" | null>(null);
  const [error,   setError]   = useState("");

  // Redirect if already has a role
  useEffect(() => {
    fetch("/api/auth/me").then(r => {
      if (!r.ok) { router.replace("/"); return; }
      r.json().then((u: { role?: string; name?: string }) => {
        if (u.role === "admin")  { router.replace("/admin"); return; }
        if (u.role === "logger") { router.replace("/log");   return; }
        if (u.name) setName(u.name);
      });
    });
  }, [router]);

  async function selectRole(role: "admin" | "logger") {
    setLoading(role);
    setError("");
    try {
      const r    = await fetch("/api/auth/select-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = await r.json() as { ok?: boolean; redirect?: string; error?: string };
      if (json.ok && json.redirect) {
        router.push(json.redirect);
      } else {
        setError(json.error ?? "Access denied.");
        setLoading(null);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(null);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg-base)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
        style={{ width: "100%", maxWidth: 380 }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, #00D4AA 0%, #00A880 100%)", margin: "0 auto 0.875rem", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(0,212,170,0.2)" }}>
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
              <path d="M16 4C16 4 8 14 8 19.5C8 24.2 11.6 28 16 28C20.4 28 24 24.2 24 19.5C24 14 16 4 16 4Z" fill="#080B10" fillOpacity="0.9"/>
              <rect x="19" y="6" width="3" height="12" rx="1.5" fill="#080B10" fillOpacity="0.6"/>
              <circle cx="20.5" cy="20" r="2.5" fill="#080B10" fillOpacity="0.6"/>
            </svg>
          </div>
          {name && (
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Welcome, <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{name.split(" ")[0]}</span>
            </p>
          )}
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
            How are you signing in?
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Choose your role to continue
          </p>
        </div>

        {error && (
          <div style={{ background: "var(--danger-dim)", border: "1px solid var(--danger)", borderRadius: 10, padding: "0.875rem 1rem", fontSize: "0.82rem", color: "var(--danger)", lineHeight: 1.6, marginBottom: "1rem", textAlign: "center" }}>
            🚫 {error}
            <br />
            <button
              onClick={() => { window.location.href = "/api/auth/logout"; }}
              style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              Sign out and try a different account
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Logger */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => selectRole("logger")}
            disabled={!!loading}
            style={{ display: "flex", alignItems: "center", gap: "1rem", background: "var(--bg-surface)", border: "1px solid var(--bg-border)", borderRadius: 16, padding: "1.25rem", cursor: loading ? "not-allowed" : "pointer", textAlign: "left", width: "100%", opacity: loading === "admin" ? 0.5 : 1 }}
          >
            <div style={{ width: 50, height: 50, borderRadius: 14, background: "var(--brand-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>📋</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem", marginBottom: "0.2rem" }}>
                {loading === "logger" ? "Checking access…" : "I'm a Logger"}
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Submit water &amp; temperature readings
              </p>
            </div>
            <span style={{ color: "var(--text-muted)", fontSize: "1.2rem" }}>›</span>
          </motion.button>

          {/* Admin */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => selectRole("admin")}
            disabled={!!loading}
            style={{ display: "flex", alignItems: "center", gap: "1rem", background: "var(--bg-surface)", border: "1px solid var(--bg-border)", borderRadius: 16, padding: "1.25rem", cursor: loading ? "not-allowed" : "pointer", textAlign: "left", width: "100%", opacity: loading === "logger" ? 0.5 : 1 }}
          >
            <div style={{ width: 50, height: 50, borderRadius: 14, background: "rgba(239,68,68,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>🛡</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem", marginBottom: "0.2rem" }}>
                {loading === "admin" ? "Checking access…" : "I'm an Admin"}
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Manage logs, staff &amp; settings
              </p>
            </div>
            <span style={{ color: "var(--text-muted)", fontSize: "1.2rem" }}>›</span>
          </motion.button>
        </div>

        <p style={{ textAlign: "center", marginTop: "1.75rem", fontSize: "0.68rem", color: "var(--text-muted)" }}>
          AquaLog · Golden Tulip Hotels &amp; Resorts
        </p>
      </motion.div>
    </div>
  );
}
