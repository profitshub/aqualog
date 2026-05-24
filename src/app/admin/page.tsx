"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { TEMP_AREAS, HOTEL_NAME } from "@/lib/config";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TodayStats {
  date: string;
  waterLogs: number; tempLogs: number; waterTotal: number;
  compliance: number | null; dangerCount: number;
  dangerItems: { area: string; temp: string; logger: string; time: string }[];
  loggers: string[]; totalLogs: number;
}
interface TrendDay  { date: string; total: number; ok: number; compliance: number | null; }
interface StatsData {
  today: TodayStats; targets: Record<string, number>;
  trend: TrendDay[]; totalLogs: number; allLoggers: string[]; spreadsheetUrl: string;
}
interface StaffMember {
  email: string; name: string; location: string;
  addedBy: string; addedDate: string; active: boolean;
}
interface Target { metric: string; value: number; unit: string; notes: string; }
interface WaterLog {
  type: "water"; timestamp: string; date: string; time: string;
  logger: string; loggerEmail: string; location: string;
  meterPoint: string; reading: string; unit: string; notes: string;
}
interface TempLog {
  type: "temperature"; timestamp: string; date: string; time: string;
  logger: string; loggerEmail: string; location: string;
  area: string; temperature: string; min: string; max: string;
  status: "OK" | "WARN" | "DANGER"; notes: string;
}
type AnyLog = WaterLog | TempLog;
type Tab = "overview" | "logs" | "staff" | "targets";

// ── Helpers ───────────────────────────────────────────────────────────────────

function areaLabel(id: string) { return TEMP_AREAS.find(a => a.id === id)?.label ?? id; }

function relDate(d: string) {
  if (!d) return "—";
  const [dd, mm, yyyy] = d.split("/");
  const diff = Math.round((Date.now() - new Date(`${yyyy}-${mm}-${dd}`).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d;
}

const TARGET_META: Record<string, { label: string; unit: string; desc: string; good: "high" | "low" }> = {
  daily_water_limit:      { label: "Daily Water Limit",      unit: "m³",    desc: "Max daily water consumption",                 good: "low"  },
  temp_compliance_rate:   { label: "Temp Compliance Target", unit: "%",     desc: "% of readings within safe range",             good: "high" },
  checks_per_area_per_day:{ label: "Checks per Area / Day",  unit: "count", desc: "Required logging frequency per monitored area", good: "high" },
};

// ── Google Icon SVG ───────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

// ── ThemeToggle ───────────────────────────────────────────────────────────────

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

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: "1rem 1.125rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "1.1rem" }}>{icon}</span>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, color: color ?? "var(--text-primary)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>{sub}</div>}
    </div>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────

function ProgressBar({ label, value, target, unit, good }: { label: string; value: number; target: number; unit: string; good: "high" | "low" }) {
  const pct    = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  const isGood = good === "high" ? pct >= 80 : pct <= 100;
  const color  = isGood ? "var(--brand)" : pct >= 60 ? "var(--warn)" : "var(--danger)";
  return (
    <div style={{ marginBottom: "0.875rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{value} / {target} {unit}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--bg-elevated)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

// ── TrendChart ────────────────────────────────────────────────────────────────

function TrendChart({ trend }: { trend: TrendDay[] }) {
  const maxH = 48;
  return (
    <div>
      <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
        7-Day Temp Compliance
      </p>
      <div style={{ display: "flex", gap: "0.375rem", alignItems: "flex-end", height: maxH + 20 }}>
        {trend.map((d, i) => {
          const pct   = d.compliance ?? 0;
          const barH  = d.compliance !== null ? Math.max((pct / 100) * maxH, 3) : 3;
          const color = d.compliance === null ? "var(--bg-elevated)"
                      : pct >= 90 ? "var(--brand)" : pct >= 70 ? "var(--warn)" : "var(--danger)";
          const label = d.date.split("/").slice(0,2).join("/");
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>
                {d.compliance !== null ? `${d.compliance}%` : "—"}
              </span>
              <div style={{ width: "100%", height: barH, borderRadius: 4, background: color, transition: "height 0.4s ease" }}
                title={`${d.date}: ${d.compliance !== null ? d.compliance + "%" : "no data"}`} />
              <span style={{ fontSize: "0.58rem", color: "var(--text-muted)" }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Overview Panel ────────────────────────────────────────────────────────────

function OverviewPanel({ stats, onRefresh }: { stats: StatsData; onRefresh: () => void }) {
  const { today, targets, trend, totalLogs, allLoggers, spreadsheetUrl } = stats;

  const sheetId = spreadsheetUrl.match(/\/d\/([^/]+)/)?.[1] ?? "";

  function copyId() {
    navigator.clipboard.writeText(sheetId);
  }

  return (
    <div>
      {/* Spreadsheet setup banner */}
      <div className="card" style={{ padding: "0.875rem 1rem", marginBottom: "1.25rem", borderColor: "rgba(0,212,170,0.3)", background: "rgba(0,212,170,0.05)" }}>
        <p style={{ fontSize: "0.75rem", color: "var(--brand)", fontWeight: 600, marginBottom: "0.35rem" }}>
          📋 Your Google Sheet
        </p>
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
          Copy the Sheet ID below and set it as <code style={{ fontSize: "0.7rem", background: "var(--bg-elevated)", padding: "1px 5px", borderRadius: 4 }}>GOOGLE_SHEET_ID</code> in Vercel → Settings → Environment Variables so loggers can submit readings.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <code style={{ fontSize: "0.7rem", color: "var(--text-secondary)", background: "var(--bg-elevated)", padding: "4px 8px", borderRadius: 6, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sheetId || spreadsheetUrl}
          </code>
          <button onClick={copyId} style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: 6, background: "var(--brand)", color: "#080B10", border: "none", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
            Copy ID
          </button>
          <a href={spreadsheetUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: 6, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--bg-border)", cursor: "pointer", textDecoration: "none", flexShrink: 0 }}>
            Open Sheet ↗
          </a>
        </div>
      </div>

      {/* Danger alert */}
      {today.dangerCount > 0 && (
        <div className="card" style={{ padding: "0.875rem 1rem", marginBottom: "1.25rem", borderColor: "var(--danger)", background: "var(--danger-dim)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
            <span>🚨</span>
            <span style={{ fontWeight: 600, color: "var(--danger)", fontSize: "0.85rem" }}>
              {today.dangerCount} Out-of-Range Reading{today.dangerCount > 1 ? "s" : ""} Today
            </span>
          </div>
          {today.dangerItems.slice(0, 4).map((d, i) => (
            <div key={i} style={{ fontSize: "0.73rem", color: "var(--danger)", marginLeft: "1.5rem", lineHeight: 1.7 }}>
              {d.time} · {d.logger} · {areaLabel(d.area)} → {d.temp}°C
            </div>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <StatCard icon="💧" label="Water Logs Today"    value={today.waterLogs}    sub={`${today.waterTotal} m³ total`}   color="var(--brand-water)" />
        <StatCard icon="🌡️" label="Temp Logs Today"    value={today.tempLogs}                                              color="var(--brand-temp)" />
        <StatCard icon="✅" label="Compliance"
          value={today.compliance !== null ? `${today.compliance}%` : "—"}
          sub="temp readings in range"
          color={today.compliance === null ? undefined : today.compliance >= 90 ? "var(--ok)" : today.compliance >= 70 ? "var(--warn)" : "var(--danger)"}
        />
        <StatCard icon="📋" label="Total Logs (All Time)" value={totalLogs} sub={`${allLoggers.length} loggers`} />
      </div>

      {/* Targets progress */}
      {Object.keys(targets).length > 0 && (
        <div className="card" style={{ padding: "1rem 1.125rem", marginBottom: "1.25rem" }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>
            Today's Progress
          </p>
          {targets.daily_water_limit !== undefined && (
            <ProgressBar label="Water Consumption" value={today.waterTotal} target={targets.daily_water_limit} unit="m³" good="low" />
          )}
          {targets.temp_compliance_rate !== undefined && today.compliance !== null && (
            <ProgressBar label="Temp Compliance" value={today.compliance} target={targets.temp_compliance_rate} unit="%" good="high" />
          )}
          {targets.checks_per_area_per_day !== undefined && (
            <ProgressBar
              label="Checks per Area"
              value={TEMP_AREAS.length > 0 ? Math.round(today.tempLogs / Math.max(TEMP_AREAS.length, 1)) : today.tempLogs}
              target={targets.checks_per_area_per_day}
              unit="checks"
              good="high"
            />
          )}
        </div>
      )}

      {/* 7-day trend */}
      <div className="card" style={{ padding: "1rem 1.125rem", marginBottom: "1.25rem" }}>
        <TrendChart trend={trend} />
      </div>

      {/* Active loggers */}
      {allLoggers.length > 0 && (
        <div>
          <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
            All-Time Loggers
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {allLoggers.map(lg => (
              <span key={lg} style={{ fontSize: "0.75rem", padding: "3px 10px", borderRadius: 999, background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", color: "var(--text-secondary)" }}>
                {lg}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: "1.5rem", textAlign: "right" }}>
        <button onClick={onRefresh} style={{ fontSize: "0.75rem", padding: "5px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", color: "var(--text-secondary)", cursor: "pointer" }}>
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}

// ── Logs Panel ────────────────────────────────────────────────────────────────

function LogsPanel({ logs, loading, onRefresh }: { logs: AnyLog[]; loading: boolean; onRefresh: () => void }) {
  const [logType, setLogType] = useState<"all" | "water" | "temperature">("all");
  const [search,  setSearch]  = useState("");
  const [dateVal, setDateVal] = useState("");

  const visible = logs.filter(l => {
    if (logType !== "all" && l.type !== logType) return false;
    if (search && !l.logger.toLowerCase().includes(search.toLowerCase()) && !l.loggerEmail?.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateVal && l.date !== new Date(dateVal).toLocaleDateString("en-GB")) return false;
    return true;
  });

  function exportCSV() {
    const rows = [
      ["Date", "Time", "Type", "Logger", "Email", "Location", "Point/Area", "Value", "Unit/Status", "Notes"],
      ...visible.map(l => l.type === "water"
        ? [l.date, l.time, "Water", l.logger, l.loggerEmail, l.location, l.meterPoint, l.reading, l.unit, l.notes]
        : [l.date, l.time, "Temp", l.logger, l.loggerEmail, l.location, areaLabel(l.area), l.temperature + "°C", l.status, l.notes]
      ),
    ];
    const csv = rows.map(r => r.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `aqualog-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  const inputS: React.CSSProperties = { backgroundColor: "var(--bg-elevated)", border: "1px solid var(--bg-border)", borderRadius: 8, color: "var(--text-primary)", padding: "6px 10px", fontSize: "0.8rem", outline: "none" };

  return (
    <div>
      {/* Toolbar */}
      <div className="card" style={{ padding: "0.75rem 1rem", marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <input style={inputS} placeholder="Search logger…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={inputS} value={logType} onChange={e => setLogType(e.target.value as typeof logType)}>
          <option value="all">All types</option>
          <option value="water">Water only</option>
          <option value="temperature">Temp only</option>
        </select>
        <input style={inputS} type="date" value={dateVal} onChange={e => setDateVal(e.target.value)} />
        {(search || logType !== "all" || dateVal) && (
          <button style={{ ...inputS, cursor: "pointer", color: "var(--brand)" }} onClick={() => { setSearch(""); setLogType("all"); setDateVal(""); }}>
            Clear
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--text-muted)" }}>{visible.length} entries</span>
        <button onClick={exportCSV} style={{ ...inputS, cursor: "pointer" }}>↓ CSV</button>
        <button onClick={onRefresh} style={{ ...inputS, cursor: "pointer" }}>↻</button>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "70px 50px 55px 1fr 1fr 80px 70px", padding: "0.6rem 1rem", backgroundColor: "var(--bg-elevated)", borderBottom: "1px solid var(--bg-border)", fontSize: "0.68rem", fontWeight: 600, color: "var(--text-muted)", gap: "0.5rem" }}>
          <span>Date</span><span>Time</span><span>Type</span><span>Logger</span><span>Point/Area</span><span>Reading</span><span>Status</span>
        </div>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading logs…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>No logs found.</div>
        ) : (
          visible.slice(0, 200).map((l, i) => (
            <div key={l.timestamp + i} style={{
              display: "grid", gridTemplateColumns: "70px 50px 55px 1fr 1fr 80px 70px",
              padding: "0.6rem 1rem", borderBottom: "1px solid var(--bg-border)",
              alignItems: "center", gap: "0.5rem", fontSize: "0.76rem",
              backgroundColor: l.type === "temperature" && l.status === "DANGER" ? "rgba(239,68,68,.04)" : "var(--bg-surface)",
            }}>
              <span style={{ color: "var(--text-secondary)" }}>{relDate(l.date)}</span>
              <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>{l.time}</span>
              <span>{l.type === "water"
                ? <span style={{ color: "var(--brand-water)", fontSize: "0.7rem" }}>💧 Water</span>
                : <span style={{ color: "var(--brand-temp)", fontSize: "0.7rem" }}>🌡 Temp</span>}
              </span>
              <span style={{ color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.logger}</span>
              <span style={{ color: "var(--text-secondary)", fontSize: "0.72rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {l.type === "water" ? l.meterPoint : areaLabel(l.area)}
              </span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--text-primary)" }}>
                {l.type === "water" ? `${l.reading} ${l.unit}` : `${l.temperature}°C`}
              </span>
              <span>
                {l.type === "temperature"
                  ? <span className={l.status === "OK" ? "badge-ok" : l.status === "WARN" ? "badge-warn" : "badge-danger"}>{l.status}</span>
                  : <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>—</span>}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Staff Panel ───────────────────────────────────────────────────────────────

function StaffPanel({ staff, loading, onRefresh }: {
  staff: StaffMember[]; loading: boolean;
  onRefresh: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name,  setName]  = useState("");
  const [busy,  setBusy]  = useState(false);
  const [msg,   setMsg]   = useState<{ text: string; ok: boolean } | null>(null);

  async function addStaff() {
    if (!email.trim() || !name.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/loggers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() }) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error");
      setMsg({ text: `${name} added as an authorized logger.`, ok: true });
      setEmail(""); setName("");
      onRefresh();
    } catch (e) {
      setMsg({ text: String(e), ok: false });
    } finally { setBusy(false); }
  }

  async function removeStaff(memberEmail: string) {
    if (!confirm(`Deactivate ${memberEmail}?`)) return;
    setBusy(true);
    try {
      await fetch("/api/admin/loggers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: memberEmail }) });
      onRefresh();
    } finally { setBusy(false); }
  }

  const active   = staff.filter(s => s.active);
  const inactive = staff.filter(s => !s.active);

  return (
    <div>
      {/* Add form */}
      <div className="card" style={{ padding: "1.125rem", marginBottom: "1.25rem" }}>
        <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.875rem" }}>
          Add Authorized Logger
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem", marginBottom: "0.625rem" }}>
          <input
            className="input-field" style={{ fontSize: "0.85rem", padding: "0.625rem 0.875rem" }}
            placeholder="Full name" value={name} onChange={e => setName(e.target.value)}
          />
          <input
            className="input-field" style={{ fontSize: "0.85rem", padding: "0.625rem 0.875rem" }}
            placeholder="Work email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addStaff()}
          />
        </div>
        <button
          onClick={addStaff} disabled={busy || !email.trim() || !name.trim()}
          style={{ padding: "0.625rem 1.25rem", borderRadius: 8, background: "var(--brand)", color: "#080B10", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", opacity: busy || !email.trim() || !name.trim() ? 0.5 : 1 }}
        >
          {busy ? "Adding…" : "Add Logger"}
        </button>
        {msg && (
          <p style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: msg.ok ? "var(--ok)" : "var(--danger)" }}>
            {msg.text}
          </p>
        )}
      </div>

      {/* Active list */}
      {loading ? (
        <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading…</div>
      ) : (
        <>
          <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
            Active ({active.length})
          </p>
          {active.length === 0 ? (
            <div className="card" style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.82rem" }}>
              No loggers added yet. Add someone above to get started.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
              {active.map(s => (
                <div key={s.email} className="card" style={{ padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)" }}>{s.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{s.email}</div>
                    {s.addedDate && <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>Added {s.addedDate}</div>}
                  </div>
                  <button
                    onClick={() => removeStaff(s.email)} disabled={busy}
                    style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: 6, background: "var(--danger-dim)", color: "var(--danger)", border: "1px solid rgba(239,68,68,.3)", cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {inactive.length > 0 && (
            <>
              <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                Deactivated ({inactive.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {inactive.map(s => (
                  <div key={s.email} className="card" style={{ padding: "0.75rem 1rem", opacity: 0.5 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-secondary)" }}>{s.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{s.email}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Targets Panel ─────────────────────────────────────────────────────────────

function TargetsPanel({ loaded, onSaved }: { loaded: boolean; onSaved: (vals: Record<string, string>) => void }) {
  const [vals,   setVals]   = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState<{ text: string; ok: boolean } | null>(null);
  const [inited, setInited] = useState(false);

  useEffect(() => {
    if (!inited) {
      fetch("/api/admin/targets")
        .then(r => r.json())
        .then((data: Target[]) => {
          const v: Record<string, string> = {};
          data.forEach(t => { v[t.metric] = String(t.value); });
          setVals(v);
          setInited(true);
        });
    }
  }, [inited]);

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const updates = Object.entries(vals).map(([metric, value]) => ({ metric, value: parseFloat(value) || 0 }));
      const r = await fetch("/api/admin/targets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
      if (!r.ok) throw new Error("Failed to save");
      setMsg({ text: "Targets saved successfully.", ok: true });
      onSaved(vals);
    } catch {
      setMsg({ text: "Failed to save. Try again.", ok: false });
    } finally { setSaving(false); }
  }

  if (!inited) {
    return <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading targets…</div>;
  }

  return (
    <div>
      <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
        <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "1rem" }}>
          Operational Targets — {HOTEL_NAME}
        </p>
        {Object.entries(TARGET_META).map(([key, meta]) => (
          <div key={key} style={{ marginBottom: "1.125rem" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
              {meta.label}
            </label>
            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.375rem" }}>{meta.desc}</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                className="input-field"
                style={{ fontSize: "0.9rem", padding: "0.6rem 0.875rem" }}
                type="number" min={0} step={key === "daily_water_limit" ? 0.5 : 1}
                value={vals[key] ?? ""}
                onChange={e => setVals(prev => ({ ...prev, [key]: e.target.value }))}
              />
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", flexShrink: 0 }}>{meta.unit}</span>
            </div>
          </div>
        ))}
        <button
          onClick={save} disabled={saving}
          style={{ padding: "0.7rem 1.5rem", borderRadius: 8, background: "var(--brand)", color: "#080B10", border: "none", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.88rem", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving…" : "Save Targets"}
        </button>
        {msg && (
          <p style={{ marginTop: "0.625rem", fontSize: "0.78rem", color: msg.ok ? "var(--ok)" : "var(--danger)" }}>
            {msg.text}
          </p>
        )}
      </div>

      <div className="card" style={{ padding: "1rem", borderColor: "rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.04)" }}>
        <p style={{ fontSize: "0.75rem", color: "var(--warn)", fontWeight: 600, marginBottom: "0.25rem" }}>💡 How targets work</p>
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
          These targets appear as progress bars on the Overview tab. They are stored in the "Targets" sheet and update in real-time as logs are submitted. Set targets that reflect your hotel's operational standards.
        </p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [pageState, setPageState] = useState<"checking" | "unauthed" | "authed">("checking");
  const [stats,     setStats]     = useState<StatsData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const [logs,       setLogs]       = useState<AnyLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logsLoading,setLogsLoading]= useState(false);

  const [staff,       setStaff]       = useState<StaffMember[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [staffLoading,setStaffLoading]= useState(false);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/stats");
      if (r.status === 401) { setPageState("unauthed"); return; }
      if (!r.ok) throw new Error();
      setStats(await r.json());
      setPageState("authed");
    } catch { setPageState("unauthed"); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const fetchLogs = useCallback(async () => {
    if (logsLoading) return;
    setLogsLoading(true);
    try {
      const r = await fetch("/api/logs");
      if (r.ok) { setLogs((await r.json()).all ?? []); setLogsLoaded(true); }
    } finally { setLogsLoading(false); }
  }, [logsLoading]);

  const fetchStaff = useCallback(async () => {
    if (staffLoading) return;
    setStaffLoading(true);
    try {
      const r = await fetch("/api/admin/loggers");
      if (r.ok) { setStaff(await r.json()); setStaffLoaded(true); }
    } finally { setStaffLoading(false); }
  }, [staffLoading]);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    if (tab === "logs"  && !logsLoaded)  fetchLogs();
    if (tab === "staff" && !staffLoaded) fetchStaff();
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setPageState("unauthed");
    setStats(null);
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (pageState === "checking") {
    return (
      <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading…</p>
      </div>
    );
  }

  // ── Sign-in screen ────────────────────────────────────────────────────────

  if (pageState === "unauthed") {
    return (
      <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ width: "100%", maxWidth: 360 }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--brand)", color: "#080B10", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 24, margin: "0 auto 1rem" }}>
              A
            </div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.25rem" }}>Admin Console</h1>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>AquaLog · {HOTEL_NAME}</p>
          </div>

          <div className="card" style={{ padding: "1.5rem" }}>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
              Sign in with the Google account that will own the hotel's log spreadsheet. Your sheet is created automatically on first sign-in.
            </p>
            <button
              onClick={() => { window.location.href = "/api/auth/google"; }}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", padding: "0.875rem", borderRadius: 10, background: "var(--bg-elevated)", border: "1.5px solid var(--bg-border)", color: "var(--text-primary)", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer" }}
            >
              <GoogleIcon /> Sign in with Google
            </button>
          </div>

          <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
            <Link href="/" style={{ fontSize: "0.8rem", color: "var(--text-muted)", textDecoration: "none" }}>← Back</Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "logs",     label: "Logs"     },
    { id: "staff",    label: "Staff"    },
    { id: "targets",  label: "Targets"  },
  ];

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg-base)" }}>
      {/* Header */}
      <header style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--bg-border)", padding: "0 1.25rem", height: "3.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--brand)", color: "#080B10", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>A</div>
          <div>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)", display: "block", lineHeight: 1.1 }}>AquaLog</span>
            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{HOTEL_NAME}</span>
          </div>
          <span style={{ fontSize: "0.65rem", fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: "rgba(239,68,68,.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,.3)" }}>
            Admin
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <ThemeToggle />
          <button onClick={signOut} style={{ fontSize: "0.75rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
            Sign out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--bg-border)", padding: "0 1.25rem", display: "flex", gap: "0.25rem" }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            style={{
              padding: "0.625rem 1rem",
              fontSize: "0.82rem",
              fontWeight: activeTab === t.id ? 600 : 400,
              color: activeTab === t.id ? "var(--brand)" : "var(--text-muted)",
              background: "none",
              border: "none",
              borderBottom: activeTab === t.id ? "2px solid var(--brand)" : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -1,
              transition: "color 150ms",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>
        {activeTab === "overview" && stats && (
          <OverviewPanel stats={stats} onRefresh={loadStats} />
        )}
        {activeTab === "logs" && (
          <LogsPanel logs={logs} loading={logsLoading} onRefresh={fetchLogs} />
        )}
        {activeTab === "staff" && (
          <StaffPanel
            staff={staff}
            loading={staffLoading}
            onRefresh={() => { setStaffLoaded(false); fetchStaff(); }}
          />
        )}
        {activeTab === "targets" && (
          <TargetsPanel
            loaded={true}
            onSaved={() => loadStats()}
          />
        )}
      </main>
    </div>
  );
}
