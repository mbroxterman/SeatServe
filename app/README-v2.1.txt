SeatServe v2.1 - Pilot Candidate

This release is the locked pilot candidate. It adds reliability and recovery only; no new top-level features or architecture changes.

Pilot hardening included:
- Friendly route-level error recovery instead of React Router's raw error screen.
- Defensive migration for incomplete/older saved workspace data so missing arrays do not blank the app.
- Safe workspace switching that immediately loads the selected workspace instead of carrying the prior workspace data forward.
- Google Sheets background polling now restarts when the workspace/connection changes.
- Background polling no longer overwrites unsynced local changes.
- Background polling no longer creates a rolling backup every four seconds; backups are created only before an actual remote data update.
- Existing cross-tab live status, SeatBeacon, payment-at-delivery, Kitchen Operations, Runner Mobile, Reports, and Administration workflows are preserved.
- Administration version standardized to v2.1.

Pilot rule: no new features after this release. Only fix defects found in end-to-end testing.
