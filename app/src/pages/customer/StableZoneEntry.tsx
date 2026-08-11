import { Navigate, useParams } from "react-router-dom";
import { useSeatServe } from "../../state/SeatServeContext";

export default function StableZoneEntry() {
  const { venueId = "", zoneId = "" } = useParams();
  const { data, activeEvent } = useSeatServe();
  const venue = data.venues.find((item) => item.id === venueId);
  const zone = venue?.zones.find((item) => item.id === zoneId && item.active && item.deliveryEnabled);
  const event = activeEvent?.venueId === venueId && activeEvent.orderingEnabled
    ? activeEvent
    : data.events.find((item) => item.venueId === venueId && item.status === "live" && item.orderingEnabled);

  if (event && venue && zone) {
    return <Navigate to={`/order/${event.id}/${venue.id}/${zone.id}`} replace />;
  }

  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f4f7fb",padding:24,fontFamily:"Inter,system-ui,sans-serif"}}>
      <section style={{width:"min(520px,100%)",background:"white",border:"1px solid #dce3ef",borderRadius:18,padding:28,textAlign:"center",boxShadow:"0 18px 45px rgba(18,35,74,.10)"}}>
        <img src="/seatserve-web-logo.png" alt="SeatServe" style={{width:"min(330px,85%)",height:88,objectFit:"contain"}} />
        <h1 style={{color:"#101d45",margin:"18px 0 8px"}}>Ordering is not open yet</h1>
        <p style={{color:"#66738f",lineHeight:1.55,margin:0}}>
          This QR code is valid for {zone?.name ?? "this delivery zone"}, but there is no live event currently accepting orders here. Please try again when concessions open.
        </p>
      </section>
    </main>
  );
}
