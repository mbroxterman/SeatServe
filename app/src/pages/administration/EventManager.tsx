import { CalendarDays, Check, Clock3, Copy, MapPin, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useSeatServe } from "../../state/SeatServeContext";
import type { EventStatus, SeatServeEvent } from "../../types/domain";
import "./EventManager.css";

type EventDraft = Omit<SeatServeEvent, "id">;

const toLocalInput = (value: string) => value ? new Date(value).toISOString().slice(0, 16) : "";
const fromLocalInput = (value: string) => value ? new Date(value).toISOString() : new Date().toISOString();
const formatDateTime = (value: string) => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
const statusLabel = (status: EventStatus) => status.charAt(0).toUpperCase() + status.slice(1);

export default function EventManager() {
  const { data, addEvent, updateEvent, duplicateEvent, deleteEvent, startEvent, completeEvent, setOrderingEnabled } = useSeatServe();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EventStatus>("all");
  const [editing, setEditing] = useState<SeatServeEvent>();
  const [formOpen, setFormOpen] = useState(false);
  const firstVenue = data.venues[0];
    const [defaultStart] = useState(() => {
        const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
        d.setMinutes(0, 0, 0);
        return d;
    });


  const emptyDraft = (): EventDraft => ({
    name: "", opponent: "", venueId: firstVenue?.id ?? "", menuId: data.menus[0]?.id,
    startsAt: defaultStart.toISOString(), orderingOpensAt: new Date(defaultStart.getTime() - 30 * 60_000).toISOString(),
    orderingClosesAt: new Date(defaultStart.getTime() + 3 * 60 * 60_000).toISOString(), status: "draft", orderingEnabled: false,
  });
  const [draft, setDraft] = useState<EventDraft>(emptyDraft);

  const filtered = useMemo(() => data.events.filter((event) => {
    const venue = data.venues.find((item) => item.id === event.venueId)?.name ?? "";
    const match = `${event.name} ${event.opponent} ${venue}`.toLowerCase().includes(query.trim().toLowerCase());
    return match && (statusFilter === "all" || event.status === statusFilter);
  }).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()), [data.events, data.venues, query, statusFilter]);

  const openCreate = () => { setEditing(undefined); setDraft(emptyDraft()); setFormOpen(true); };
  const openEdit = (event: SeatServeEvent) => { setEditing(event); setDraft({ ...event }); setFormOpen(true); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
      const clean = { ...draft, name: draft.name.trim(), opponent: (draft.opponent || "").trim() };
    if (!clean.name || !clean.venueId) return;
    if (editing) updateEvent(editing.id, clean); else addEvent(clean);
    setFormOpen(false);
  };

  return <section className="event-manager-main">
    <div className="event-manager-topbar">
      <div><p className="eyebrow">Event setup</p><h2>Events</h2><p>Create events, assign venues and menus, and control the one live event used across SeatServe.</p></div>
      <button className="primary-button" onClick={openCreate}><Plus size={17}/> Create event</button>
    </div>

    <section className="event-summary-grid">
      <article><span>Live</span><strong>{data.events.filter((event) => event.status === "live").length}</strong><small>Shared by all dashboards</small></article>
      <article><span>Scheduled</span><strong>{data.events.filter((event) => event.status === "scheduled").length}</strong><small>Upcoming events</small></article>
      <article><span>Completed</span><strong>{data.events.filter((event) => event.status === "completed").length}</strong><small>Available in reports</small></article>
      <article><span>Total</span><strong>{data.events.length}</strong><small>Current workspace</small></article>
    </section>

    <section className="events-panel">
      <div className="events-toolbar">
        <label className="search-field"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events, opponents, or venues"/></label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | EventStatus)}><option value="all">All statuses</option>{(["draft","scheduled","live","completed","cancelled"] as EventStatus[]).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select>
      </div>
      <div className="event-list-header"><span>Event</span><span>Date & time</span><span>Venue & menu</span><span>Status</span><span>Actions</span></div>
      <div className="event-list">
        {filtered.map((event) => {
          const venue = data.venues.find((item) => item.id === event.venueId);
          const menu = data.menus.find((item) => item.id === event.menuId);
          return <article className="event-row" key={event.id}>
            <div className="event-name-cell"><div className="event-date-tile"><strong>{new Date(event.startsAt).getDate()}</strong><span>{new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(event.startsAt))}</span></div><div><strong>{event.name}</strong><span>vs. {event.opponent || "Opponent TBD"}</span></div></div>
            <div className="event-detail-cell"><span><CalendarDays size={14}/>{formatDateTime(event.startsAt)}</span><span><Clock3 size={14}/>Ordering {event.orderingEnabled ? "open" : "closed"}</span></div>
            <div className="event-detail-cell"><span><MapPin size={14}/>{venue?.name ?? "No venue"}</span><span>{menu?.name ?? "No menu assigned"}</span></div>
            <div><span className={`event-status event-status--${event.status}`}>{statusLabel(event.status)}</span></div>
            <div className="row-actions">
              {event.status !== "live" && event.status !== "completed" && <button title="Start event" onClick={() => startEvent(event.id)}><Check size={16}/></button>}
              {event.status === "live" && <button title="Complete event" onClick={() => completeEvent(event.id)}><Check size={16}/></button>}
              <button title={event.orderingEnabled ? "Close ordering" : "Open ordering"} onClick={() => setOrderingEnabled(event.id, !event.orderingEnabled)}><Clock3 size={16}/></button>
              <button title="Edit event" onClick={() => openEdit(event)}><Pencil size={16}/></button>
              <button title="Duplicate event" onClick={() => duplicateEvent(event.id)}><Copy size={16}/></button>
              <button title="Delete event" onClick={() => { if (window.confirm("Delete this event?")) { if (!deleteEvent(event.id)) window.alert("Events with orders cannot be deleted."); } }}><Trash2 size={16}/></button>
            </div>
          </article>;
        })}
        {filtered.length === 0 && <div className="empty-state"><CalendarDays size={34}/><h3>No events found</h3><p>Create an event or adjust the filters.</p></div>}
      </div>
    </section>

    {formOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setFormOpen(false); }}>
      <section className="event-modal" role="dialog" aria-modal="true">
        <div className="modal-header"><div><p className="eyebrow">Event details</p><h3>{editing ? "Edit event" : "Create event"}</h3></div><button onClick={() => setFormOpen(false)}><X size={20}/></button></div>
        <form onSubmit={submit}><div className="form-grid">
          <label className="span-2">Event name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></label>
          <label>Opponent<input value={draft.opponent} onChange={(event) => setDraft({ ...draft, opponent: event.target.value })}/></label>
          <label>Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as EventStatus })}>{(["draft","scheduled","live","completed","cancelled"] as EventStatus[]).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
          <label>Venue<select required value={draft.venueId} onChange={(event) => setDraft({ ...draft, venueId: event.target.value })}>{data.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>
          <label>Menu<select value={draft.menuId ?? ""} onChange={(event) => setDraft({ ...draft, menuId: event.target.value || undefined })}><option value="">No menu</option>{data.menus.map((menu) => <option key={menu.id} value={menu.id}>{menu.name}</option>)}</select></label>
          <label>Starts<input type="datetime-local" value={toLocalInput(draft.startsAt)} onChange={(event) => setDraft({ ...draft, startsAt: fromLocalInput(event.target.value) })}/></label>
          <label>Ordering opens<input type="datetime-local" value={toLocalInput(draft.orderingOpensAt || "")} onChange={(event) => setDraft({ ...draft, orderingOpensAt: fromLocalInput(event.target.value) })} /></label>
          <label>Ordering closes<input type="datetime-local" value={toLocalInput(draft.orderingClosesAt || "")} onChange={(event) => setDraft({ ...draft, orderingClosesAt: fromLocalInput(event.target.value) })} /></label>


          <label className="menu-check"><input type="checkbox" checked={draft.orderingEnabled} onChange={(event) => setDraft({ ...draft, orderingEnabled: event.target.checked })}/> Customer ordering enabled</label>
        </div><div className="modal-footer"><button type="button" className="cancel-button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-button" type="submit">Save event</button></div></form>
      </section>
    </div>}
  </section>;
}
