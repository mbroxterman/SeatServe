import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Clock3,
  DollarSign,
  MapPinned,
  Settings,
  ShoppingBag,
  CookingPot,
  Smartphone,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useSeatServe } from "../../state/SeatServeContext";
import "./Dashboard.css";

const modules = [
  { title: "Event Setup", description: "Create events, set schedules, and control ordering windows.", icon: CalendarDays, to: "/admin/events" },
  { title: "Venue & Zones", description: "Manage venues, delivery zones, and customer QR entry points.", icon: MapPinned, to: "/admin/venues" },
  { title: "Menu Manager", description: "Manage categories, items, pricing, and availability.", icon: UtensilsCrossed, to: "/admin/menu" },
  { title: "Runner Management", description: "Manage the runner roster, availability, and delivery readiness.", icon: Users, to: "/admin/runners" },
  { title: "Customer Experience", description: "Preview customer ordering and manage zone QR destinations.", icon: ShoppingBag, to: "/admin/customer-experience" },
  { title: "Reports", description: "Review sales, fulfillment, runner, and venue performance.", icon: BarChart3, to: "/admin/reports" },
  { title: "Settings", description: "Configure workspace, payments, fees, and permissions.", icon: Settings, to: "/admin/settings" },
];

export default function Dashboard() {
  const { data, activeEvent } = useSeatServe();
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const activeVenue = data.venues.find((venue) => venue.id === activeEvent?.venueId);
  const availableRunners = data.runners.filter((runner) => runner.active && runner.status === "available").length;
  const currentOrders = activeEvent ? data.orders.filter((order) => order.eventId === activeEvent.id && order.status !== "cancelled") : [];
  const sales = currentOrders.reduce((sum, order) => sum + (order.paymentMethod === "card" ? (order.cardTotal ?? order.total) : (order.cashTotal ?? order.total)), 0);
  const deliveredOrders = currentOrders.filter((order) => order.deliveredAt);
  const deliverySamples = deliveredOrders
    .filter((order) => order.deliveringAt && order.deliveredAt)
    .map((order) => (new Date(order.deliveredAt!).getTime() - new Date(order.deliveringAt!).getTime()) / 60_000)
    .filter((minutes) => Number.isFinite(minutes) && minutes >= 0);
  const averageDelivery = deliverySamples.length ? deliverySamples.reduce((sum, minutes) => sum + minutes, 0) / deliverySamples.length : undefined;
  const firstZone = activeVenue?.zones.find((zone) => zone.active && zone.deliveryEnabled);
  const customerPath = activeEvent && activeVenue && firstZone ? `/order/${activeEvent.id}/${activeVenue.id}/${firstZone.id}` : undefined;

  return (
    <section className="dashboard-main">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">{today}</p>
          <h2>Good morning, Administrator</h2>
          <p>Here is the current status of your SeatServe workspace.</p>
        </div>
      </div>

      <section className="current-event-card">
        <div className="event-icon"><CalendarDays size={22} /></div>
        <div className="event-copy">
          <div className="event-label">{activeEvent?.status === "live" ? "Current event" : "Next event"} <span>{activeEvent?.status ?? "Not scheduled"}</span></div>
          <h3>{activeEvent ? `${activeEvent.name} vs ${activeEvent.opponent}` : "No active event"}</h3>
          <p><MapPinned size={14} /> {activeVenue?.name ?? "No venue assigned"} <Clock3 size={14} /> Ordering {activeEvent?.orderingEnabled ? "open" : "closed"}</p>
        </div>
        <div className="event-actions">
          <div className="ordering-status"><span>Customer ordering</span><strong>{activeEvent?.orderingEnabled ? "Open" : "Closed"}</strong></div>
          {customerPath ? <Link className="secondary-button" to={customerPath}>Preview ordering</Link> : <Link className="secondary-button" to="/admin/events">Manage event</Link>}
        </div>
      </section>

      <section className="stats-grid">
        <article><CalendarDays /><span>Event Orders</span><strong>{currentOrders.length}</strong><small>{activeEvent?.orderingEnabled ? "Ordering is open" : "Ordering is closed"}</small></article>
        <article><Users /><span>Available Runners</span><strong>{availableRunners}</strong><small>{data.runners.length} on roster</small></article>
        <article><Clock3 /><span>Average Delivery</span><strong>{averageDelivery === undefined ? "—" : `${averageDelivery.toFixed(1)} min`}</strong><small>Runner pickup to delivered</small></article>
        <article><DollarSign /><span>Event Sales</span><strong>${sales.toFixed(2)}</strong><small>Cash/card total selected by customer</small></article>
      </section>

      <section className="dashboard-content-grid">
        <div className="panel module-panel">
          <div className="panel-heading"><div><p className="eyebrow">Workspace tools</p><h3>Administration</h3></div><span>Select a module to manage settings</span></div>
          <div className="module-grid">
            {modules.map(({ title, description, icon: Icon, to }) => (
              <Link key={title} className="module-card" to={to}>
                <div className="module-icon"><Icon size={20} /></div>
                <div className="module-copy"><strong>{title}</strong><span>{description}</span></div>
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </div>
        </div>

        <aside className="dashboard-side">
          <div className="panel quick-panel">
            <p className="eyebrow">Common tasks</p><h3>Quick actions</h3>
            <Link to="/kitchen"><CookingPot size={16}/> Launch kitchen operations <span>›</span></Link>
            <Link to="/runner"><Smartphone size={16}/> Launch runner mobile <span>›</span></Link>
            <Link to="/admin/customer-experience"><ShoppingBag size={16}/> Manage customer experience <span>›</span></Link>
            <Link to="/admin/events"><CalendarDays size={16}/> Create an event <span>›</span></Link>
            <Link to="/admin/venues"><MapPinned size={16}/> Manage venue zones <span>›</span></Link>
            <Link to="/admin/menu"><UtensilsCrossed size={16}/> Update menu <span>›</span></Link>
            <Link to="/admin/runners"><Users size={16}/> Open runner management <span>›</span></Link>
          </div>
        </aside>
      </section>
      <footer className="dashboard-footer"><span>SeatServe Administration</span><span>v2.1.6</span></footer>
    </section>
  );
}
