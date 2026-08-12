import { Download, ExternalLink, FileDown, MapPin, Printer, QrCode, ShieldCheck, ShoppingBag, UsersRound } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSeatServe } from "../../state/SeatServeContext";
import "./CustomerExperience.css";

type QrEntry = { id:string; kind:"staff"|"zone"; title:string; subtitle:string; url:string; filename:string; venueName?:string };
const slug=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"location";
const safeFile=slug;
const escapeHtml=(value:string)=>value.replace(/[&<>'"]/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[char]??char));
const dataUrlBytes=(url:string)=>Uint8Array.from(atob(url.split(",")[1]),c=>c.charCodeAt(0));
const ascii=(value:string)=>new TextEncoder().encode(value);
const join=(parts:Uint8Array[])=>{const size=parts.reduce((sum,p)=>sum+p.length,0);const out=new Uint8Array(size);let at=0;parts.forEach(p=>{out.set(p,at);at+=p.length});return out};

function pdfFromJpegs(jpegs:string[]) {
  const objects:Uint8Array[]=[];
  const pageIds=jpegs.map((_,i)=>5+i*3);
  objects[1]=ascii("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2]=ascii(`<< /Type /Pages /Count ${jpegs.length} /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] >>`);
  jpegs.forEach((jpeg,i)=>{
    const imageId=3+i*3, contentId=4+i*3, pageId=5+i*3;
    const bytes=dataUrlBytes(jpeg);
    objects[imageId]=join([ascii(`<< /Type /XObject /Subtype /Image /Width 1275 /Height 1650 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`),bytes,ascii("\nendstream")]);
    const stream="q 612 0 0 792 0 0 cm /Im0 Do Q";
    objects[contentId]=ascii(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    objects[pageId]=ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  });
  const chunks=[ascii("%PDF-1.4\n%SeatServe\n")]; const offsets:number[]=[0]; let offset=chunks[0].length;
  for(let id=1;id<objects.length;id++){const body=objects[id]; if(!body) continue; offsets[id]=offset; const chunk=join([ascii(`${id} 0 obj\n`),body,ascii("\nendobj\n")]); chunks.push(chunk); offset+=chunk.length;}
  const xrefAt=offset; let xref=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for(let id=1;id<objects.length;id++) xref+=`${String(offsets[id]??0).padStart(10,"0")} 00000 n \n`;
  xref+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  chunks.push(ascii(xref)); return new Blob([join(chunks)],{type:"application/pdf"});
}

async function renderLetterPage(entry:QrEntry, qrImage:string, origin:string) {
  const canvas=document.createElement("canvas"); canvas.width=1275; canvas.height=1650; const ctx=canvas.getContext("2d")!;
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle="#071a3d"; ctx.fillRect(0,0,canvas.width,165);
  const logo=new Image(); logo.crossOrigin="anonymous"; logo.src=`${origin}/seatserve-web-logo.png`; await new Promise<void>((resolve)=>{logo.onload=()=>resolve();logo.onerror=()=>resolve();});
  if (logo.complete && logo.naturalWidth) {
    const maxLogoWidth = 865;
    const maxLogoHeight = 125;
    const scale = Math.min(maxLogoWidth / logo.naturalWidth, maxLogoHeight / logo.naturalHeight);
    const logoWidth = logo.naturalWidth * scale;
    const logoHeight = logo.naturalHeight * scale;
    ctx.drawImage(logo, (1275 - logoWidth) / 2, 18 + (maxLogoHeight - logoHeight) / 2, logoWidth, logoHeight);
  }
  ctx.textAlign="center"; ctx.fillStyle="#071a3d"; ctx.font="bold 74px Arial"; ctx.fillText(entry.title,637,285);
  ctx.font="bold 30px Arial"; ctx.fillStyle=entry.kind==="staff"?"#b91c1c":"#334155"; ctx.fillText(entry.kind==="staff"?"STAFF ONLY":"SCAN TO ORDER CONCESSIONS",637,350);
  ctx.font="28px Arial"; ctx.fillStyle="#475569"; ctx.fillText(entry.subtitle,637,405);
  const qr=new Image(); qr.src=qrImage; await new Promise<void>(resolve=>{qr.onload=()=>resolve();qr.onerror=()=>resolve();});
  ctx.drawImage(qr,237,480,800,800);
  ctx.font="bold 30px Arial"; ctx.fillStyle="#071a3d"; ctx.fillText(entry.kind==="staff"?"Scan for SeatServe Staff Access":"Open your camera and scan the code above",637,1375);
  ctx.font="20px Arial"; ctx.fillStyle="#64748b"; const shown=entry.url.length>95?entry.url.slice(0,92)+"…":entry.url; ctx.fillText(shown,637,1440);
  ctx.font="18px Arial"; ctx.fillText("SeatServe · Mill Valley High School",637,1535);
  return canvas.toDataURL("image/jpeg",0.92);
}

export default function CustomerExperience(){
  const {data,activeEvent}=useSeatServe(); const [qrImages,setQrImages]=useState<Record<string,string>>({}); const [busy,setBusy]=useState(false); const origin=window.location.origin;
  const activeVenue=data.venues.find(item=>item.id===activeEvent?.venueId);
  const entries=useMemo<QrEntry[]>(()=>{
    const staff:QrEntry={id:"staff",kind:"staff",title:"SeatServe Staff",subtitle:"Kitchen · Runner · Administration",url:`${origin}/staff`,filename:"seatserve-staff-qr.png"};
    const zones=data.venues.filter(v=>v.active).flatMap(v=>v.zones.filter(z=>z.active&&z.deliveryEnabled).map(z=>({id:`zone-${v.id}-${z.id}`,kind:"zone" as const,title:z.name,subtitle:v.name,url:`${origin}/order/zone/${slug(v.name)}/${slug(z.name)}`,filename:`seatserve-${safeFile(v.name)}-${safeFile(z.name)}-qr.png`,venueName:v.name})));
    return [staff,...zones];
  },[data.venues,origin]);
  useEffect(()=>{let cancelled=false;Promise.all(entries.map(async e=>[e.id,await QRCode.toDataURL(e.url,{width:900,margin:2,errorCorrectionLevel:"M",color:{dark:"#071a3d",light:"#ffffff"}})] as const)).then(p=>!cancelled&&setQrImages(Object.fromEntries(p))).catch(()=>!cancelled&&setQrImages({}));return()=>{cancelled=true}},[entries]);

  const printEntries=(selected:QrEntry[])=>{const printable=selected.filter(e=>qrImages[e.id]);if(!printable.length)return;const popup=window.open("","_blank");if(!popup)return;const pages=printable.map(e=>`<section class="page"><img class="logo" src="${origin}/seatserve-web-logo.png"><h1>${escapeHtml(e.title)}</h1><h2>${e.kind==="staff"?"STAFF ONLY":"SCAN TO ORDER CONCESSIONS"}</h2><p>${escapeHtml(e.subtitle)}</p><img class="qr" src="${qrImages[e.id]}"><strong>${e.kind==="staff"?"Scan for SeatServe Staff Access":"Open your camera and scan the code above"}</strong><small>${escapeHtml(e.url)}</small></section>`).join("");popup.document.write(`<!doctype html><html><head><title>SeatServe QR Signs</title><style>@page{size:letter portrait;margin:.35in}*{box-sizing:border-box}body{margin:0;font-family:Arial;color:#071a3d}.page{height:10.3in;page-break-after:always;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:.15in}.page:last-child{page-break-after:auto}.logo{width:7.1in;height:1in;object-fit:contain;background:#071a3d;border-radius:14px;padding:8px}h1{font-size:48px;margin:.22in 0 .08in}h2{font-size:21px;letter-spacing:.12em;margin:.02in 0;color:#334155}.qr{width:6.25in;height:6.25in;object-fit:contain;margin:.18in 0}.page>strong{font-size:20px}.page>p{margin:.06in 0;color:#475569;font-size:18px}.page>small{margin-top:.18in;color:#64748b;word-break:break-all;font-size:10px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${pages}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));<\/script></body></html>`);popup.document.close();};
  const exportPdf=async(selected:QrEntry[])=>{const printable=selected.filter(e=>qrImages[e.id]);if(!printable.length)return;setBusy(true);try{const pages=[];for(const e of printable)pages.push(await renderLetterPage(e,qrImages[e.id],origin));const blob=pdfFromJpegs(pages);const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=printable.length===1?printable[0].filename.replace(/\.png$/i,".pdf"):"seatserve-qr-signs.pdf";a.click();URL.revokeObjectURL(url);}finally{setBusy(false)}};
  const staffEntry=entries[0], zoneEntries=entries.slice(1); const byVenue=data.venues.filter(v=>v.active).map(venue=>({venue,entries:zoneEntries.filter(e=>e.venueName===venue.name)})).filter(g=>g.entries.length);
  return <section className="customer-experience-page"><div className="customer-experience-heading"><div><p className="eyebrow">Pilot QR generator</p><h2>Print-ready staff &amp; customer QR signs</h2><p>Each QR prints on its own 8.5×11 page with the current location name and SeatServe branding.</p></div><div className="customer-experience-heading__actions"><button className="secondary-button is-button" onClick={()=>printEntries(entries)}><Printer size={17}/> Print all</button><button className="secondary-button is-button" disabled={busy} onClick={()=>exportPdf(entries)}><FileDown size={17}/> {busy?"Building PDF…":"Export all PDF"}</button><Link className="secondary-button" to="/admin/venues">Manage Venue &amp; Zones</Link></div></div>
    <section className="customer-experience-summary"><div className="customer-experience-icon"><ShoppingBag size={24}/></div><div><span>Current live event</span><h3>{activeEvent?`${activeEvent.name} vs ${activeEvent.opponent}`:"No live event"}</h3><p>{activeVenue?.name??"QR signs remain reusable across events"} · Ordering {activeEvent?.orderingEnabled?"open":"closed"}</p></div></section>
    <section className="customer-experience-panel qr-staff-panel"><div className="customer-experience-panel__heading"><div><p className="eyebrow">Staff QR</p><h3>Single staff entry sign</h3></div><span><ShieldCheck size={15}/> PIN protected</span></div><QrCard entry={staffEntry} image={qrImages[staffEntry.id]} onPrint={()=>printEntries([staffEntry])} onPdf={()=>exportPdf([staffEntry])}/></section>
    <section className="customer-experience-panel"><div className="customer-experience-panel__heading"><div><p className="eyebrow">Customer zone QR codes</p><h3>Readable location links</h3></div><span>{zoneEntries.length} active zones</span></div>{byVenue.length?byVenue.map(({venue,entries:venueEntries})=><section className="qr-venue-group" key={venue.id}><div className="qr-venue-group__heading"><div><MapPin size={18}/><strong>{venue.name}</strong><span>{venueEntries.length} zones</span></div><div><button onClick={()=>printEntries(venueEntries)}><Printer size={15}/> Print venue</button><button onClick={()=>exportPdf(venueEntries)}><FileDown size={15}/> PDF</button></div></div><div className="customer-zone-grid">{venueEntries.map(e=><QrCard key={e.id} entry={e} image={qrImages[e.id]} onPrint={()=>printEntries([e])} onPdf={()=>exportPdf([e])} compact/>)}</div></section>):<div className="customer-experience-empty"><QrCode size={30}/><h3>No customer zone QR codes available</h3><p>Add an active venue and at least one delivery-enabled zone.</p></div>}</section>
    <section className="qr-pilot-note"><UsersRound size={20}/><div><strong>Readable links update when names change.</strong><p>Regenerate signs after renaming a venue or zone. The printed title and URL will use the latest workspace names.</p></div></section></section>;
}
function QrCard({entry,image,onPrint,onPdf,compact=false}:{entry:QrEntry;image?:string;onPrint:()=>void;onPdf:()=>void;compact?:boolean}){const copy=async()=>navigator.clipboard.writeText(entry.url);return <article className={`customer-zone-card qr-generator-card ${entry.kind==="staff"?"is-staff":""} ${compact?"is-compact":""}`}><div className="qr-generator-card__preview">{image?<img src={image} alt={`${entry.title} QR code`}/>:<QrCode size={42}/>}</div><div className="customer-zone-card__copy"><h4>{entry.title}</h4><p>{entry.kind==="staff"?<ShieldCheck size={14}/>:<MapPin size={14}/>} {entry.subtitle}</p><small>{entry.url}</small></div><div className="qr-generator-card__actions"><a href={entry.url} target="_blank" rel="noreferrer"><ExternalLink size={16}/> Test</a><button onClick={copy}>Copy link</button>{image&&<a href={image} download={entry.filename}><Download size={16}/> PNG</a>}<button onClick={onPdf}><FileDown size={16}/> PDF</button><button onClick={onPrint}><Printer size={16}/> Print</button></div></article>}
