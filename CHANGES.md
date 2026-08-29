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

