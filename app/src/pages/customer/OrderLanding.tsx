import { HelpCircle, QrCode, ShoppingBag } from "lucide-react";
import { useSeatServe } from "../../state/SeatServeContext";

export default function OrderLanding() {
  const { data, activeEvent } = useSeatServe();
  const venue = activeEvent ? data.venues.find((item) => item.id === activeEvent.venueId) : undefined;

  return (
    <main style={{ minHeight: "100vh", background: "#f4f7fb", fontFamily: "Inter, system-ui, sans-serif" }}>
      <header style={{ background: "#081a3a", minHeight: 116, display: "grid", placeItems: "center", padding: "12px 20px", boxShadow: "0 8px 28px rgba(9, 26, 58, .18)" }}>
        <img
          src="/seatserve-web-logo.png"
          alt="SeatServe"
          style={{ width: "min(470px, 86vw)", height: 92, objectFit: "contain" }}
        />
      </header>

      <section style={{ width: "min(620px, calc(100% - 32px))", margin: "42px auto", background: "white", border: "1px solid #dce3ef", borderRadius: 22, padding: "34px 28px", textAlign: "center", boxShadow: "0 18px 48px rgba(18,35,74,.10)" }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: "#eaf1ff", color: "#173f8f", display: "grid", placeItems: "center", margin: "0 auto 18px" }}>
          <QrCode size={38} strokeWidth={2.1} />
        </div>
        <h1 style={{ color: "#101d45", fontSize: "clamp(28px, 6vw, 40px)", lineHeight: 1.08, margin: "0 0 12px" }}>Scan a SeatServe QR Code</h1>
        <p style={{ color: "#66738f", fontSize: 17, lineHeight: 1.6, margin: "0 auto", maxWidth: 500 }}>
          To place an order, scan the SeatServe QR code located in your seating zone. Your zone will be selected automatically so your runner knows where to deliver your order.
        </p>

        {activeEvent ? (
          <div style={{ marginTop: 28, padding: 20, borderRadius: 16, background: "#f7f9fd", border: "1px solid #e1e7f0", textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#173f8f", fontWeight: 800, marginBottom: 8 }}>
              <ShoppingBag size={20} /> Current event
            </div>
            <div style={{ color: "#101d45", fontWeight: 800, fontSize: 18 }}>{activeEvent.name}</div>
            {activeEvent.opponent ? <div style={{ color: "#66738f", marginTop: 4 }}>vs. {activeEvent.opponent}</div> : null}
            {venue ? <div style={{ color: "#66738f", marginTop: 4 }}>{venue.name}</div> : null}
            {!activeEvent.orderingEnabled ? (
              <div style={{ marginTop: 10, color: "#9a5b00", fontWeight: 700 }}>Concession ordering is currently closed.</div>
            ) : null}
          </div>
        ) : (
          <div style={{ marginTop: 28, padding: 18, borderRadius: 16, background: "#f7f9fd", border: "1px solid #e1e7f0", color: "#66738f" }}>
            There is no live SeatServe event right now.
          </div>
        )}

        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 24, paddingTop: 22, borderTop: "1px solid #e5eaf2", color: "#66738f", textAlign: "left", lineHeight: 1.5 }}>
          <HelpCircle size={20} style={{ flex: "0 0 auto", marginTop: 2 }} />
          <span>Need help? Look for the SeatServe QR sign in your zone or ask a concession staff member for assistance.</span>
        </div>
      </section>
    </main>
  );
}
