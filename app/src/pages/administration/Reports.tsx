import { useMemo, useState } from "react";
import { Archive, Banknote, Clock3, CreditCard, Download, MessageSquareText, PackageCheck, Star, Trash2, TrendingUp, UsersRound } from "lucide-react";
import { useSeatServe } from "../../state/SeatServeContext";
import type { Order } from "../../types/domain";
import "./Reports.css";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const minutesBetween = (start?: string, end?: string) => {
  if (!start || !end) return undefined;
  const value = (new Date(end).getTime() - new Date(start).getTime()) / 60_000;
  return Number.isFinite(value) && value >= 0 ? value : undefined;
};
const average = (values: Array<number | undefined>) => {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : undefined;
};
const orderAmount = (order: Order) => order.paymentMethod === "card" ? (order.cardTotal ?? order.total) : (order.cashTotal ?? order.total);

export default function Reports() {
  const { data, activeEvent, updateReportingData } = useSeatServe();
  const defaultEventId = activeEvent?.id ?? "all";
  const [eventId, setEventId] = useState(defaultEventId);
  const [cleanupStatus, setCleanupStatus] = useState("all");
  const [cleanupPayment, setCleanupPayment] = useState("all");
  const [cleanupRunner, setCleanupRunner] = useState("all");
  const [cleanupVenue, setCleanupVenue] = useState("all");
  const [cleanupZone, setCleanupZone] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const events = useMemo(() => [...data.events].sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()), [data.events]);
  const selectedOrders = useMemo(() => data.orders.filter((order) => eventId === "all" || order.eventId === eventId), [data.orders, eventId]);
  const nonCancelled = selectedOrders.filter((order) => order.status !== "cancelled");
  const delivered = nonCancelled.filter((order) => order.status === "delivered" || order.deliveredAt);
  const selectedEvent = events.find((event) => event.id === eventId);

  const totals = useMemo(() => {
    const sales = nonCancelled.reduce((sum, order) => sum + orderAmount(order), 0);
    const collected = nonCancelled.filter((order) => order.paymentCollectedAt).reduce((sum, order) => sum + orderAmount(order), 0);
    const cash = nonCancelled.filter((order) => order.paymentMethod === "cash").reduce((sum, order) => sum + (order.cashTotal ?? order.total), 0);
    const card = nonCancelled.filter((order) => order.paymentMethod === "card").reduce((sum, order) => sum + (order.cardTotal ?? order.total), 0);
    const deliveryFees = nonCancelled.reduce((sum, order) => sum + (order.deliveryFee ?? 0), 0);
    const cardFees = nonCancelled.filter((order) => order.paymentMethod === "card").reduce((sum, order) => sum + (order.estimatedCardFee ?? 0), 0);
    const avgOrder = nonCancelled.length ? sales / nonCancelled.length : 0;
    const avgPrep = average(delivered.map((order) => minutesBetween(order.preparingAt ?? order.acceptedAt, order.readyAt)));
    const avgDelivery = average(delivered.map((order) => minutesBetween(order.deliveringAt ?? order.assignedAt, order.deliveredAt)));
    const avgFulfillment = average(delivered.map((order) => minutesBetween(order.placedAt, order.deliveredAt)));
    return { sales, collected, cash, card, deliveryFees, cardFees, avgOrder, avgPrep, avgDelivery, avgFulfillment };
  }, [nonCancelled, delivered]);

  const feedback = data.feedback.filter((item) => eventId === "all" || item.eventId === eventId);
  const ratedFeedback = feedback.filter((item) => typeof item.rating === "number");
  const avgRating = ratedFeedback.length ? ratedFeedback.reduce((sum, item) => sum + (item.rating ?? 0), 0) / ratedFeedback.length : undefined;

  const statusCounts = ["new", "preparing", "ready", "assigned", "delivering", "delivered", "cancelled"].map((status) => ({
    status,
    count: selectedOrders.filter((order) => order.status === status).length,
  }));
  const maxStatus = Math.max(1, ...statusCounts.map((item) => item.count));

  const runnerRows = data.runners.map((runner) => {
    const orders = delivered.filter((order) => order.runnerId === runner.id);
    return {
      id: runner.id,
      name: runner.name,
      delivered: orders.length,
      avgDelivery: average(orders.map((order) => minutesBetween(order.deliveringAt ?? order.assignedAt, order.deliveredAt))),
      avgFulfillment: average(orders.map((order) => minutesBetween(order.placedAt, order.deliveredAt))),
      collected: orders.filter((order) => order.paymentCollectedAt).reduce((sum, order) => sum + orderAmount(order), 0),
    };
  }).filter((row) => row.delivered > 0).sort((a, b) => b.delivered - a.delivered);

  const zoneRows = data.venues.flatMap((venue) => venue.zones.map((zone) => {
    const orders = delivered.filter((order) => order.location.venueId === venue.id && order.location.zoneId === zone.id);
    return {
      id: `${venue.id}-${zone.id}`,
      venue: venue.name,
      zone: zone.name,
      delivered: orders.length,
      avgDelivery: average(orders.map((order) => minutesBetween(order.deliveringAt ?? order.assignedAt, order.deliveredAt))),
      learned: zone.learnedRoundTripMinutes ?? zone.baselineRoundTripMinutes,
    };
  })).filter((row) => row.delivered > 0).sort((a, b) => b.delivered - a.delivered);

  const cleanupOrders = selectedOrders.filter((order) => {
    const placed = new Date(order.placedAt).getTime();
    const fromOk = !dateFrom || placed >= new Date(`${dateFrom}T00:00:00`).getTime();
    const toOk = !dateTo || placed <= new Date(`${dateTo}T23:59:59`).getTime();
    return fromOk && toOk && (cleanupStatus === "all" || order.status === cleanupStatus) && (cleanupPayment === "all" || order.paymentMethod === cleanupPayment) && (cleanupRunner === "all" || order.runnerId === cleanupRunner) && (cleanupVenue === "all" || order.location.venueId === cleanupVenue) && (cleanupZone === "all" || order.location.zoneId === cleanupZone);
  });
  const cleanupIds = new Set(cleanupOrders.map((order) => order.id));
  const cleanupFeedback = data.feedback.filter((item) => cleanupIds.has(item.orderId));
  const cleanupTotal = cleanupOrders.reduce((sum, order) => sum + orderAmount(order), 0);
  const archiveFiltered = () => {
    if (!cleanupOrders.length || !window.confirm(`Archive ${cleanupOrders.length} filtered orders? They will leave current reports but remain in the workspace archive.`)) return;
    updateReportingData({ ...data, orders: data.orders.filter((order) => !cleanupIds.has(order.id)), feedback: data.feedback.filter((item) => !cleanupIds.has(item.orderId)), archivedOrders: [...(data.archivedOrders ?? []), ...cleanupOrders.map((order) => ({ ...order, customer: { ...order.customer, mobile: undefined } }))], archivedFeedback: [...(data.archivedFeedback ?? []), ...cleanupFeedback] }, "Archived filtered reporting data");
  };
  const deleteFiltered = () => {
    if (!cleanupOrders.length) return;
    const confirmation = window.prompt(`Permanently delete ${cleanupOrders.length} filtered orders and ${cleanupFeedback.length} feedback responses? Type DELETE TEST DATA to continue.`);
    if (confirmation !== "DELETE TEST DATA") return;
    updateReportingData({ ...data, orders: data.orders.filter((order) => !cleanupIds.has(order.id)), feedback: data.feedback.filter((item) => !cleanupIds.has(item.orderId)) }, "Deleted filtered test reporting data");
  };

  const exportCsv = () => {
    const rows = [
      ["Order", "Event", "Customer", "Status", "Payment", "Amount", "Delivery Fee", "Runner", "Zone", "Placed", "Delivered"],
      ...selectedOrders.map((order) => {
        const event = data.events.find((item) => item.id === order.eventId);
        const runner = data.runners.find((item) => item.id === order.runnerId);
        const venue = data.venues.find((item) => item.id === order.location.venueId);
        const zone = venue?.zones.find((item) => item.id === order.location.zoneId);
        return [order.id, event?.name ?? order.eventId, order.customer.name, order.status, order.paymentMethod ?? "", orderAmount(order).toFixed(2), (order.deliveryFee ?? 0).toFixed(2), runner?.name ?? "", zone?.name ?? "", order.placedAt, order.deliveredAt ?? ""];
      }),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `seatserve-${selectedEvent?.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "all-events"}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <section className="reports-page">
    <header className="reports-heading">
      <div><p className="reports-eyebrow">Administration</p><h1>Reports</h1><span>Current workspace sales, payments, fulfillment, runners, zones, and customer feedback.</span></div>
      <div className="reports-actions"><label>Event<select value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="all">All events</option>{events.map((event) => <option key={event.id} value={event.id}>{event.status === "live" ? "LIVE · " : ""}{event.name} · {new Date(event.startsAt).toLocaleDateString()}</option>)}</select></label><button onClick={exportCsv}><Download size={17}/> Export CSV</button></div>
    </header>

    <section className="report-kpis">
      <article><TrendingUp/><span>Order value</span><strong>{money(totals.sales)}</strong><small>{nonCancelled.length} non-cancelled orders</small></article>
      <article><Banknote/><span>Exact cash</span><strong>{money(totals.cash)}</strong><small>Selected by customers</small></article>
      <article><CreditCard/><span>Credit card</span><strong>{money(totals.card)}</strong><small>{money(totals.cardFees)} estimated card fees</small></article>
      <article><PackageCheck/><span>Collected</span><strong>{money(totals.collected)}</strong><small>{money(Math.max(0, totals.sales - totals.collected))} outstanding</small></article>
      <article><Clock3/><span>Avg delivery</span><strong>{totals.avgDelivery === undefined ? "—" : `${totals.avgDelivery.toFixed(1)} min`}</strong><small>{totals.avgFulfillment === undefined ? "No completed sample" : `${totals.avgFulfillment.toFixed(1)} min placed-to-delivered`}</small></article>
      <article><Star/><span>Experience rating</span><strong>{avgRating === undefined ? "—" : `${avgRating.toFixed(1)} / 5`}</strong><small>{feedback.length} feedback responses</small></article>
    </section>

    <section className="reports-grid">
      <article className="report-card">
        <div className="report-card__heading"><div><h2>Order workflow</h2><p>Where orders in this report currently sit.</p></div></div>
        <div className="status-bars">{statusCounts.map((item) => <div key={item.status}><span>{item.status.replace(/^./, (value) => value.toUpperCase())}</span><div><i style={{ width: `${(item.count / maxStatus) * 100}%` }}/></div><strong>{item.count}</strong></div>)}</div>
      </article>
      <article className="report-card payment-card">
        <div className="report-card__heading"><div><h2>Payment summary</h2><p>Amounts selected and collected at delivery.</p></div></div>
        <dl><div><dt>Average order</dt><dd>{money(totals.avgOrder)}</dd></div><div><dt>Delivery fees</dt><dd>{money(totals.deliveryFees)}</dd></div><div><dt>Estimated card fees</dt><dd>{money(totals.cardFees)}</dd></div><div><dt>Avg prep time</dt><dd>{totals.avgPrep === undefined ? "—" : `${totals.avgPrep.toFixed(1)} min`}</dd></div></dl>
      </article>
    </section>

    <section className="report-card report-table-card">
      <div className="report-card__heading"><div><h2>Runner performance</h2><p>Delivered orders for the selected event scope.</p></div><UsersRound size={20}/></div>
      <div className="report-table"><div className="report-table__header"><span>Runner</span><span>Delivered</span><span>Avg delivery</span><span>Avg fulfillment</span><span>Collected</span></div>{runnerRows.map((row) => <div className="report-table__row" key={row.id}><strong>{row.name}</strong><span>{row.delivered}</span><span>{row.avgDelivery === undefined ? "—" : `${row.avgDelivery.toFixed(1)} min`}</span><span>{row.avgFulfillment === undefined ? "—" : `${row.avgFulfillment.toFixed(1)} min`}</span><span>{money(row.collected)}</span></div>)}{runnerRows.length === 0 && <p className="report-empty">No delivered runner orders in this selection yet.</p>}</div>
    </section>

    <section className="report-card report-cleanup-card">
      <div className="report-card__heading"><div><h2>Archive &amp; delete reporting data</h2><p>Filter test data before archiving or permanently deleting it. Venue, menu, runner, event, and workspace configuration are never removed.</p></div></div>
      <div className="reports-actions" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
        <label>Status<select value={cleanupStatus} onChange={(e)=>setCleanupStatus(e.target.value)}><option value="all">All statuses</option>{["new","preparing","ready","assigned","delivering","delivered","cancelled"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Payment<select value={cleanupPayment} onChange={(e)=>setCleanupPayment(e.target.value)}><option value="all">All payments</option><option value="cash">Cash</option><option value="card">Card</option></select></label>
        <label>Runner<select value={cleanupRunner} onChange={(e)=>setCleanupRunner(e.target.value)}><option value="all">All runners</option>{data.runners.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label>Venue<select value={cleanupVenue} onChange={(e)=>{setCleanupVenue(e.target.value);setCleanupZone("all")}}><option value="all">All venues</option>{data.venues.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <label>Zone<select value={cleanupZone} onChange={(e)=>setCleanupZone(e.target.value)}><option value="all">All zones</option>{data.venues.filter(v=>cleanupVenue==="all"||v.id===cleanupVenue).flatMap(v=>v.zones.map(z=><option key={`${v.id}-${z.id}`} value={z.id}>{v.name} · {z.name}</option>))}</select></label>
        <label>From<input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)}/></label><label>To<input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)}/></label>
      </div>
      <div style={{marginTop:16,padding:14,border:"1px solid #dce3ef",borderRadius:12,display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap",alignItems:"center"}}><div><strong>{cleanupOrders.length} orders · {cleanupFeedback.length} feedback responses</strong><div style={{color:"#64748b",marginTop:4}}>Filtered order value: {money(cleanupTotal)} · Archived orders already stored: {(data.archivedOrders ?? []).length}</div></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button onClick={archiveFiltered} disabled={!cleanupOrders.length}><Archive size={17}/> Archive filtered</button><button onClick={deleteFiltered} disabled={!cleanupOrders.length} style={{background:"#b42318",color:"white"}}><Trash2 size={17}/> Permanently delete filtered</button></div></div>
    </section>

    <section className="reports-grid reports-grid--bottom">
      <article className="report-card report-table-card"><div className="report-card__heading"><div><h2>Zone performance</h2><p>Delivery history by destination.</p></div></div><div className="zone-list">{zoneRows.map((row) => <div key={row.id}><span><strong>{row.zone}</strong><small>{row.venue}</small></span><span>{row.delivered} delivered</span><span>{row.avgDelivery === undefined ? "—" : `${row.avgDelivery.toFixed(1)} min delivery`}</span><span>{row.learned ? `${row.learned.toFixed(1)} min round trip` : "No estimate"}</span></div>)}{zoneRows.length === 0 && <p className="report-empty">No completed zone deliveries yet.</p>}</div></article>
      <article className="report-card feedback-card"><div className="report-card__heading"><div><h2>Customer feedback</h2><p>Latest ratings and comments.</p></div><MessageSquareText size={20}/></div><div className="feedback-list">{feedback.slice(0, 8).map((item) => <div key={item.id}><span>{item.rating ? `${"★".repeat(item.rating)}${"☆".repeat(5-item.rating)}` : "No rating"}</span><p>{item.comments || "No comment"}</p><small>{new Date(item.submittedAt).toLocaleString()}</small></div>)}{feedback.length === 0 && <p className="report-empty">No customer feedback in this selection yet.</p>}</div></article>
    </section>
  </section>;
}
