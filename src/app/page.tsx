"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function HomePage() {
  const router = useRouter();
  const error  = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("error")
    : null;

  // If user already has a valid session with a role, send them home
  useEffect(() => {
    fetch("/api/auth/me").then(r => {
      if (!r.ok) return;
      r.json().then((u: { role?: string }) => {
        if (u.role === "admin")  router.replace("/admin");
        if (u.role === "logger") router.replace("/log");
      });
    });
  }, [router]);

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg-base)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <ThemeToggle />

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg, #00D4AA 0%, #00A880 100%)", margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 32px rgba(0,212,170,0.25)" }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 4C16 4 8 14 8 19.5C8 24.2 11.6 28 16 28C20.4 28 24 24.2 24 19.5C24 14 16 4 16 4Z" fill="#080B10" fillOpacity="0.9"/>
            <rect x="19" y="6" width="3" height="12" rx="1.5" fill="#080B10" fillOpacity="0.6"/>
            <circle cx="20.5" cy="20" r="2.5" fill="#080B10" fillOpacity="0.6"/>
          </svg>
        </div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.3rem" }}>AquaLog</h1>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Golden Tulip Hotels · Utility Logging</p>
      </div>

      <div style={{ width: "100%", maxWidth: 360 }}>
        {error && (
          <div style={{ background: "var(--danger-dim)", border: "1px solid var(--danger)", borderRadius: 10, padding: "0.75rem 1rem", fontSize: "0.8rem", color: "var(--danger)", marginBottom: "1rem", textAlign: "center" }}>
            {error === "auth_failed" ? "Sign-in failed. Please try again." : "Something went wrong. Please try again."}
          </div>
        )}

        <div className="card" style={{ padding: "1.75rem" }}>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1.5rem", lineHeight: 1.6, textAlign: "center" }}>
            Sign in with your Google account to access your dashboard.
          </p>
          <button
            onClick={() => { window.location.href = "/api/auth/google"; }}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", padding: "0.9rem", borderRadius: 10, background: "var(--bg-elevated)", border: "1.5px solid var(--bg-border)", color: "var(--text-primary)", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer" }}
          >
            <GoogleIcon /> Sign in with Google
          </button>
        </div>

        <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.7rem", color: "var(--text-muted)" }}>
          AquaLog · Golden Tulip Hotels &amp; Resorts
        </p>
      </div>
    </div>
  );
}
