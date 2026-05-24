# AquaLog Roadmap

Hotel utility logging PWA — Golden Tulip Lekki (and future locations).

---

## Shipped (v1)

- [x] Google OAuth admin sign-in — sheet created automatically, owned by admin's Google account
- [x] Email-based logger authorization per hotel location (Staff tab in the sheet)
- [x] Water meter logging (meter point, reading, unit)
- [x] Temperature logging with auto status (OK / WARN / DANGER) per area limits
- [x] Admin dashboard — Overview stats, Logs table, Staff management, Targets
- [x] Operational targets with progress bars (water limit, compliance rate, checks per area)
- [x] 7-day temperature compliance trend chart
- [x] CSV export from admin log view
- [x] PWA manifest — install to home screen on iOS/Android
- [x] Dark/light theme toggle

---

## Near-term (v1.x)

### Reporting & Interpretation

- [ ] **Daily summary PDF** — auto-generated each day at close: water totals, temp compliance, loggers on duty, any WARN/DANGER events with timestamps. Attached to a Telegram message or emailed to the admin.
- [ ] **Weekly digest email** — Sunday evening summary: 7-day compliance trend, top readings, missed check areas, loggers ranked by activity.
- [ ] **Monthly compliance report** — full PDF with charts: water trend vs. target, temp heatmap by area, staff coverage calendar.
- [ ] **Automatic interpretation** — next to each stat, a plain-English note: "Pool temp was out of range 3× this week — check heating system" or "Water usage 12% above target — investigate main meter."

### Alerts

- [ ] **Real-time Telegram alerts** — push to admin's Telegram when a DANGER reading is logged (currently only visible on next dashboard load).
- [ ] **Missed-check alert** — if an area hasn't been logged by X time each day, send a reminder to the duty manager.
- [ ] **Water spike alert** — if a reading is >20% above the 7-day average, flag immediately.

### Logger experience

- [ ] **Logger history** — a read-only view for each logger to see their own submissions from the current shift.
- [ ] **Offline support** — service worker queues submissions when offline, syncs when reconnected (critical for pool areas with poor signal).
- [ ] **Photo attachment** — attach a photo to a reading (stored in Google Drive, linked from the sheet).

---

## Medium-term (v2)

### Multi-location support

- [ ] **Location picker on login** — loggers select their hotel from a dropdown; they are validated only against that hotel's authorized staff list.
- [ ] **Per-location sheets** — each hotel gets its own Google Sheet, owned by that property's admin.
- [ ] **Central admin view** — a super-admin account can see aggregated stats across all locations.
- [ ] **Location-aware targets** — each hotel sets its own water/temp targets independently.

### Advanced analytics

- [ ] **Area heatmap** — which areas are most frequently out of range, by day-of-week and hour.
- [ ] **Logger performance dashboard** — checks completed vs. scheduled per staff member, streak tracking.
- [ ] **Anomaly detection** — statistical baseline per area (mean ± 2σ); flag readings that break the baseline even if within the fixed min/max.
- [ ] **Predictive maintenance signals** — if a sensor area shows gradual drift over 7 days, flag it before it becomes a DANGER reading.

### Compliance & audit

- [ ] **Tamper-evident log** — hash each row on write; export a signed audit trail for health inspections.
- [ ] **HACCP checklist integration** — pre-structured daily checklist tied to local food safety regulations.
- [ ] **Regulator export** — one-click export in the format required by Lagos State health authorities.

---

## Long-term / Paid tier

- [ ] **Intraday logging** — shift-based logging with scheduled check reminders (e.g., every 2 hours during kitchen service).
- [ ] **IoT sensor integration** — receive automated readings from temperature probes via MQTT/webhook, reducing manual entry.
- [ ] **White-label deployment** — branded version per hotel group (custom domain, logo, colour scheme).
- [ ] **Subscription management** — hotel admins subscribe via Stripe; access gated behind active subscription.

---

## Notes for developers

- All logs are stored in Google Sheets (no database). The sheet structure must remain backward-compatible across versions — add columns only to the right.
- Logger auth uses the service account (env var `GOOGLE_SERVICE_ACCOUNT_KEY`). Admin auth uses Google OAuth stored in an HTTP-only cookie.
- To add a new hotel location: the admin for that location signs in with Google OAuth and a new sheet is created automatically.
- The `LOCATION` constant in `src/lib/config.ts` is currently hardcoded to `"Golden Tulip Lekki"`. For multi-location support this must become dynamic (read from session or URL param).
