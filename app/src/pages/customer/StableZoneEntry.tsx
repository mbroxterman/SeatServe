import { useEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useSeatServe } from "../../state/SeatServeContext";
import { loadCustomerBootstrap } from "../../services/persistence";

const slug=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"location";

export default function StableZoneEntry(){
  const {venueId="",zoneId=""}=useParams(); const {data,activeEvent,replaceData}=useSeatServe();
  const [loading,setLoading]=useState(true);
  const [connectionFailed,setConnectionFailed]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const [errorMessage,setErrorMessage]=useState<string|null>(null);
  const autoRetriedRef=useRef(false);
  useEffect(()=>{
    let alive=true;
    setLoading(true);
    setConnectionFailed(false);
    setErrorMessage(null);
    loadCustomerBootstrap().then(result=>{
      if(!alive) return;
      if(result.ok&&result.data){ replaceData({ ...data, ...result.data }, "Customer QR cloud bootstrap"); setLoading(false); return; }
      // A clean ok:false response can also be a transient Apps Script/Sheets
      // hiccup rather than a genuine failure, so give it the same one silent
      // retry before showing anything to the customer.
      if(!autoRetriedRef.current){ autoRetriedRef.current=true; setAttempt((value)=>value+1); return; }
      setConnectionFailed(true); setErrorMessage(result.message ?? null); setLoading(false);
    }).catch((error)=>{
      if(!alive) return;
      // Apps Script cold starts can occasionally take longer than the timeout on
      // the very first request after a period of inactivity, then respond
      // quickly once warm. Silently retry once before bothering the customer
      // with an error - this is what "closing and rescanning worked" was
      // really doing manually, so do it automatically instead.
      if(!autoRetriedRef.current){ autoRetriedRef.current=true; setAttempt((value)=>value+1); return; }
      setConnectionFailed(true);
      setErrorMessage(error instanceof Error ? error.message : null);
      setLoading(false);
    });
    return()=>{alive=false};
  },[attempt]);
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
  // A failed/timed-out connection is not the same thing as the server telling us
  // this zone genuinely doesn't exist - show a retry screen instead of the
  // "ask staff for the latest QR sign" message, which wrongly implies the QR
  // code itself is the problem when it's really just a network hiccup.
  if(connectionFailed && !(venue&&zone)) return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f4f7fb",padding:24,fontFamily:"Inter,system-ui,sans-serif"}}><section style={{width:"min(520px,100%)",background:"white",border:"1px solid #dce3ef",borderRadius:18,padding:28,textAlign:"center",boxShadow:"0 18px 45px rgba(18,35,74,.10)"}}><img src="/seatserve-web-logo.png" alt="SeatServe" style={{width:"min(330px,85%)",height:88,objectFit:"contain"}}/><h1 style={{color:"#101d45",margin:"18px 0 8px"}}>Trouble connecting</h1><p style={{color:"#66738f",lineHeight:1.55,margin:"0 0 20px"}}>{errorMessage ?? "We could not reach SeatServe. Check your connection and try again."}</p><button type="button" onClick={()=>{autoRetriedRef.current=false;setAttempt((value)=>value+1);}} style={{background:"#101d45",color:"#fff",border:0,borderRadius:12,padding:"12px 24px",fontWeight:700,fontSize:15,cursor:"pointer"}}>Try Again</button></section></main>;
  const title=!venue?"Venue not found":!zone?"Zone not found":"Ordering is not open yet";
  const message=!venue?"This QR code does not match a current SeatServe venue. Ask staff for the latest QR sign.":!zone?"This QR code does not match a current active delivery zone. Ask staff for the latest QR sign.":`This QR code is valid for ${zone.name}, but there is no live event currently accepting orders here. Please try again when concessions open.`;
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f4f7fb",padding:24,fontFamily:"Inter,system-ui,sans-serif"}}><section style={{width:"min(520px,100%)",background:"white",border:"1px solid #dce3ef",borderRadius:18,padding:28,textAlign:"center",boxShadow:"0 18px 45px rgba(18,35,74,.10)"}}><img src="/seatserve-web-logo.png" alt="SeatServe" style={{width:"min(330px,85%)",height:88,objectFit:"contain"}}/><h1 style={{color:"#101d45",margin:"18px 0 8px"}}>{title}</h1><p style={{color:"#66738f",lineHeight:1.55,margin:0}}>{message}</p></section></main>;
}
