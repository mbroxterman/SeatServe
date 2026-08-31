# SeatServe fixes - what's in this zip

## app/google-apps-script/Code.gs
**Requires a manual redeploy** (paste into Apps Script editor → Save → Deploy →
Manage deployments → Edit → New version → Deploy).

- Every action that touches Google Sheets (assign runner, auto-assign, SeatBeacon,
  order status, the live poll every screen runs every 1.5-3s) used to read and
  rewrite all 16 sheet tabs, even when only one order or runner changed. Now each
  action only touches the 1-4 tabs it actually needs. This is the fix for
  auto-assign being slow to fire, SeatBeacon being slow to notify the customer,
  and the thank-you screen being slow to appear after a delivery.
- Added a new `markRunnerAvailable` backend action. Previously, tapping "I'm back
  at the kitchen" only updated the runner's own phone locally and never told
  Google Sheets - so other screens could keep showing that runner as unavailable
  indefinitely. Now it's a real, immediate server action.
- Added a new `markPaymentCollected` backend action (see OrderTracking entry
  below for why).
- Bumped a leftover hardcoded `appVersion` string (written into the Google
  Sheet on a full sync) from v2.1.7E to v2.1.7J to match the admin UI label.
  Purely cosmetic - not shown anywhere in the app, no functional effect.
- The customer QR-scan bootstrap (`bootstrap_`) was the one endpoint left on
  the full 16-tab read from the very first round of fixes - it seemed lower
  priority at the time since it only fires once per customer, but it turned
  out to be the most likely real cause of the "Zone not found" errors on
  fresh scans (both at the venue and separately at home, on good connections)
  - it fires on every single new customer's first load, with someone standing
  there waiting, so it deserved the same treatment. It now only reads the
  9 tabs it actually needs (skips Runners, Orders, Customer Feedback,
  Activity, Archived Orders, Archived Feedback).

## app/src/services/persistence.ts
- Added `markRunnerAvailableLive()` to call the new backend action above.
- Added `markPaymentCollectedLive()` for the payment-button fix below.

## app/src/state/SeatServeContext.tsx
- `updateOrderStatus` now pushes the order status to Google Sheets immediately
  instead of waiting on the debounced background sync - makes delivered/
  delivering status changes show up faster on other devices.
- `markRunnerAvailable` now pushes the outcome (available, or reassigned to a
  queued order) to Google Sheets immediately, fixing the "runner stuck showing
  unavailable" bug.
- `markOrderPaymentCollected` (the "Confirm cash/card payment" button in Runner
  Mobile) now pushes to Google Sheets immediately. Before, it only updated the
  device locally, so the automatic status poll could momentarily overwrite that
  with the still-unconfirmed server copy - which is what caused the payment
  button to flicker/flash between "Confirm payment" and "Payment collected"
  right after tapping it.
- `markCustomerLocated` ("Customer Located" button) had the exact same gap and
  now pushes immediately too, using the existing SeatBeacon backend action.

## app/src/pages/customer/StableZoneEntry.tsx
- Fixed a race condition on the QR-scan landing page where, on a fresh phone/
  incognito session, a "zone not available" message could flash for a moment
  before correctly redirecting to the order screen.

## app/src/layouts/AdminLayout.tsx
- Bumped the version label shown in the admin sidebar/footer to v2.1.7J. (Cosmetic
  only - just a text label, doesn't track or verify anything.)

## app/src/pages/administration/KitchenOperations.tsx / .css
## app/src/layouts/KitchenLayout.css
- Compacted the Kitchen Operations dashboard to give the order board more room:
  - Shrank the top navy header bar.
  - Removed the "Administration / Kitchen Operations" title text (it was
    duplicating what's already shown in the navy bar above).
  - Live order counts (New/Preparing/Ready/Out for Delivery/Delivered) stay
    always visible in one slim row.
  - Load from Sheets / Keep Awake / Last updated now collapse behind a
    "Hide"/"More" toggle, since they're rarely touched mid-service. The
    collapsed/expanded state is remembered per device.

## app/src/pages/customer/OrderTracking.tsx / CustomerOrder.css
- Fixed a real bug: after a customer submitted their rating/feedback on the
  delivered/thank-you screen, the "Done" button was a link to "/" - and "/"
  redirects straight to your admin login. Customers were being sent toward
  the staff area. Also removed the same broken link from the rare "Order not
  found" screen.
- After submitting feedback, the screen now asks "Would you like to order
  again?" with an "Order Again" button that goes back to the same zone's
  ordering page (the same stable link the printed QR code uses), instead of
  a plain "Done" confirmation.

## app/src/pages/customer/StableZoneEntry.tsx (again) / persistence.ts
- Fixed the real cause of the intermittent "Zone not found... ask staff for the
  latest sign" message on slow venue wifi. The QR landing page had no timeout
  on its data fetch, and no way to tell "the server confirmed this zone
  doesn't exist" apart from "we simply couldn't reach the server." A slow or
  flaky connection was falling through to the same scary, misleading message
  as an actually-bad QR code. Now: the fetch times out after 15 seconds
  (matching the timeout already used elsewhere in the app), a failed/timed-out
  connection shows a "Trouble connecting - Try Again" screen with a retry
  button, and the "ask staff for the latest sign" message only ever appears
  when the server has actually confirmed the zone doesn't exist.
- Found a follow-up bug in that same fix: it was treating "the server responded
  with a real error" exactly the same as "we couldn't reach the server at
  all," both showing the generic "check your connection" message - which hid
  the actual error and made it hard to diagnose. Now a genuine server error
  message is shown on the Trouble connecting screen instead of being masked.
- **The real root cause, finally confirmed**: the QR code you're actually
  testing with (`/order/{eventId}/{venueId}/{zoneId}`) does NOT go through
  StableZoneEntry at all - it lands directly on a different page,
  CustomerOrder.tsx, which had ZERO mechanism to load venue/menu data for a
  brand-new visitor. A fresh session starts with the app's built-in demo
  data (not your real venues), and the only background sync that runs for
  this page only ever refreshes orders/runners/events - never venues or
  menus - so the error never self-corrected, on any browser or device. This
  is why it kept failing consistently regardless of the Safari-specific
  fixes above: those were all correctly fixing StableZoneEntry, a different
  page than the one actually being tested. Added the same hardened bootstrap
  (with retries and an honest "Trouble connecting" state) directly to
  CustomerOrder.tsx as a fallback for anyone landing there directly. Also
  fixed the same broken "Return to SeatServe" link (pointed at the admin
  login) that OrderTracking.tsx had.
- Worth strongly considering going forward: printed QR codes that use the
  stable `/order/zone/{venueId}/{zoneId}` link (Venue & Zones page has a
  copy/open button for this) don't need reprinting between events, since
  they look up whichever event is currently live automatically. The
  `/order/{eventId}/...` link that's currently printed bakes in a specific
  event and will need a new QR code for your next event either way.
- Tested the bootstrap endpoint directly and confirmed the backend itself
  returns clean, complete, correct data - the earlier failures were most
  likely caused by the 15-second timeout I added being too tight for Google
  Apps Script's own "cold start" behavior (the first request after a period
  of inactivity can occasionally take longer than that, then respond quickly
  once warm - which matches "closing and rescanning worked" exactly). The QR
  landing page now silently retries once automatically before ever showing an
  error to the customer, instead of requiring them to notice and retry
  manually.
- Found the likely actual root cause via the exact error text ("Load failed"):
  a documented Safari/iOS 18 bug (developer.apple.com/forums/thread/771127)
  where a fetch fired immediately when a page becomes visible - exactly what
  happens right after scanning a QR code - can fail after 20-40 seconds with
  that exact error, even though the server is completely fine. Added a short
  (250ms) delay before the QR landing page's first data request, which is
  Apple's own documented workaround for this bug.
- Tested again on the same iPad (Chrome for iOS - which, like Safari, is
  WebKit under the hood on iOS, so it's subject to the same bug) with that
  fix deployed, and it still failed with the same "Load failed" error -
  250ms clearly wasn't enough margin, since the exact safe timing window
  for this bug isn't documented precisely. Replaced the single 250ms delay
  with up to 3 total attempts, each waiting longer than the last (400ms,
  1300ms, 2200ms), to give much better odds of getting past whatever
  WebKit networking window causes this.
- Correction to an earlier note in this log: I'd flagged the direct
  /order/{eventId}/{venueId}/{zoneId} link as coming from the Dashboard's
  "Preview ordering" button. Looking at the actual printed QR PDFs, the real
  QR codes correctly use the stable /order/zone/{venue-slug}/{zone-slug}?w=...
  format - what I was shown as "the link the QR code opens" was actually the
  URL after StableZoneEntry's redirect, not the original scanned link. No
  QR reprinting needed after all.
- Found and fixed a real, separate bug while checking this: StableZoneEntry's
  redirect to the order page was dropping the ?w= workspace query parameter
  entirely, so CustomerOrder.tsx's workspace-switch logic never got a chance
  to run for anyone arriving via a QR code. The redirect now carries the full
  query string through. Likely low-impact on this specific deployment (it has
  a fallback workspace baked in via Netlify env vars), but worth fixing for
  correctness.
- Confirmed via a direct raw-URL test on the same iPad (typed straight into
  Safari's address bar, not through the app) that the backend and that
  device's basic network connectivity are both completely fine - the failure
  is specific to fetch() calls made from JavaScript, which matches other
  independent reports of this bug describing it as a genuinely random,
  intermittent Safari 18+ issue rather than a narrow timing window. Increased
  retries from 3 total attempts to 5, since more attempts meaningfully
  improve the odds against a random failure rate. This is a real bug in
  Safari itself, not something fixable with certainty from the app side -
  if it keeps recurring on one specific device, a full device restart (not
  just clearing Safari history) is worth trying, since it can clear a stuck
  WebKit networking state.

