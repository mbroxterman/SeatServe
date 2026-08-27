import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useSeatServe } from "../../state/SeatServeContext";
import { loadCustomerBootstrap } from "../../services/persistence";

const slug=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"location";

export default function StableZoneEntry(){
  const {venueId="",zoneId=""}=useParams(); const {data,activeEvent,replaceData}=useSeatServe(); const [loading,setLoading]=useState(true);
  useEffect(()=>{ let alive=true; loadCustomerBootstrap().then(result=>{ if(!alive) return; if(result.ok&&result.data) replaceData({ ...data, ...result.data }, "Customer QR cloud bootstrap"); if(alive) setLoading(false); }).catch(()=>{ if(alive) setLoading(false); }); return()=>{alive=false}; },[]);
  const venue=data.venues.find(item=>item.id===venueId||slug(item.name)===venueId);
  const zone=venue?.zones.find(item=>(item.id===zoneId||slug(item.name)===zoneId)&&item.active&&item.deliveryEnabled);
  const event=venue ? (activeEvent?.venueId===venue.id&&activeEvent.orderingEnabled?activeEvent:data.events.find(item=>item.venueId===venue.id&&item.status==="live"&&item.orderingEnabled)) : undefined;
  // Always try the redirect first - this keeps repeat visits on the same device
  // instant when the venue/zone/event are already known locally, before the
  // cloud fetch even finishes. Only fall through to the "not found"/"not open"
  // messages once loading has definitively finished; otherwise a customer can
  // briefly see a scary "zone not available" message during the split second
  // where the venue/zone have loaded but the live event hasn't been confirmed
  // yet, right before the page redirects them correctly anyway.
  if(event&&venue&&zone) return <Navigate to={`/order/${event.id}/${venue.id}/${zone.id}`} replace/>;
  if(loading) return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",fontFamily:"Inter,system-ui,sans-serif"}}><h2>Loading SeatServe location…</h2></main>;
  const title=!venue?"Venue not found":!zone?"Zone not found":"Ordering is not open yet";
  const message=!venue?"This QR code does not match a current SeatServe venue. Ask staff for the latest QR sign.":!zone?"This QR code does not match a current active delivery zone. Ask staff for the latest QR sign.":`This QR code is valid for ${zone.name}, but there is no live event currently accepting orders here. Please try again when concessions open.`;
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f4f7fb",padding:24,fontFamily:"Inter,system-ui,sans-serif"}}><section style={{width:"min(520px,100%)",background:"white",border:"1px solid #dce3ef",borderRadius:18,padding:28,textAlign:"center",boxShadow:"0 18px 45px rgba(18,35,74,.10)"}}><img src="/seatserve-web-logo.png" alt="SeatServe" style={{width:"min(330px,85%)",height:88,objectFit:"contain"}}/><h1 style={{color:"#101d45",margin:"18px 0 8px"}}>{title}</h1><p style={{color:"#66738f",lineHeight:1.55,margin:0}}>{message}</p></section></main>;
}
