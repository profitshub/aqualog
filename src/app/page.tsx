"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const EASE_OUT = [0.0, 0.0, 0.2, 1.0] as const;
const fadeUp = (delay = 0) => ({
  initial:  { opacity: 0, y: 24 },
  animate:  { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT, delay } },
});

const FEATURES = [
  { icon: "💧", title: "Water Meter Logging",   body: "Record main meters, pool levels, and boiler feeds in seconds. Every entry is timestamped and attributed to the logger on duty." },
  { icon: "🌡️", title: "Temperature Checks",    body: "Log kitchen, cold storage, freezer, buffet, and pool temperatures. Out-of-range readings are flagged automatically." },
  { icon: "🚨", title: "Instant Alerts",         body: "When a temperature falls outside the safe range, the logger sees a warning and the admin is notified on the dashboard." },
  { icon: "📊", title: "Admin Dashboard",        body: "Full log history, staff activity, export to CSV. See at a glance who logged, what they recorded, and when." },
  { icon: "📱", title: "Install to Home Screen", body: "Works as a native app on any phone. Staff tap the icon on their home screen — no app store, no download needed." },
  { icon: "📄", title: "Google Sheets Sync",     body: "Every log writes directly to your Google Sheet. You own the data. Open it in Excel anytime. No lock-in." },
];

export default function HomePage() {
  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg-base)" }}>

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 10,
        backgroundColor: "var(--bg-surface)",
        borderBottom: "1px solid var(--bg-border)",
        padding: "0 1.5rem", height: "3.5rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, background: "var(--brand)", color: "#080B10",
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15,
          }}>A</div>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>AquaLog</span>
        </div>
        <Link href="/log" style={{
          fontSize: "0.85rem", fontWeight: 600, padding: "8px 20px", borderRadius: 9,
          backgroundColor: "var(--brand)", color: "#080B10", textDecoration: "none",
        }}>
          Start Logging
        </Link>
      </nav>

      <main>
        {/* Hero */}
        <section style={{ padding: "4rem 1.5rem 3rem", maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <motion.div {...fadeUp(0)} style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            background: "var(--brand-dim)", border: "1px solid rgba(0,212,170,.3)",
            borderRadius: 999, padding: "4px 14px", marginBottom: "1.5rem",
            fontSize: "0.78rem", fontWeight: 600, color: "var(--brand)",
          }}>
            <span className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand)", display: "inline-block" }} />
            Logs go straight to Google Sheets
          </motion.div>

          <motion.h1 {...fadeUp(0.08)} style={{
            fontSize: "clamp(2rem, 6vw, 3rem)", fontWeight: 800, lineHeight: 1.1,
            color: "var(--text-primary)", marginBottom: "1.25rem",
          }}>
            Utility logging<br />
            <span style={{ color: "var(--brand)" }}>done in seconds.</span>
          </motion.h1>

          <motion.p {...fadeUp(0.16)} style={{
            fontSize: "1.05rem", color: "var(--text-secondary)", lineHeight: 1.65,
            marginBottom: "2rem", maxWidth: 520, margin: "0 auto 2rem",
          }}>
            Water readings. Temperature checks. Every shift, every day.
            Staff log from their phone — admin sees everything in real time.
          </motion.p>

          <motion.div {...fadeUp(0.24)} style={{ display: "flex", gap: "0.875rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/log" style={{
              fontWeight: 700, padding: "1rem 2rem", borderRadius: 12,
              backgroundColor: "var(--brand)", color: "#080B10", textDecoration: "none", fontSize: "1rem",
            }}>
              Open Logger →
            </Link>
            <Link href="/admin" style={{
              fontWeight: 600, padding: "1rem 2rem", borderRadius: 12,
              backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)",
              border: "1px solid var(--bg-border)", textDecoration: "none", fontSize: "1rem",
            }}>
              Admin Dashboard
            </Link>
          </motion.div>
        </section>

        {/* Mock log preview */}
        <section style={{ padding: "0 1.25rem 3rem", maxWidth: 420, margin: "0 auto" }}>
          <motion.div {...fadeUp(0.32)} className="card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Latest logs · Main Hotel
            </div>
            {[
              { icon: "🌡️", label: "Kitchen — Hot Water",  value: "68°C",    status: "OK",   logger: "Emeka O.",    time: "07:12" },
              { icon: "💧", label: "Main Water Meter",      value: "1,284 m³", status: null,  logger: "Blessing A.", time: "07:14" },
              { icon: "🌡️", label: "Cold Storage #1",       value: "7°C",     status: "WARN", logger: "Emeka O.",    time: "07:15" },
              { icon: "🌡️", label: "Freezer",               value: "-21°C",   status: "OK",   logger: "Emeka O.",    time: "07:16" },
            ].map((row, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.07 }}
                style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.625rem 0",
                  borderBottom: i < 3 ? "1px solid var(--bg-border)" : "none",
                }}>
                <span style={{ fontSize: "1.1rem", width: 24 }}>{row.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: 500 }}>{row.label}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{row.logger} · {row.time}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-primary)", fontFamily: "monospace" }}>{row.value}</span>
                  {row.status && <span className={row.status === "OK" ? "badge-ok" : row.status === "WARN" ? "badge-warn" : "badge-danger"}>{row.status}</span>}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Features */}
        <section style={{ padding: "2rem 1.25rem 3rem", maxWidth: 840, margin: "0 auto" }}>
          <motion.h2 {...fadeUp(0.1)} style={{
            textAlign: "center", fontSize: "1.5rem", fontWeight: 700,
            color: "var(--text-primary)", marginBottom: "2rem",
          }}>
            Everything your team needs
          </motion.h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.875rem" }}>
            {FEATURES.map((f, i) => (
              <motion.div key={i} {...fadeUp(0.05 * i)} className="card" style={{ padding: "1.25rem" }}>
                <div style={{ fontSize: "1.6rem", marginBottom: "0.625rem" }}>{f.icon}</div>
                <h3 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.375rem", fontSize: "0.9rem" }}>{f.title}</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.55 }}>{f.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: "2rem 1.25rem 4rem", maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <motion.div {...fadeUp(0.1)} className="card" style={{ padding: "2rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📋</div>
            <h2 style={{ fontWeight: 700, fontSize: "1.25rem", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
              Ready to start?
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              Open the logger on any phone. No account needed for staff —
              just enter your name and start logging.
            </p>
            <Link href="/log" style={{
              display: "block", fontWeight: 700, padding: "1rem", borderRadius: 12,
              backgroundColor: "var(--brand)", color: "#080B10", textDecoration: "none", fontSize: "1rem",
            }}>
              Open Logger →
            </Link>
          </motion.div>
        </section>
      </main>

      <footer style={{
        textAlign: "center", padding: "1.5rem", fontSize: "0.75rem",
        color: "var(--text-muted)", borderTop: "1px solid var(--bg-border)",
      }}>
        AquaLog · Built for hotel utility compliance
      </footer>
    </div>
  );
}
