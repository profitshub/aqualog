"use client";

import { motion } from "framer-motion";

export default function DeniedPage() {
  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: "center", maxWidth: 360 }}
      >
        <div style={{ fontSize: "3rem", marginBottom: "1.25rem" }}>🚫</div>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
          Access Denied
        </h1>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.7, marginBottom: "2rem" }}>
          Your account hasn't been given access yet.<br />
          Contact your manager or hotel admin to get added.
        </p>
        <button
          onClick={() => { window.location.href = "/api/auth/logout"; }}
          style={{ padding: "0.75rem 2rem", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}
        >
          Sign out
        </button>
      </motion.div>
    </div>
  );
}
