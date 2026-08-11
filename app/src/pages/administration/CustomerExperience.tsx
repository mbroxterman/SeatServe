import { Download, ExternalLink, MapPin, Printer, QrCode, ShieldCheck, ShoppingBag, UsersRound } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSeatServe } from "../../state/SeatServeContext";
import "./CustomerExperience.css";

type QrEntry = {
  id: string;
  kind: "staff" | "zone";
  title: string;
  subtitle: string;
  url: string;
  filename: string;
  venueName?: string;
};

const safeFile = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[char] ?? char));

export default function CustomerExperience() {
  const { data, activeEvent } = useSeatServe();
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const origin = window.location.origin;
  const activeVenue = data.venues.find((item) => item.id === activeEvent?.venueId);

  const entries = useMemo<QrEntry[]>(() => {
    const staff: QrEntry = {
      id: "staff",
      kind: "staff",
      title: "SeatServe Staff",
      subtitle: "STAFF ONLY · Kitchen, Runner, and Administration entry",
      url: `${origin}/staff`,
      filename: "seatserve-staff-qr.png",
    };
    const zones = data.venues
      .filter((venue) => venue.active)
      .flatMap((venue) => venue.zones.filter((zone) => zone.active && zone.deliveryEnabled).map((zone) => ({
        id: `zone-${venue.id}-${zone.id}`,
        kind: "zone" as const,
        title: zone.name,
        subtitle: `${venue.name} · Scan to order concessions`,
        url: `${origin}/order/zone/${venue.id}/${zone.id}`,
        filename: `seatserve-${safeFile(venue.name)}-${safeFile(zone.name)}-qr.png`,
        venueName: venue.name,
      })));
    return [staff, ...zones];
  }, [data.venues, origin]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(entries.map(async (entry) => [entry.id, await QRCode.toDataURL(entry.url, {
      width: 520,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#071a3d", light: "#ffffff" },
    })] as const)).then((pairs) => {
      if (!cancelled) setQrImages(Object.fromEntries(pairs));
    }).catch(() => {
      if (!cancelled) setQrImages({});
    });
    return () => { cancelled = true; };
  }, [entries]);

  const printEntries = (selected: QrEntry[]) => {
    const printable = selected.filter((entry) => qrImages[entry.id]);
    if (!printable.length) return;
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.opener = null;
    const cards = printable.map((entry) => `<section class="qr-card ${entry.kind === "staff" ? "staff" : ""}">
      <img class="logo" src="${origin}/seatserve-web-logo.png" alt="SeatServe" />
      ${entry.kind === "staff" ? '<div class="staff-label">STAFF ONLY</div>' : '<div class="scan-label">SCAN TO ORDER CONCESSIONS</div>'}
      <h1>${escapeHtml(entry.title)}</h1>
      <p>${escapeHtml(entry.subtitle)}</p>
      <img class="qr" src="${qrImages[entry.id]}" alt="QR code" />
      <small>${escapeHtml(entry.url)}</small>
    </section>`).join("");
    popup.document.write(`<!doctype html><html><head><title>SeatServe QR Codes</title><style>
      @page{size:letter;margin:.35in}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#071a3d}.sheet{display:grid;grid-template-columns:repeat(2,1fr);gap:.25in}.qr-card{min-height:4.65in;border:2px solid #071a3d;border-radius:18px;padding:.22in;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;break-inside:avoid}.qr-card.staff{border-width:4px}.logo{width:82%;height:.7in;object-fit:contain}.qr{width:2.6in;height:2.6in;object-fit:contain}.staff-label,.scan-label{font-weight:900;letter-spacing:.12em;margin:.08in 0 .04in}.staff-label{background:#071a3d;color:#fff;padding:7px 14px;border-radius:999px}.scan-label{font-size:11px}h1{font-size:24px;margin:8px 0 4px}p{font-size:13px;margin:0 0 8px;color:#485670}small{font-size:8px;word-break:break-all;color:#6d7890}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><main class="sheet">${cards}</main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`);
    popup.document.close();
  };

  const staffEntry = entries[0];
  const zoneEntries = entries.slice(1);
  const byVenue = data.venues.filter((venue) => venue.active).map((venue) => ({
    venue,
    entries: zoneEntries.filter((entry) => entry.venueName === venue.name),
  })).filter((group) => group.entries.length);

  return (
    <section className="customer-experience-page">
      <div className="customer-experience-heading">
        <div>
          <p className="eyebrow">Pilot QR generator</p>
          <h2>Staff &amp; customer QR codes</h2>
          <p>Generate permanent zone ordering codes plus one staff entry code. Zone codes automatically resolve the current live event.</p>
        </div>
        <div className="customer-experience-heading__actions">
          <button className="secondary-button is-button" onClick={() => printEntries(entries)}><Printer size={17}/> Print all QR codes</button>
          <Link className="secondary-button" to="/admin/venues">Manage Venue &amp; Zones</Link>
        </div>
      </div>

      <section className="customer-experience-summary">
        <div className="customer-experience-icon"><ShoppingBag size={24} /></div>
        <div>
          <span>Current live event</span>
          <h3>{activeEvent ? `${activeEvent.name} vs ${activeEvent.opponent}` : "No live event"}</h3>
          <p>{activeVenue?.name ?? "Zone QR codes remain valid even before an event goes live"} · Ordering {activeEvent?.orderingEnabled ? "open" : "closed"}</p>
        </div>
      </section>

      <section className="customer-experience-panel qr-staff-panel">
        <div className="customer-experience-panel__heading">
          <div><p className="eyebrow">Staff QR</p><h3>Single staff entry code</h3></div>
          <span><ShieldCheck size={15}/> Routing only — not authorization</span>
        </div>
        <QrCard entry={staffEntry} image={qrImages[staffEntry.id]} onPrint={() => printEntries([staffEntry])} />
      </section>

      <section className="customer-experience-panel">
        <div className="customer-experience-panel__heading">
          <div><p className="eyebrow">Customer zone QR codes</p><h3>Permanent ordering entry points</h3></div>
          <span>{zoneEntries.length} active zones</span>
        </div>
        {byVenue.length ? byVenue.map(({venue, entries: venueEntries}) => (
          <section className="qr-venue-group" key={venue.id}>
            <div className="qr-venue-group__heading"><div><MapPin size={18}/><strong>{venue.name}</strong><span>{venueEntries.length} zones</span></div><button onClick={() => printEntries(venueEntries)}><Printer size={15}/> Print venue</button></div>
            <div className="customer-zone-grid">{venueEntries.map((entry) => <QrCard key={entry.id} entry={entry} image={qrImages[entry.id]} onPrint={() => printEntries([entry])} compact />)}</div>
          </section>
        )) : (
          <div className="customer-experience-empty"><QrCode size={30}/><h3>No customer zone QR codes available</h3><p>Add an active venue and at least one delivery-enabled zone.</p><Link className="primary-button" to="/admin/venues">Configure zones</Link></div>
        )}
      </section>

      <section className="qr-pilot-note"><UsersRound size={20}/><div><strong>Print once, reuse across events.</strong><p>Zone QR codes contain only the venue and zone identifiers. When scanned, SeatServe resolves the currently live event and its assigned menu.</p></div></section>
    </section>
  );
}

function QrCard({entry,image,onPrint,compact=false}:{entry:QrEntry;image?:string;onPrint:()=>void;compact?:boolean}) {
  const copy = async () => navigator.clipboard.writeText(entry.url);
  return (
    <article className={`customer-zone-card qr-generator-card ${entry.kind === "staff" ? "is-staff" : ""} ${compact ? "is-compact" : ""}`}>
      <div className="qr-generator-card__preview">{image ? <img src={image} alt={`${entry.title} QR code`} /> : <QrCode size={42}/>}</div>
      <div className="customer-zone-card__copy"><h4>{entry.title}</h4><p>{entry.kind === "staff" ? <ShieldCheck size={14}/> : <MapPin size={14}/>} {entry.subtitle}</p><small>{entry.url}</small></div>
      <div className="qr-generator-card__actions">
        <a href={entry.url} target="_blank" rel="noreferrer" title="Test link"><ExternalLink size={16}/> Test</a>
        <button onClick={copy} type="button">Copy link</button>
        {image && <a href={image} download={entry.filename} title="Download PNG"><Download size={16}/> PNG</a>}
        <button onClick={onPrint} type="button"><Printer size={16}/> Print</button>
      </div>
    </article>
  );
}
