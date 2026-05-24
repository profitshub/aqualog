"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { WATER_POINTS, TEMP_AREAS, CHECK_TIMES } from "@/lib/config";

type LogType = "water" | "temperature";
type Step    = "loading" | "type" | "form" | "done";

// ── Push helpers ──────────────────────────────────────────────────────────────

function urlBase64ToArrayBuffer(b64: string): ArrayBuffer {
  const pad  = "=".repeat((4 - (b64.length % 4)) % 4);
  const base = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw  = window.atob(base);
  const buf  = new ArrayBuffer(raw.length);
  const arr  = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return buf;
}

async function subscribeToPush(email: string, name: string): Promise<boolean> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(vapidKey),
    });
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, subscription: sub }),
    });
    return true;
  } catch {
    return false;
  }
}

function currentShift(): string {
  const h = new Date().getHours();
  if (h < 10) return "Morning Check (07:00)";
  if (h < 15) return "Midday Check (13:00)";
  return "Evening Check (18:00)";
}

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
    <button onClick={toggle} style={{ color: "var(--text-muted)", fontSize: 18, background: "none", border: "none", cursor: "pointer" }}>
      {dark ? "☀" : "☽"}
    </button>
  );
}

const slide = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0,  transition: { duration: 0.3 } },
  exit:    { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

export default function LogPage() {
  const router = useRouter();
  const [step,    setStep]    = useState<Step>("loading");
  const [logType, setLogType] = useState<LogType>("water");

  // Identity (from session)
  const [name,         setName]         = useState("");
  const [email,        setEmail]        = useState("");
  const [locationName, setLocationName] = useState("");

  // Push notifications
  const [pushState, setPushState] = useState<"idle" | "prompt" | "subscribed" | "denied">("idle");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [lastStatus, setLastStatus] = useState<"OK" | "WARN" | "DANGER" | null>(null);

  // Water form
  const [waterPoint,   setWaterPoint]   = useState(WATER_POINTS[0].id);
  const [waterReading, setWaterReading] = useState("");
  const [waterNotes,   setWaterNotes]   = useState("");

  // Temp form
  const [tempArea,  setTempArea]  = useState(TEMP_AREAS[0].id);
  const [tempValue, setTempValue] = useState("");
  const [tempNotes, setTempNotes] = useState("");

  // Register service worker once
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => null);
    }
  }, []);

  // Load identity from session
  useEffect(() => {
    fetch("/api/auth/me")
      .then(async r => {
        if (!r.ok) { router.replace("/"); return; }
        const u = await r.json() as { name: string; email: string; role?: string; locationId?: string; locationName?: string };
        if (u.role !== "logger") { router.replace("/role"); return; }
        setName(u.name);
        setEmail(u.email);
        setLocationName(u.locationName ?? "");
        setStep("type");

        if ("Notification" in window) {
          if (Notification.permission === "granted") setPushState("subscribed");
          else if (Notification.permission === "denied") setPushState("denied");
          else if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) setPushState("prompt");
        }
      })
      .catch(() => router.replace("/"));
  }, [router]);

  async function enablePush() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") { setPushState("denied"); return; }
    const ok = await subscribeToPush(email, name);
    setPushState(ok ? "subscribed" : "denied");
  }

  function selectType(t: LogType) {
    setLogType(t);
    setLastStatus(null);
    setWaterReading(""); setWaterNotes("");
    setTempValue("");    setTempNotes("");
    setStep("form");
  }

  async function submitLog() {
    setSubmitting(true);
    try {
      const body = logType === "water"
        ? { type: "water",       meterPoint: waterPoint, reading: waterReading, unit: WATER_POINTS.find(p => p.id === waterPoint)?.unit ?? "", notes: waterNotes }
        : { type: "temperature", area: tempArea, temperature: tempValue, notes: tempNotes };

      const r    = await fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await r.json() as { ok?: boolean; status?: "OK" | "WARN" | "DANGER"; error?: string };
      if (!r.ok) { alert(json.error ?? "Failed to save log."); return; }
      setLastStatus(json.status ?? null);
      setStep("done");
    } catch {
      alert("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  const selectedArea = TEMP_AREAS.find(a => a.id === tempArea);

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg-base)" }}>
      {/* Header */}
      <header style={{
        backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--bg-border)",
        padding: "0 1.25rem", height: "3.5rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--brand)", color: "#080B10", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>A</div>
          <div>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)", display: "block", lineHeight: 1.1 }}>AquaLog</span>
            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{locationName || "Golden Tulip"}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{currentShift()}</span>
          <ThemeToggle />
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "1.5rem 1.25rem 5rem" }}>
        <AnimatePresence mode="wait">

          {/* ── Loading ── */}
          {step === "loading" && (
            <motion.div key="loading" {...slide} style={{ textAlign: "center", paddingTop: "4rem" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading…</p>
            </motion.div>
          )}

          {/* ── Log type selection ── */}
          {step === "type" && (
            <motion.div key="type" {...slide}>
              <div style={{ paddingTop: "1.5rem", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.15rem" }}>Signed in as</p>
                    <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>{name}</h2>
                  </div>
                  <button
                    onClick={signOut}
                    style={{ fontSize: "0.72rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Sign out
                  </button>
                </div>
              </div>

              {/* Push notification banner */}
              {pushState === "prompt" && (
                <div style={{ background: "var(--brand-dim)", border: "1px solid rgba(0,212,170,0.3)", borderRadius: 12, padding: "0.75rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1.2rem" }}>🔔</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--brand)", marginBottom: "0.1rem" }}>Get logging reminders</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>We&apos;ll notify you when it&apos;s time to submit readings.</p>
                  </div>
                  <button onClick={enablePush} style={{ fontSize: "0.75rem", fontWeight: 600, padding: "5px 12px", borderRadius: 8, background: "var(--brand)", color: "#080B10", border: "none", cursor: "pointer", flexShrink: 0 }}>Enable</button>
                  <button onClick={() => setPushState("denied")} style={{ fontSize: "1rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", lineHeight: 1, flexShrink: 0 }} title="Dismiss">×</button>
                </div>
              )}
              {pushState === "subscribed" && (
                <div style={{ background: "var(--ok-dim)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 12, padding: "0.6rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.9rem" }}>✅</span>
                  <p style={{ fontSize: "0.75rem", color: "var(--ok)" }}>Notifications enabled — you&apos;ll be reminded when it&apos;s time to log.</p>
                </div>
              )}

              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>What are you logging?</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {[
                  { type: "water" as LogType, icon: "💧", title: "Water Log", sub: "Meter readings, pool levels, boiler", color: "var(--brand-water-dim)" },
                  { type: "temperature" as LogType, icon: "🌡️", title: "Temperature Log", sub: "Kitchen, cold stores, pool, buffet", color: "var(--brand-temp-dim)" },
                ].map(item => (
                  <motion.button key={item.type} whileTap={{ scale: 0.97 }} onClick={() => selectType(item.type)}
                    style={{ display: "flex", alignItems: "center", gap: "1rem", background: "var(--bg-surface)", border: "1px solid var(--bg-border)", borderRadius: 16, padding: "1.25rem", cursor: "pointer", textAlign: "left", width: "100%" }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: item.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.75rem", flexShrink: 0 }}>{item.icon}</div>
                    <div>
                      <p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.2rem" }}>{item.title}</p>
                      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{item.sub}</p>
                    </div>
                    <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "1.2rem" }}>›</span>
                  </motion.button>
                ))}
              </div>

              <div style={{ marginTop: "1.5rem", background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", borderRadius: 12, padding: "0.875rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.1rem" }}>⏰</span>
                <div>
                  <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.1rem" }}>Scheduled checks</p>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{CHECK_TIMES.join(" · ")}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Log form ── */}
          {step === "form" && (
            <motion.div key="form" {...slide}>
              <div style={{ paddingTop: "1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button onClick={() => setStep("type")} style={{ fontSize: "1.2rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>←</button>
                <span style={{ fontSize: "1.4rem" }}>{logType === "water" ? "💧" : "🌡️"}</span>
                <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>{logType === "water" ? "Water Log" : "Temperature Log"}</h1>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {logType === "water" ? (
                  <>
                    <div>
                      <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem", fontWeight: 500 }}>Meter / Point</label>
                      <select className="input-field" value={waterPoint} onChange={e => setWaterPoint(e.target.value)}>
                        {WATER_POINTS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem", fontWeight: 500 }}>Reading ({WATER_POINTS.find(p => p.id === waterPoint)?.unit})</label>
                      <input className="input-field" type="number" inputMode="decimal" placeholder="e.g. 1234.5" value={waterReading} onChange={e => setWaterReading(e.target.value)} autoFocus />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem", fontWeight: 500 }}>Area</label>
                      <select className="input-field" value={tempArea} onChange={e => setTempArea(e.target.value)}>
                        {TEMP_AREAS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                      </select>
                    </div>
                    {selectedArea && (
                      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", borderRadius: 10, padding: "0.625rem 0.875rem", fontSize: "0.78rem", color: "var(--text-secondary)", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span>📐</span>
                        <span>Target: <strong style={{ color: "var(--brand)" }}>{selectedArea.min}°C – {selectedArea.max}°C</strong></span>
                      </div>
                    )}
                    <div>
                      <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem", fontWeight: 500 }}>Temperature (°C)</label>
                      <input className="input-field" type="number" inputMode="decimal" placeholder="e.g. 65" value={tempValue} onChange={e => setTempValue(e.target.value)} autoFocus style={{ fontSize: "1.3rem", padding: "1rem" }} />
                    </div>
                  </>
                )}

                <div>
                  <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem", fontWeight: 500 }}>Notes <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
                  <textarea className="input-field" rows={2} placeholder="Any issues, observations…"
                    value={logType === "water" ? waterNotes : tempNotes}
                    onChange={e => logType === "water" ? setWaterNotes(e.target.value) : setTempNotes(e.target.value)}
                    style={{ resize: "none" }} />
                </div>

                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span>👤</span> {name} <span style={{ color: "var(--bg-border)" }}>·</span>
                  <span style={{ color: "var(--brand)", fontSize: "0.72rem" }}>{email}</span>
                </div>

                <button className="btn-primary" onClick={submitLog}
                  disabled={submitting || (logType === "water" ? !waterReading : !tempValue)}
                  style={{ marginTop: "0.5rem" }}>
                  {submitting ? "Saving…" : "Submit Log ✓"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Confirmation ── */}
          {step === "done" && (
            <motion.div key="done" {...slide} style={{ textAlign: "center", paddingTop: "3rem" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>
                {lastStatus === "DANGER" ? "🚨" : lastStatus === "WARN" ? "⚠️" : "✅"}
              </div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                {lastStatus === "DANGER" ? "Out of Range!" : lastStatus === "WARN" ? "Check Reading" : "Log Saved!"}
              </h2>
              {lastStatus && (
                <div style={{ marginBottom: "1rem" }}>
                  <span className={lastStatus === "OK" ? "badge-ok" : lastStatus === "WARN" ? "badge-warn" : "badge-danger"}>{lastStatus}</span>
                </div>
              )}
              <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", fontSize: "0.88rem", lineHeight: 1.5 }}>
                {lastStatus === "DANGER"
                  ? "Temperature is outside the safe range. Notify your supervisor immediately."
                  : lastStatus === "WARN"
                  ? "Reading is near the boundary. Monitor closely and re-check at next shift."
                  : "Your log has been recorded successfully."}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <button className="btn-primary" onClick={() => setStep("type")}>Log Another →</button>
                <button className="btn-secondary" onClick={() => { setStep("type"); setLogType(logType === "water" ? "temperature" : "water"); }}>
                  Switch to {logType === "water" ? "Temperature" : "Water"} Log
                </button>
              </div>
              {lastStatus === "DANGER" && (
                <div style={{ marginTop: "1.5rem", background: "var(--danger-dim)", border: "1px solid var(--danger)", borderRadius: 12, padding: "1rem", color: "var(--danger)", fontSize: "0.82rem", lineHeight: 1.5 }}>
                  ⚠ This reading has been flagged. Admin will see it on the dashboard.
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: "var(--bg-surface)", borderTop: "1px solid var(--bg-border)", padding: "0.875rem 1.5rem", display: "flex", justifyContent: "space-around" }}>
        <button onClick={signOut} style={{ textAlign: "center", background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ fontSize: "1.2rem" }}>←</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Sign Out</div>
        </button>
        <button onClick={() => setStep("type")} style={{ textAlign: "center", background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ fontSize: "1.2rem" }}>📋</div>
          <div style={{ fontSize: "0.65rem", color: "var(--brand)", marginTop: "0.2rem", fontWeight: 500 }}>New Log</div>
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.2rem" }}>📍</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>{locationName.replace("Golden Tulip ", "") || "—"}</div>
        </div>
      </nav>
    </div>
  );
}
