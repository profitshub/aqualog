"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { TEMP_AREAS } from "@/lib/config";

interface LocationRecord { id: string; name: string; sheetId: string; createdAt: string; }

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
type Tab = "overview" | "logs" | "staff" | "targets" | "notify" | "locations";

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

function StaffPanel({ staff, loading, onRefresh, location }: {
  staff: StaffMember[]; loading: boolean; onRefresh: () => void; location: string;
}) {
  const [email, setEmail] = useState("");
  const [name,  setName]  = useState("");
  const [busy,  setBusy]  = useState(false);
  const [msg,   setMsg]   = useState<{ text: string; ok: boolean } | null>(null);

  async function addStaff() {
    if (!email.trim() || !name.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/admin/loggers?location=${location}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() }) });
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
      await fetch(`/api/admin/loggers?location=${location}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: memberEmail }) });
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

function TargetsPanel({ loaded, onSaved, location, locationLabel }: { loaded: boolean; onSaved: (vals: Record<string, string>) => void; location: string; locationLabel?: string }) {
  const [vals,   setVals]   = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState<{ text: string; ok: boolean } | null>(null);
  const [inited, setInited] = useState(false);

  useEffect(() => {
    setInited(false);
  }, [location]);

  useEffect(() => {
    if (!inited) {
      fetch(`/api/admin/targets?location=${location}`)
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
      const r = await fetch(`/api/admin/targets?location=${location}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
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
          Operational Targets — {locationLabel ?? location}
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

// ── Notifications Panel ───────────────────────────────────────────────────────

interface NotifyData {
  schedule: { enabled: boolean; times: string[]; message: string };
  subscriberCount: number;
  subscribers: { email: string; name: string; createdAt: string }[];
}

function NotificationsPanel({ location }: { location: string }) {
  const [data,    setData]    = useState<NotifyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [times,   setTimes]   = useState<string[]>(["08:00", "13:00", "17:00"]);
  const [message, setMessage] = useState("");
  const [saving,  setSaving]  = useState(false);
  const [sending, setSending] = useState(false);
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const vapidConfigured = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    fetch(`/api/admin/notify?location=${location}`)
      .then(r => r.json())
      .then((d: NotifyData) => {
        setData(d);
        setEnabled(d.schedule.enabled);
        setTimes(d.schedule.times.length > 0 ? d.schedule.times : ["08:00", "13:00", "17:00"]);
        setMessage(d.schedule.message);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function addTime() {
    if (times.length >= 4) return;
    setTimes(prev => [...prev, "12:00"]);
  }
  function removeTime(i: number) { setTimes(prev => prev.filter((_, idx) => idx !== i)); }
  function updateTime(i: number, val: string) { setTimes(prev => prev.map((t, idx) => idx === i ? val : t)); }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`/api/admin/notify?location=${location}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, times: times.filter(Boolean), message }),
      });
      if (!r.ok) throw new Error();
      setMsg({ text: "Schedule saved.", ok: true });
      setData(prev => prev ? { ...prev, schedule: { enabled, times, message } } : prev);
    } catch {
      setMsg({ text: "Failed to save. Try again.", ok: false });
    } finally { setSaving(false); }
  }

  async function sendNow() {
    if (!confirm(`Send a test notification to all ${data?.subscriberCount ?? 0} subscriber(s) now?`)) return;
    setSending(true); setMsg(null);
    try {
      const r = await fetch(`/api/admin/notify?location=${location}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const json = await r.json() as { sent: number; total: number };
      setMsg({ text: `Sent to ${json.sent} of ${json.total} device(s).`, ok: true });
    } catch {
      setMsg({ text: "Failed to send.", ok: false });
    } finally { setSending(false); }
  }

  if (loading) {
    return <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* VAPID warning */}
      {!vapidConfigured && (
        <div className="card" style={{ padding: "1rem", borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.06)" }}>
          <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--warn)", marginBottom: "0.35rem" }}>⚙️ Setup required</p>
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
            Add these environment variables to Vercel to enable push notifications:
          </p>
          {[
            ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "Your VAPID public key"],
            ["VAPID_PRIVATE_KEY",            "Your VAPID private key"],
            ["VAPID_SUBJECT",                "mailto:your-email@example.com"],
            ["CRON_SECRET",                  "Random string to secure /api/cron/notify"],
          ].map(([k, v]) => (
            <div key={k} style={{ marginTop: "0.4rem", fontFamily: "monospace", fontSize: "0.7rem", color: "var(--text-secondary)" }}>
              <span style={{ color: "var(--brand)" }}>{k}</span> — {v}
            </div>
          ))}
          <p style={{ marginTop: "0.625rem", fontSize: "0.7rem", color: "var(--text-muted)" }}>
            Generate VAPID keys: <code style={{ background: "var(--bg-elevated)", padding: "1px 5px", borderRadius: 4 }}>npx web-push generate-vapid-keys</code>
          </p>
        </div>
      )}

      {/* Subscriber count */}
      <div className="card" style={{ padding: "1rem 1.125rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--brand-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>
          🔔
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: "1.5rem", color: "var(--brand)", lineHeight: 1 }}>{data?.subscriberCount ?? 0}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>device{(data?.subscriberCount ?? 0) !== 1 ? "s" : ""} subscribed to push notifications</p>
        </div>
        <button
          onClick={sendNow}
          disabled={sending || (data?.subscriberCount ?? 0) === 0}
          style={{ fontSize: "0.78rem", fontWeight: 600, padding: "7px 14px", borderRadius: 8, background: "var(--brand)", color: "#080B10", border: "none", cursor: (data?.subscriberCount ?? 0) === 0 ? "not-allowed" : "pointer", opacity: (data?.subscriberCount ?? 0) === 0 ? 0.4 : 1, flexShrink: 0 }}
        >
          {sending ? "Sending…" : "Send Now"}
        </button>
      </div>

      {/* Subscriber list */}
      {(data?.subscribers.length ?? 0) > 0 && (
        <div>
          <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
            Subscribed devices
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {data!.subscribers.map((s, i) => (
              <div key={i} className="card-elevated" style={{ padding: "0.6rem 0.875rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>{s.name}</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>{s.email}</span>
                </div>
                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-GB") : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule editor */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.125rem" }}>
          <div>
            <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>Reminder Schedule</p>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>Times are in WAT (West Africa Time, UTC+1)</p>
          </div>
          {/* Enable toggle */}
          <button
            onClick={() => setEnabled(e => !e)}
            style={{
              width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer",
              background: enabled ? "var(--brand)" : "var(--bg-elevated)",
              position: "relative", transition: "background 200ms", flexShrink: 0,
            }}
          >
            <span style={{
              position: "absolute", top: 3, left: enabled ? 22 : 3,
              width: 18, height: 18, borderRadius: "50%", background: "#fff",
              transition: "left 200ms",
            }} />
          </button>
        </div>

        {enabled && (
          <>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
              Reminder times
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.875rem" }}>
              {times.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="time"
                    value={t}
                    onChange={e => updateTime(i, e.target.value)}
                    style={{ flex: 1, backgroundColor: "var(--bg-elevated)", border: "1px solid var(--bg-border)", borderRadius: 8, color: "var(--text-primary)", padding: "0.5rem 0.75rem", fontSize: "0.9rem", outline: "none" }}
                  />
                  <button
                    onClick={() => removeTime(i)}
                    disabled={times.length <= 1}
                    style={{ padding: "0.5rem 0.75rem", borderRadius: 8, background: "var(--danger-dim)", color: "var(--danger)", border: "1px solid rgba(239,68,68,.25)", cursor: times.length <= 1 ? "not-allowed" : "pointer", fontSize: "0.8rem", opacity: times.length <= 1 ? 0.4 : 1 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {times.length < 4 && (
              <button
                onClick={addTime}
                style={{ fontSize: "0.78rem", padding: "5px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", color: "var(--text-secondary)", cursor: "pointer", marginBottom: "0.875rem" }}
              >
                + Add time
              </button>
            )}

            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.375rem" }}>
              Notification message <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              className="input-field"
              style={{ fontSize: "0.85rem", padding: "0.6rem 0.875rem", marginBottom: "1rem" }}
              placeholder="Please submit your water and temperature readings."
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </>
        )}

        <button
          onClick={save}
          disabled={saving}
          style={{ padding: "0.65rem 1.5rem", borderRadius: 8, background: "var(--brand)", color: "#080B10", border: "none", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.85rem", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving…" : "Save Schedule"}
        </button>
        {msg && (
          <p style={{ marginTop: "0.625rem", fontSize: "0.78rem", color: msg.ok ? "var(--ok)" : "var(--danger)" }}>
            {msg.text}
          </p>
        )}
      </div>

      {/* Cron info */}
      <div className="card" style={{ padding: "1rem", borderColor: "rgba(0,212,170,0.2)", background: "rgba(0,212,170,0.03)" }}>
        <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--brand)", marginBottom: "0.3rem" }}>⚡ How it works</p>
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.7 }}>
          A Vercel cron job runs every 30 minutes and calls <code style={{ fontSize: "0.68rem", background: "var(--bg-elevated)", padding: "1px 5px", borderRadius: 4 }}>/api/cron/notify</code>. If the current WAT time falls within a configured reminder window, a push notification is sent to all subscribed devices. Requires a <strong style={{ color: "var(--text-secondary)" }}>Vercel Pro</strong> plan for sub-daily cron frequency.
        </p>
      </div>
    </div>
  );
}

// ── Locations Panel ───────────────────────────────────────────────────────────

function LocationRow({ loc, onDeleted }: { loc: LocationRecord; onDeleted: () => void }) {
  const [confirm,   setConfirm]   = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  async function doDelete() {
    setDeleting(true);
    try {
      await fetch("/api/admin/locations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: loc.id }) });
      onDeleted();
    } finally { setDeleting(false); setConfirm(false); }
  }

  return (
    <div className="card" style={{ padding: "1rem 1.125rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)", marginBottom: "0.2rem" }}>📍 {loc.name}</p>
        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc.sheetId}</p>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
        <a href={`https://docs.google.com/spreadsheets/d/${loc.sheetId}/edit`} target="_blank" rel="noreferrer"
          style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: 6, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--bg-border)", textDecoration: "none" }}>
          View Sheet ↗
        </a>
        {confirm ? (
          <>
            <button onClick={doDelete} disabled={deleting}
              style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: 6, background: "var(--danger)", color: "#fff", border: "none", cursor: "pointer" }}>
              {deleting ? "Removing…" : "Confirm"}
            </button>
            <button onClick={() => setConfirm(false)}
              style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: 6, background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--bg-border)", cursor: "pointer" }}>
              Cancel
            </button>
          </>
        ) : (
          <button onClick={() => setConfirm(true)}
            style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: 6, background: "rgba(239,68,68,0.08)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function LocationsPanel({ locations, registryId, needsEnvVar, onCreated }: {
  locations: LocationRecord[]; registryId: string; needsEnvVar: boolean; onCreated: () => void;
}) {
  const [name,     setName]     = useState("");
  const [creating, setCreating] = useState(false);
  const [error,    setError]    = useState("");
  const [msg,      setMsg]      = useState("");
  const [copied,   setCopied]   = useState(false);

  async function create() {
    if (!name.trim()) return;
    setCreating(true); setError(""); setMsg("");
    try {
      const r    = await fetch("/api/admin/locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
      const json = await r.json() as { ok?: boolean; error?: string; name?: string };
      if (!r.ok) { setError(json.error ?? "Failed to create location."); }
      else       { setMsg(`✓ "${json.name}" created — sheet is ready.`); setName(""); onCreated(); }
    } catch { setError("Network error. Try again."); }
    finally  { setCreating(false); }
  }

  function copyId() {
    navigator.clipboard.writeText(registryId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>Locations</h2>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{locations.length} location{locations.length !== 1 ? "s" : ""}</span>
      </div>

      {/* One-time env var banner */}
      {needsEnvVar && registryId && (
        <div className="card" style={{ padding: "0.875rem 1rem", marginBottom: "1.25rem", borderColor: "rgba(251,188,5,0.4)", background: "rgba(251,188,5,0.06)" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#FBBC05", marginBottom: "0.4rem" }}>⚠ One-time setup — save your registry ID</p>
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.7, marginBottom: "0.625rem" }}>
            AquaLog created your registry sheet automatically. Add the ID below to Vercel → Settings → Environment Variables as <code style={{ fontSize: "0.68rem", background: "var(--bg-elevated)", padding: "1px 5px", borderRadius: 4 }}>MASTER_SHEET_ID</code>, then redeploy. You only need to do this once.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <code style={{ flex: 1, fontSize: "0.72rem", background: "var(--bg-elevated)", padding: "0.4rem 0.6rem", borderRadius: 6, color: "var(--text-primary)", wordBreak: "break-all" }}>{registryId}</code>
            <button onClick={copyId} style={{ padding: "0.4rem 0.75rem", borderRadius: 6, background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", color: "var(--text-secondary)", fontSize: "0.72rem", cursor: "pointer", flexShrink: 0 }}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Add location */}
      <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
        <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.875rem" }}>Add New Location</p>
        <div style={{ display: "flex", gap: "0.625rem" }}>
          <input
            className="input-field"
            placeholder="e.g. Golden Tulip Lekki"
            value={name}
            onChange={e => { setName(e.target.value); setError(""); setMsg(""); }}
            onKeyDown={e => e.key === "Enter" && create()}
            style={{ flex: 1 }}
          />
          <button
            onClick={create}
            disabled={creating || !name.trim()}
            style={{ padding: "0.65rem 1.25rem", borderRadius: 8, background: "var(--brand)", color: "#080B10", border: "none", cursor: creating ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.85rem", opacity: creating ? 0.7 : 1, flexShrink: 0 }}
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
        {error && <p style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--danger)" }}>{error}</p>}
        {msg   && <p style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--ok)" }}>{msg}</p>}
      </div>

      {/* Location list */}
      {locations.length === 0 ? (
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No locations yet. Create your first one above.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {locations.map(loc => (
            <LocationRow key={loc.id} loc={loc} onDeleted={onCreated} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [pageState,  setPageState]  = useState<"checking" | "unauthed" | "authed">("checking");
  const [stats,      setStats]      = useState<StatsData | null>(null);
  const [activeTab,  setActiveTab]  = useState<Tab>("overview");
  const [activeLoc,  setActiveLoc]  = useState<string>("");
  const [locations,   setLocations]   = useState<LocationRecord[]>([]);
  const [registryId,  setRegistryId]  = useState<string>("");
  const [needsEnvVar, setNeedsEnvVar] = useState(false);

  const [logs,       setLogs]       = useState<AnyLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logsLoading,setLogsLoading]= useState(false);

  const [staff,       setStaff]       = useState<StaffMember[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [staffLoading,setStaffLoading]= useState(false);

  const loadLocations = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/locations");
      if (r.status === 401) { setPageState("unauthed"); return; }
      if (!r.ok) { setPageState("authed"); return; }
      const data = await r.json() as { locations: LocationRecord[]; registryId: string; needsEnvVar: boolean };
      const locs = data.locations ?? [];
      setLocations(locs);
      setRegistryId(data.registryId ?? "");
      setNeedsEnvVar(data.needsEnvVar ?? false);
      if (locs.length > 0 && !activeLoc) setActiveLoc(locs[0].id);
      setPageState("authed");
    } catch { setPageState("authed"); }
  }, [activeLoc]);

  const loadStats = useCallback(async (loc?: string) => {
    const location = loc ?? activeLoc;
    if (!location) return;
    try {
      const r = await fetch(`/api/admin/stats?location=${location}`);
      if (r.status === 401) { setPageState("unauthed"); return; }
      if (!r.ok) { setPageState("authed"); return; }
      setStats(await r.json());
      setPageState("authed");
    } catch { setPageState("authed"); }
  }, [activeLoc]);

  useEffect(() => {
    loadLocations().then(() => loadStats());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLogs = useCallback(async () => {
    if (logsLoading) return;
    setLogsLoading(true);
    try {
      const r = await fetch(`/api/logs?location=${activeLoc}`);
      if (r.ok) { setLogs((await r.json()).all ?? []); setLogsLoaded(true); }
    } finally { setLogsLoading(false); }
  }, [logsLoading, activeLoc]);

  const fetchStaff = useCallback(async () => {
    if (staffLoading) return;
    setStaffLoading(true);
    try {
      const r = await fetch(`/api/admin/loggers?location=${activeLoc}`);
      if (r.ok) { setStaff(await r.json()); setStaffLoaded(true); }
    } finally { setStaffLoading(false); }
  }, [staffLoading, activeLoc]);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    if (tab === "logs"      && !logsLoaded)  fetchLogs();
    if (tab === "staff"     && !staffLoaded) fetchStaff();
    if (tab === "locations") loadLocations();
  }

  function switchLocation(loc: string) {
    setActiveLoc(loc);
    setActiveTab("overview");
    setStats(null);
    setLogs([]); setLogsLoaded(false);
    setStaff([]); setStaffLoaded(false);
    loadStats(loc);
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", maxWidth: 340 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>Session Expired</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Your session has expired or you don't have access. Please sign in again.
          </p>
          <button
            onClick={() => { window.location.href = "/"; }}
            style={{ padding: "0.75rem 2rem", borderRadius: 10, background: "var(--brand)", color: "#080B10", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}
          >
            Go to Sign In
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",   label: "Overview"      },
    { id: "logs",       label: "Logs"          },
    { id: "staff",      label: "Staff"         },
    { id: "targets",    label: "Targets"       },
    { id: "notify",     label: "Notifications" },
    { id: "locations",  label: "Locations"     },
  ];

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg-base)" }}>
      {/* Header */}
      <header style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--bg-border)", padding: "0 1.25rem", height: "3.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--brand)", color: "#080B10", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>A</div>
          <div>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)", display: "block", lineHeight: 1.1 }}>AquaLog</span>
            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Golden Tulip Hotels</span>
          </div>
          <span style={{ fontSize: "0.65rem", fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: "rgba(239,68,68,.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,.3)" }}>
            Admin
          </span>

          {/* Location switcher */}
          {locations.length > 0 && (
            <div style={{ display: "flex", gap: "0.25rem", background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", borderRadius: 8, padding: "2px" }}>
              {locations.map(l => (
                <button
                  key={l.id}
                  onClick={() => switchLocation(l.id)}
                  style={{ fontSize: "0.7rem", fontWeight: activeLoc === l.id ? 600 : 400, padding: "3px 10px", borderRadius: 6, background: activeLoc === l.id ? "var(--brand)" : "transparent", color: activeLoc === l.id ? "#080B10" : "var(--text-muted)", border: "none", cursor: "pointer", transition: "all 150ms" }}
                >
                  {l.name.replace("Golden Tulip ", "")}
                </button>
              ))}
            </div>
          )}
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
            location={activeLoc}
          />
        )}
        {activeTab === "targets" && (
          <TargetsPanel
            loaded={true}
            onSaved={() => loadStats()}
            location={activeLoc}
            locationLabel={locations.find(l => l.id === activeLoc)?.name}
          />
        )}
        {activeTab === "notify" && (
          <NotificationsPanel location={activeLoc} />
        )}
        {activeTab === "locations" && (
          <LocationsPanel
            locations={locations}
            registryId={registryId}
            needsEnvVar={needsEnvVar}
            onCreated={() => { loadLocations(); }}
          />
        )}
      </main>
    </div>
  );
}
