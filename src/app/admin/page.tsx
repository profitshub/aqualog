"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { TEMP_AREAS } from "@/lib/config";

type LogType = "water" | "temperature";

interface WaterLog {
  type: "water";
  timestamp: string; date: string; time: string;
  logger: string; location: string; meterPoint: string;
  reading: string; unit: string; notes: string;
}

interface TempLog {
  type: "temperature";
  timestamp: string; date: string; time: string;
  logger: string; location: string; area: string;
  temperature: string; min: string; max: string;
  status: "OK" | "WARN" | "DANGER"; notes: string;
}

type AnyLog = WaterLog | TempLog;

// ── Helpers ─────────────────────────────────────────────────────────────────
function areaLabel(id: string) {
  return TEMP_AREAS.find(a => a.id === id)?.label ?? id;
}

function relDate(d: string) {
  if (!d) return "—";
  const [dd, mm, yyyy] = d.split("/");
  const parsed = new Date(`${yyyy}-${mm}-${dd}`);
  const today  = new Date();
  const diff   = Math.round((today.getTime() - parsed.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d;
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
    <button onClick={toggle} style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
      {dark ? "☀" : "☽"}
    </button>
  );
}

function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: "1rem 1.125rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "1.1rem" }}>{icon}</span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{label}</span>
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, color: color ?? "var(--text-primary)", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>{sub}</div>}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed,  setAuthed]  = useState(false);
  const [pwd,     setPwd]     = useState("");
  const [pwdErr,  setPwdErr]  = useState("");
  const [loading, setLoading] = useState(false);
  const [logs,    setLogs]    = useState<AnyLog[]>([]);
  const [filter,  setFilter]  = useState<"all" | LogType>("all");
  const [search,  setSearch]  = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const fetchLogs = useCallback(async (password: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/logs?pwd=${encodeURIComponent(password)}`);
      if (r.status === 401) { setPwdErr("Incorrect password."); return; }
      const json = await r.json() as { all: AnyLog[] };
      setLogs(json.all);
      setAuthed(true);
      sessionStorage.setItem("aqualog-admin-pwd", password);
    } catch {
      setPwdErr("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-auth from session
  useEffect(() => {
    const saved = sessionStorage.getItem("aqualog-admin-pwd");
    if (saved) fetchLogs(saved);
  }, [fetchLogs]);

  function login() { if (pwd.trim()) fetchLogs(pwd.trim()); }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString("en-GB").replace(/\//g, "/");
  const todayLogs   = logs.filter(l => l.date === today);
  const waterLogs   = logs.filter(l => l.type === "water")       as WaterLog[];
  const tempLogs    = logs.filter(l => l.type === "temperature")  as TempLog[];
  const danger      = tempLogs.filter(l => l.status === "DANGER");
  const warn        = tempLogs.filter(l => l.status === "WARN");
  const loggers     = [...new Set(logs.map(l => l.logger))];

  // ── Filter ────────────────────────────────────────────────────────────────
  const visible = logs.filter(l => {
    if (filter !== "all" && l.type !== filter) return false;
    if (search && !l.logger.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFilter && l.date !== dateFilter) return false;
    return true;
  });

  // ── Export CSV ────────────────────────────────────────────────────────────
  function exportCSV() {
    const rows = [
      ["Date", "Time", "Type", "Logger", "Location", "Point/Area", "Value", "Unit/Status", "Notes"],
      ...visible.map(l => l.type === "water"
        ? [l.date, l.time, "Water", l.logger, l.location, l.meterPoint, l.reading, l.unit, l.notes]
        : [l.date, l.time, "Temp", l.logger, l.location, areaLabel(l.area), l.temperature + "°C", l.status, l.notes]
      ),
    ];
    const csv = rows.map(r => r.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `aqualog-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: "var(--bg-elevated)",
    border: "1px solid var(--bg-border)",
    borderRadius: "8px",
    color: "var(--text-primary)",
    padding: "6px 10px",
    fontSize: "0.8rem",
    outline: "none",
  };

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ width: "100%", maxWidth: 360 }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: "var(--brand)", color: "#080B10",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 24, margin: "0 auto 1rem",
            }}>A</div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
              Admin Console
            </h1>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>AquaLog · Hotel Utility Logs</p>
          </div>
          <div className="card" style={{ padding: "1.5rem" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
              Admin Password
            </label>
            <input
              className="input-field"
              type="password"
              placeholder="Enter password"
              value={pwd}
              onChange={e => { setPwd(e.target.value); setPwdErr(""); }}
              onKeyDown={e => e.key === "Enter" && login()}
              autoFocus
              style={{ marginBottom: "0.75rem" }}
            />
            {pwdErr && <p style={{ fontSize: "0.8rem", color: "var(--danger)", marginBottom: "0.75rem" }}>{pwdErr}</p>}
            <button className="btn-primary" onClick={login} disabled={loading || !pwd.trim()}>
              {loading ? "Verifying…" : "Sign In →"}
            </button>
          </div>
          <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
            <Link href="/log" style={{ fontSize: "0.8rem", color: "var(--text-muted)", textDecoration: "none" }}>
              ← Back to logger
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg-base)" }}>
      {/* Header */}
      <header style={{
        backgroundColor: "var(--bg-surface)",
        borderBottom: "1px solid var(--bg-border)",
        padding: "0 1.25rem",
        height: "3.5rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: "var(--brand)", color: "#080B10",
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14,
          }}>A</div>
          <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>AquaLog</span>
          <span style={{
            fontSize: "0.65rem", fontWeight: 500, padding: "2px 8px", borderRadius: 999,
            background: "rgba(239,68,68,.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,.3)",
          }}>Admin</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <ThemeToggle />
          <button
            onClick={exportCSV}
            style={{
              fontSize: "0.75rem", padding: "5px 12px", borderRadius: 8,
              background: "var(--bg-elevated)", border: "1px solid var(--bg-border)",
              color: "var(--text-secondary)", cursor: "pointer",
            }}
          >
            ↓ CSV
          </button>
          <button
            onClick={() => { sessionStorage.removeItem("aqualog-admin-pwd"); setAuthed(false); }}
            style={{ fontSize: "0.75rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1.25rem 3rem" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <StatCard icon="📋" label="Total Logs"    value={logs.length}         sub={`${todayLogs.length} today`} />
          <StatCard icon="👥" label="Loggers"       value={loggers.length}       sub={loggers.slice(0,2).join(", ")} />
          <StatCard icon="💧" label="Water Logs"    value={waterLogs.length}     color="var(--brand-water)" />
          <StatCard icon="🌡️" label="Temp Logs"     value={tempLogs.length}      color="var(--brand-temp)" />
          {danger.length > 0 && (
            <div className="card" style={{ padding: "1rem", gridColumn: "1/-1", border: "1px solid var(--danger)", background: "var(--danger-dim)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span>🚨</span>
                <span style={{ fontWeight: 600, color: "var(--danger)", fontSize: "0.85rem" }}>
                  {danger.length} Out-of-Range Reading{danger.length > 1 ? "s" : ""} Today
                </span>
              </div>
              {danger.slice(0, 3).map((d, i) => (
                <div key={i} style={{ fontSize: "0.75rem", color: "var(--danger)", marginLeft: "1.75rem", lineHeight: 1.6 }}>
                  {d.date} {d.time} · {d.logger} · {areaLabel(d.area)} → {d.temperature}°C
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="card" style={{ padding: "0.875rem 1rem", marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "0.625rem", alignItems: "center" }}>
          <input
            style={inputStyle}
            placeholder="Search logger name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select style={inputStyle} value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
            <option value="all">All types</option>
            <option value="water">Water only</option>
            <option value="temperature">Temperature only</option>
          </select>
          <input
            style={inputStyle}
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            title="Filter by date"
          />
          {(search || filter !== "all" || dateFilter) && (
            <button
              style={{ ...inputStyle, cursor: "pointer", color: "var(--brand)" }}
              onClick={() => { setSearch(""); setFilter("all"); setDateFilter(""); }}
            >
              Clear
            </button>
          )}
          <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {visible.length} entries
          </span>
          <button
            onClick={() => fetchLogs(sessionStorage.getItem("aqualog-admin-pwd") ?? "")}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            ↻
          </button>
        </div>

        {/* Log table */}
        <div className="card" style={{ overflow: "hidden" }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "70px 55px 60px 1fr 1fr 80px 80px",
            padding: "0.625rem 1rem",
            backgroundColor: "var(--bg-elevated)",
            borderBottom: "1px solid var(--bg-border)",
            fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)",
            gap: "0.5rem",
          }}>
            <span>Date</span>
            <span>Time</span>
            <span>Type</span>
            <span>Logger</span>
            <span>Point / Area</span>
            <span>Reading</span>
            <span>Status</span>
          </div>

          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Loading logs…
            </div>
          ) : visible.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              No logs found.
            </div>
          ) : (
            visible.map((l, i) => {
              const isTempDanger = l.type === "temperature" && l.status === "DANGER";
              const isTempWarn   = l.type === "temperature" && l.status === "WARN";
              return (
                <motion.div
                  key={l.timestamp + i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.015 }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "70px 55px 60px 1fr 1fr 80px 80px",
                    padding: "0.625rem 1rem",
                    borderBottom: "1px solid var(--bg-border)",
                    alignItems: "center",
                    gap: "0.5rem",
                    backgroundColor: isTempDanger ? "rgba(239,68,68,.05)" : "var(--bg-surface)",
                    fontSize: "0.78rem",
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>{relDate(l.date)}</span>
                  <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>{l.time}</span>
                  <span>
                    {l.type === "water"
                      ? <span style={{ color: "var(--brand-water)", fontSize: "0.75rem" }}>💧 Water</span>
                      : <span style={{ color: "var(--brand-temp)", fontSize: "0.75rem" }}>🌡 Temp</span>}
                  </span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{l.logger}</span>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.72rem" }}>
                    {l.type === "water" ? l.meterPoint : areaLabel(l.area)}
                  </span>
                  <span style={{ color: "var(--text-primary)", fontFamily: "monospace", fontWeight: 600 }}>
                    {l.type === "water" ? `${l.reading} ${l.unit}` : `${l.temperature}°C`}
                  </span>
                  <span>
                    {l.type === "temperature"
                      ? <span className={l.status === "OK" ? "badge-ok" : l.status === "WARN" ? "badge-warn" : "badge-danger"}>
                          {l.status}
                        </span>
                      : <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>—</span>}
                  </span>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Loggers breakdown */}
        {loggers.length > 0 && (
          <div style={{ marginTop: "1.5rem" }}>
            <h3 style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Staff Activity
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.625rem" }}>
              {loggers.map(lg => {
                const lgLogs = logs.filter(l => l.logger === lg);
                const lgToday = todayLogs.filter(l => l.logger === lg);
                return (
                  <div key={lg} className="card-elevated" style={{ padding: "0.875rem" }}>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                      {lg}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {lgLogs.length} total · {lgToday.length} today
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
