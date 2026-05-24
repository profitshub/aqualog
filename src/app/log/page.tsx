"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { WATER_POINTS, TEMP_AREAS, CHECK_TIMES } from "@/lib/config";

type LogType = "water" | "temperature";
type Step = "name" | "type" | "form" | "done";

// ── Helpers ────────────────────────────────────────────────────────────────────
function currentShift(): string {
  const h = new Date().getHours();
  if (h < 10) return "Morning Check (07:00)";
  if (h < 15) return "Midday Check (13:00)";
  return "Evening Check (18:00)";
}

function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
    localStorage.setItem("aqualog-theme", next ? "dark" : "light");
  };
  return (
    <button onClick={toggle} style={{ color: "var(--text-muted)", fontSize: 18, background: "none", border: "none", cursor: "pointer" }}>
      {dark ? "☀" : "☽"}
    </button>
  );
}

// ── Slide variant ──────────────────────────────────────────────────────────────
const slide = {
  initial:  { opacity: 0, y: 20 },
  animate:  { opacity: 1, y: 0,  transition: { duration: 0.3 } },
  exit:     { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

// ── Main page ──────────────────────────────────────────────────────────────────
export default function LogPage() {
  const [step, setStep]       = useState<Step>("name");
  const [logType, setLogType] = useState<LogType>("water");
  const [name, setName]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastStatus, setLastStatus] = useState<"OK"|"WARN"|"DANGER"|null>(null);

  // Water form state
  const [waterPoint, setWaterPoint] = useState(WATER_POINTS[0].id);
  const [waterReading, setWaterReading] = useState("");
  const [waterNotes, setWaterNotes]     = useState("");

  // Temperature form state
  const [tempArea, setTempArea]     = useState(TEMP_AREAS[0].id);
  const [tempValue, setTempValue]   = useState("");
  const [tempNotes, setTempNotes]   = useState("");

  // Persist name
  useEffect(() => {
    const saved = localStorage.getItem("aqualog-name");
    if (saved) { setName(saved); setStep("type"); }
  }, []);

  function saveName() {
    if (!name.trim()) return;
    localStorage.setItem("aqualog-name", name.trim());
    setStep("type");
  }

  function selectType(t: LogType) {
    setLogType(t);
    setLastStatus(null);
    setWaterReading(""); setWaterNotes("");
    setTempValue(""); setTempNotes("");
    setStep("form");
  }

  async function submitLog() {
    setSubmitting(true);
    try {
      const body = logType === "water"
        ? { type: "water",       logger: name, meterPoint: waterPoint, reading: waterReading, unit: WATER_POINTS.find(p => p.id === waterPoint)?.unit ?? "", notes: waterNotes }
        : { type: "temperature", logger: name, area: tempArea, temperature: tempValue, notes: tempNotes };

      const r = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      setLastStatus(json.status ?? null);
      setStep("done");
    } catch {
      alert("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedArea = TEMP_AREAS.find(a => a.id === tempArea);

  const statusColor = lastStatus === "OK" ? "var(--ok)" : lastStatus === "WARN" ? "var(--warn)" : "var(--danger)";

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg-base)" }}>
      {/* Header */}
      <header style={{
        backgroundColor: "var(--bg-surface)",
        borderBottom: "1px solid var(--bg-border)",
        padding: "0 1.25rem",
        height: "3.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "var(--brand)", color: "#080B10",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 14,
          }}>A</div>
          <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>AquaLog</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{currentShift()}</span>
          <ThemeToggle />
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "1.5rem 1.25rem 5rem" }}>
        <AnimatePresence mode="wait">

          {/* ── Step 1: Name ── */}
          {step === "name" && (
            <motion.div key="name" {...slide}>
              <div style={{ textAlign: "center", marginBottom: "2rem", paddingTop: "2rem" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>👋</div>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                  Who's on duty?
                </h1>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                  Enter your name to start logging.
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <input
                  className="input-field"
                  autoFocus
                  placeholder="Your full name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveName()}
                />
                <button className="btn-primary" onClick={saveName} disabled={!name.trim()}>
                  Continue →
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Log type ── */}
          {step === "type" && (
            <motion.div key="type" {...slide}>
              <div style={{ paddingTop: "1.5rem", marginBottom: "1.5rem" }}>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  Logged in as
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-primary)" }}>{name}</h2>
                  <button
                    onClick={() => { localStorage.removeItem("aqualog-name"); setName(""); setStep("name"); }}
                    style={{ fontSize: "0.75rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Change
                  </button>
                </div>
              </div>

              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                What are you logging?
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {/* Water card */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => selectType("water")}
                  style={{
                    display: "flex", alignItems: "center", gap: "1rem",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--bg-border)",
                    borderRadius: "var(--radius)",
                    padding: "1.25rem",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: "var(--brand-water-dim)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.75rem", flexShrink: 0,
                  }}>💧</div>
                  <div>
                    <p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                      Water Log
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Meter readings, pool levels, boiler
                    </p>
                  </div>
                  <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "1.2rem" }}>›</span>
                </motion.button>

                {/* Temperature card */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => selectType("temperature")}
                  style={{
                    display: "flex", alignItems: "center", gap: "1rem",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--bg-border)",
                    borderRadius: "var(--radius)",
                    padding: "1.25rem",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: "var(--brand-temp-dim)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.75rem", flexShrink: 0,
                  }}>🌡️</div>
                  <div>
                    <p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                      Temperature Log
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Kitchen, cold stores, pool, buffet
                    </p>
                  </div>
                  <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "1.2rem" }}>›</span>
                </motion.button>
              </div>

              {/* Reminder strip */}
              <div style={{
                marginTop: "1.5rem",
                background: "var(--bg-elevated)",
                border: "1px solid var(--bg-border)",
                borderRadius: "calc(var(--radius) * 0.75)",
                padding: "0.875rem 1rem",
                display: "flex", alignItems: "center", gap: "0.75rem",
              }}>
                <span style={{ fontSize: "1.1rem" }}>⏰</span>
                <div>
                  <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.15rem" }}>
                    Scheduled checks today
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {CHECK_TIMES.join(" · ")}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Form ── */}
          {step === "form" && (
            <motion.div key="form" {...slide}>
              <div style={{ paddingTop: "1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button
                  onClick={() => setStep("type")}
                  style={{ fontSize: "1.2rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                >
                  ←
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1.4rem" }}>{logType === "water" ? "💧" : "🌡️"}</span>
                  <h1 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {logType === "water" ? "Water Log" : "Temperature Log"}
                  </h1>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {logType === "water" ? (
                  <>
                    <div>
                      <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem", fontWeight: 500 }}>
                        Meter / Point
                      </label>
                      <select
                        className="input-field"
                        value={waterPoint}
                        onChange={e => setWaterPoint(e.target.value)}
                      >
                        {WATER_POINTS.map(p => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem", fontWeight: 500 }}>
                        Reading ({WATER_POINTS.find(p => p.id === waterPoint)?.unit})
                      </label>
                      <input
                        className="input-field"
                        type="number"
                        inputMode="decimal"
                        placeholder="e.g. 1234.5"
                        value={waterReading}
                        onChange={e => setWaterReading(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem", fontWeight: 500 }}>
                        Area
                      </label>
                      <select
                        className="input-field"
                        value={tempArea}
                        onChange={e => setTempArea(e.target.value)}
                      >
                        {TEMP_AREAS.map(a => (
                          <option key={a.id} value={a.id}>{a.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Range indicator */}
                    {selectedArea && (
                      <div style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--bg-border)",
                        borderRadius: "calc(var(--radius) * 0.6)",
                        padding: "0.625rem 0.875rem",
                        fontSize: "0.8rem",
                        color: "var(--text-secondary)",
                        display: "flex", gap: "0.5rem", alignItems: "center",
                      }}>
                        <span>📐</span>
                        <span>Target range: <strong style={{ color: "var(--brand)" }}>{selectedArea.min}°C – {selectedArea.max}°C</strong></span>
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem", fontWeight: 500 }}>
                        Temperature (°C)
                      </label>
                      <input
                        className="input-field"
                        type="number"
                        inputMode="decimal"
                        placeholder="e.g. 65"
                        value={tempValue}
                        onChange={e => setTempValue(e.target.value)}
                        autoFocus
                        style={{ fontSize: "1.3rem", padding: "1rem" }}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem", fontWeight: 500 }}>
                    Notes <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Any issues, observations…"
                    value={logType === "water" ? waterNotes : tempNotes}
                    onChange={e => logType === "water" ? setWaterNotes(e.target.value) : setTempNotes(e.target.value)}
                    style={{ resize: "none" }}
                  />
                </div>

                {/* Logger tag */}
                <div style={{
                  fontSize: "0.8rem", color: "var(--text-muted)",
                  display: "flex", alignItems: "center", gap: "0.4rem",
                }}>
                  <span>👤</span> Logging as <strong style={{ color: "var(--text-secondary)" }}>{name}</strong>
                </div>

                <button
                  className="btn-primary"
                  onClick={submitLog}
                  disabled={submitting || (logType === "water" ? !waterReading : !tempValue)}
                  style={{ marginTop: "0.5rem" }}
                >
                  {submitting ? "Saving…" : "Submit Log ✓"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Done ── */}
          {step === "done" && (
            <motion.div key="done" {...slide} style={{ textAlign: "center", paddingTop: "3rem" }}>
              {lastStatus === "DANGER" ? (
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🚨</div>
              ) : lastStatus === "WARN" ? (
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
              ) : (
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
              )}

              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                {lastStatus === "DANGER" ? "Out of Range!" : lastStatus === "WARN" ? "Check Reading" : "Log Saved!"}
              </h2>

              {lastStatus && (
                <div style={{ marginBottom: "1rem" }}>
                  <span
                    className={lastStatus === "OK" ? "badge-ok" : lastStatus === "WARN" ? "badge-warn" : "badge-danger"}
                  >
                    {lastStatus}
                  </span>
                </div>
              )}

              <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", fontSize: "0.9rem" }}>
                {lastStatus === "DANGER"
                  ? "Temperature is outside the safe range. Please notify your supervisor immediately."
                  : lastStatus === "WARN"
                  ? "Reading is near the boundary. Monitor closely and re-check at next shift."
                  : "Your log has been recorded in the sheet."}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <button className="btn-primary" onClick={() => setStep("type")}>
                  Log Another →
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => { setStep("type"); setLogType(logType === "water" ? "temperature" : "water"); }}
                >
                  Switch to {logType === "water" ? "Temperature" : "Water"} Log
                </button>
              </div>

              {lastStatus === "DANGER" && (
                <div style={{
                  marginTop: "1.5rem",
                  background: "var(--danger-dim)",
                  border: "1px solid var(--danger)",
                  borderRadius: "var(--radius)",
                  padding: "1rem",
                  color: "var(--danger)",
                  fontSize: "0.85rem",
                  lineHeight: 1.5,
                }}>
                  ⚠ Action required — this reading has been flagged for the admin.
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Bottom nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        backgroundColor: "var(--bg-surface)",
        borderTop: "1px solid var(--bg-border)",
        padding: "0.875rem 1.5rem",
        display: "flex", justifyContent: "space-around",
      }}>
        <Link href="/" style={{ textAlign: "center", textDecoration: "none" }}>
          <div style={{ fontSize: "1.2rem" }}>🏠</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Home</div>
        </Link>
        <button
          onClick={() => setStep("type")}
          style={{ textAlign: "center", background: "none", border: "none", cursor: "pointer" }}
        >
          <div style={{ fontSize: "1.2rem" }}>📋</div>
          <div style={{ fontSize: "0.65rem", color: "var(--brand)", marginTop: "0.2rem", fontWeight: 500 }}>New Log</div>
        </button>
        <Link href="/admin" style={{ textAlign: "center", textDecoration: "none" }}>
          <div style={{ fontSize: "1.2rem" }}>🛡</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Admin</div>
        </Link>
      </nav>
    </div>
  );
}
