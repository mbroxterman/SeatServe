import { useMemo, useState, type FormEvent } from "react";
import { Building2, CirclePlus, Copy, ExternalLink, MapPin, Pencil, QrCode, Search, Trash2, X } from "lucide-react";
import { useSeatServe } from "../../state/SeatServeContext";
import type { DeliveryZone, Venue } from "../../types/domain";
import "./VenueManager.css";

type Editor = { type: "venue"; venue?: Venue } | { type: "zone"; venueId: string; zone?: DeliveryZone } | null;

export default function VenueManager() {
  const { data, addVenue, updateVenue, duplicateVenue, deleteVenue, addZone, updateZone, duplicateZone, deleteZone } = useSeatServe();
  const [query, setQuery] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState(data.venues[0]?.id ?? "");
  const [editor, setEditor] = useState<Editor>(null);
  const [notice, setNotice] = useState("");
  const venues = useMemo(() => data.venues.filter((venue) => venue.name.toLowerCase().includes(query.toLowerCase())), [data.venues, query]);
  const selectedVenue = data.venues.find((venue) => venue.id === selectedVenueId) ?? venues[0];

  const customerPath = (venueId: string, zoneId: string) => `/order/zone/${venueId}/${zoneId}`;

  const openZone = (venueId: string, zoneId: string) => {
    const path = customerPath(venueId, zoneId);
    window.open(path, "_blank", "noopener,noreferrer");
  };

  const copyZone = async (venueId: string, zoneId: string) => {
    const path = customerPath(venueId, zoneId);
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setNotice("Customer zone link copied.");
  };

  return <section className="venue-page">
    <header className="venue-page__header"><div><p className="venue-page__eyebrow">Administration</p><h1>Venue & Zones</h1><p>Configure venues and one customer QR entry point for each delivery zone.</p></div><button className="venue-button venue-button--primary" onClick={() => setEditor({type:"venue"})}><CirclePlus size={18}/> Add venue</button></header>
    {notice && <div className="venue-notice"><span>{notice}</span><button onClick={() => setNotice("")}><X size={16}/></button></div>}
    <div className="venue-summary"><Summary label="Active venues" value={data.venues.filter(v=>v.active).length} icon={<Building2 size={20}/>}/><Summary label="Delivery zones" value={data.venues.reduce((n,v)=>n+v.zones.length,0)} icon={<MapPin size={20}/>}/><Summary label="Zone QR links" value={data.venues.reduce((n,v)=>n+v.zones.filter(z=>z.active).length,0)} icon={<QrCode size={20}/>}/></div>
    <div className="venue-workspace">
      <aside className="venue-list-panel"><div className="venue-list-panel__toolbar"><label className="venue-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search venues"/></label></div><div className="venue-list">{venues.map(venue=><button key={venue.id} className={`venue-list-item ${selectedVenue?.id===venue.id?"is-selected":""}`} onClick={()=>setSelectedVenueId(venue.id)}><span className="venue-list-item__icon"><Building2 size={20}/></span><span className="venue-list-item__copy"><strong>{venue.name}</strong><small>{venue.zones.length} zones</small></span></button>)}</div></aside>
      <main className="venue-detail-panel">{selectedVenue ? <><div className="venue-detail-heading"><div><h2>{selectedVenue.name}</h2><p>{selectedVenue.type} · {selectedVenue.address}</p></div><div className="venue-detail-actions"><button title="Edit venue" onClick={()=>setEditor({type:"venue",venue:selectedVenue})}><Pencil size={18}/></button><button title="Duplicate venue" onClick={()=>duplicateVenue(selectedVenue.id)}><Copy size={18}/></button><button className="is-danger" onClick={()=>window.confirm(`Delete ${selectedVenue.name}?`)&&deleteVenue(selectedVenue.id)}><Trash2 size={18}/></button></div></div><section className="zone-list-card"><div className="zone-card-heading"><div><p className="venue-page__eyebrow">Customer delivery geography</p><h3>Zones</h3><p>Each zone has its own customer QR. After scanning, customers choose top/middle/bottom and left/center/right.</p></div><button className="venue-button venue-button--secondary" onClick={()=>setEditor({type:"zone",venueId:selectedVenue.id})}><CirclePlus size={16}/> Add zone</button></div><div className="zone-grid-simple">{selectedVenue.zones.map(zone=><article key={zone.id} className="zone-simple-card"><div><span className={zone.deliveryEnabled?"venue-status venue-status--active":"venue-status venue-status--archived"}>{zone.deliveryEnabled?"Delivery enabled":"Disabled"}</span><h4>{zone.name}</h4><p>{zone.description}</p></div><div className="zone-simple-actions"><button title="Open customer ordering" onClick={()=>openZone(selectedVenue.id,zone.id)}><ExternalLink size={18}/></button><button title="Copy customer zone link" onClick={()=>copyZone(selectedVenue.id,zone.id)}><Copy size={18}/></button><button title="Edit" onClick={()=>setEditor({type:"zone",venueId:selectedVenue.id,zone})}><Pencil size={18}/></button><button title="Duplicate zone" onClick={()=>duplicateZone(selectedVenue.id,zone.id)}><Copy size={18}/></button><button className="is-danger" title="Delete" onClick={()=>window.confirm(`Delete ${zone.name}?`)&&deleteZone(selectedVenue.id,zone.id)}><Trash2 size={18}/></button></div></article>)}</div></section></>:<div className="venue-detail-empty"><Building2 size={42}/><h2>No venue selected</h2></div>}</main>
    </div>
    {editor && <EditorModal editor={editor} onClose={()=>setEditor(null)} onVenue={(draft)=>{editor.type==="venue"&&editor.venue?updateVenue(editor.venue.id,draft):addVenue(draft);setEditor(null)}} onZone={(venueId,draft)=>{editor.type==="zone"&&editor.zone?updateZone(venueId,editor.zone.id,draft):addZone(venueId,draft);setEditor(null)}}/>}
  </section>;
}

function Summary({label,value,icon}:{label:string;value:number;icon:React.ReactNode}){return <article className="venue-summary-card"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>}

function EditorModal({editor,onClose,onVenue,onZone}:{editor:Exclude<Editor,null>;onClose:()=>void;onVenue:(draft:Omit<Venue,"id"|"zones">)=>void;onZone:(venueId:string,draft:Omit<DeliveryZone,"id"|"sections">)=>void}){
 const isVenue=editor.type==="venue"; const source=isVenue?editor.venue:editor.zone;
 const [name,setName]=useState(source?.name??""); const [description,setDescription]=useState(!isVenue?editor.zone?.description??"":""); const [type,setType]=useState(isVenue?editor.venue?.type??"Outdoor Stadium":""); const [address,setAddress]=useState(isVenue?editor.venue?.address??"":""); const [active,setActive]=useState(source?.active??true); const [delivery,setDelivery]=useState(!isVenue?editor.zone?.deliveryEnabled??true:true);
 const submit=(e:FormEvent)=>{e.preventDefault();if(isVenue)onVenue({name,type,address,active});else onZone(editor.venueId,{name,description,active,deliveryEnabled:delivery})};
 return <div className="venue-modal-backdrop" onMouseDown={onClose}><div className="venue-modal" onMouseDown={e=>e.stopPropagation()}><div className="venue-modal__heading"><div><p className="venue-page__eyebrow">{isVenue?"Venue":"Delivery zone"}</p><h2>{source?"Edit":"Add"} {isVenue?"venue":"zone"}</h2></div><button onClick={onClose}><X/></button></div><form className="venue-form" onSubmit={submit}><label>Name<input required value={name} onChange={e=>setName(e.target.value)}/></label>{isVenue?<><label>Type<input value={type} onChange={e=>setType(e.target.value)}/></label><label>Address<input value={address} onChange={e=>setAddress(e.target.value)}/></label></>:<><label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)}/></label><label className="venue-toggle-field"><span>Delivery enabled</span><input type="checkbox" checked={delivery} onChange={e=>setDelivery(e.target.checked)}/></label></>}<label className="venue-toggle-field"><span>Active</span><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/></label><div className="venue-form__actions"><button type="button" className="venue-button" onClick={onClose}>Cancel</button><button className="venue-button venue-button--primary">Save</button></div></form></div></div>
}
