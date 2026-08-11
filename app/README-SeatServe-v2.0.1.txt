SeatServe v2.0.1 - Live Status and SeatBeacon Transition

Changes:
- Order status changes now propagate automatically between open SeatServe tabs/windows on the same browser using BroadcastChannel and storage events.
- Customer tracking refreshes automatically when the tab regains focus or becomes visible.
- Connected Google Sheets workspaces poll for remote changes every 4 seconds while visible.
- SeatBeacon closes automatically when an order becomes Delivered.
- The delivered thank-you and satisfaction screen appears immediately after the status update.

Important deployment note:
Cross-device live updates require every device to use the same connected Google Apps Script workspace endpoint (or a production realtime backend). Same-browser tabs work without Google Sheets.
