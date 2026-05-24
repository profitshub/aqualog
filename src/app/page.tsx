"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

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
      style={{
        position: "fixed", top: 16, right: 16, zIndex: 50,
        width: 34, height: 34, borderRadius: 8,
        background: "var(--bg-elevated)", border: "1px solid var(--bg-border)",
        color: "var(--text-muted)", fontSize: 16, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? "☀" : "☽"}
    </button>
  );
}

export default function EntryPage() {
  const [loggedName, setLoggedName] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("aqualog-name");
    if (saved) setLoggedName(saved);
  }, []);

  return (
    <div style={{
      minHeight: "100dvh",
      backgroundColor: "var(--bg-base)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "1.5rem",
    }}>
      <ThemeToggle />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0, 0, 0.2, 1] }}
        style={{ width: "100%", maxWidth: 380 }}
      >
        {/* Hotel identity */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          {/* Logo mark */}
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: "linear-gradient(135deg, #00D4AA 0%, #00A880 100%)",
            margin: "0 auto 1rem",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(0,212,170,0.25)",
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              {/* Water drop */}
              <path d="M16 4 C16 4 8 14 8 19.5 C8 24.2 11.6 28 16 28 C20.4 28 24 24.2 24 19.5 C24 14 16 4 16 4Z" fill="#080B10" fillOpacity="0.9"/>
              {/* Thermometer */}
              <rect x="19" y="6" width="3" height="12" rx="1.5" fill="#080B10" fillOpacity="0.6"/>
              <circle cx="20.5" cy="20" r="2.5" fill="#080B10" fillOpacity="0.6"/>
            </svg>
          </div>

          <h1 style={{
            fontSize: "1.5rem", fontWeight: 800,
            color: "var(--text-primary)", marginBottom: "0.375rem", lineHeight: 1.1,
          }}>
            AquaLog
          </h1>

          {/* Hotel name badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.375rem",
            background: "var(--bg-elevated)",
            border: "1px solid var(--bg-border)",
            borderRadius: 999, padding: "4px 12px",
            marginBottom: "0.5rem",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "var(--brand)", display: "inline-block", flexShrink: 0,
            }} />
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              Golden Tulip Lekki
            </span>
          </div>

          <p style={{ fontSize: "0.83rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Daily utility logging · Water &amp; Temperature
          </p>
        </div>

        {/* Role selection */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>

          {/* Logger card */}
          <Link href="/log" style={{ textDecoration: "none" }}>
            <motion.div
              whileTap={{ scale: 0.97 }}
              style={{
                display: "flex", alignItems: "center", gap: "1rem",
                background: "var(--bg-surface)",
                border: "1px solid var(--bg-border)",
                borderRadius: 16, padding: "1.25rem 1.25rem",
                cursor: "pointer",
                transition: "border-color 200ms",
              }}
              whileHover={{ borderColor: "var(--brand)" }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: "var(--brand-dim)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.5rem", flexShrink: 0,
              }}>
                📋
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem", marginBottom: "0.2rem" }}>
                  I&apos;m on duty
                </p>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                  Log water readings &amp; temperature checks
                  {loggedName && (
                    <span style={{ color: "var(--brand)", fontWeight: 500 }}> · {loggedName}</span>
                  )}
                </p>
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: "1.2rem", flexShrink: 0 }}>›</span>
            </motion.div>
          </Link>

          {/* Admin card */}
          <Link href="/admin" style={{ textDecoration: "none" }}>
            <motion.div
              whileTap={{ scale: 0.97 }}
              style={{
                display: "flex", alignItems: "center", gap: "1rem",
                background: "var(--bg-surface)",
                border: "1px solid var(--bg-border)",
                borderRadius: 16, padding: "1.25rem 1.25rem",
                cursor: "pointer",
                transition: "border-color 200ms",
              }}
              whileHover={{ borderColor: "rgba(239,68,68,.4)" }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: "rgba(239,68,68,.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.5rem", flexShrink: 0,
              }}>
                🛡
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem", marginBottom: "0.2rem" }}>
                  Admin access
                </p>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                  View all logs, staff activity &amp; reports
                </p>
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: "1.2rem", flexShrink: 0 }}>›</span>
            </motion.div>
          </Link>
        </div>

        {/* Shift reminder */}
        <div style={{
          marginTop: "1.5rem",
          background: "var(--bg-elevated)",
          border: "1px solid var(--bg-border)",
          borderRadius: 12, padding: "0.75rem 1rem",
          display: "flex", alignItems: "center", gap: "0.625rem",
        }}>
          <span style={{ fontSize: "1rem" }}>⏰</span>
          <div>
            <p style={{ fontSize: "0.73rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.1rem" }}>
              Scheduled checks
            </p>
            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              07:00 · 13:00 · 18:00 — log within 30 min of each shift
            </p>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.7rem", color: "var(--text-muted)" }}>
          AquaLog · Golden Tulip Hotels &amp; Resorts
        </p>
      </motion.div>
    </div>
  );
}
