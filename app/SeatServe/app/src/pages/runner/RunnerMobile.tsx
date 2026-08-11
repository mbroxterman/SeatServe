import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  Navigation,
  PackageCheck,
  RefreshCcw,
  Smartphone,
  UserRound,
  Users,
} from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useSeatServe } from "../../state/SeatServeContext";
import type { Order, Runner } from "../../types/domain";
import "./RunnerMobile.css";

export default function RunnerMobile() {
  const { runnerId } = useParams();
  const { data, activeEvent, updateOrderStatus, markRunnerAvailable, setRunnerStatus } = useSeatServe();

  if (!runnerId) {
    return <RunnerSelection runners={data.runners.filter((runner) => runner.active)} activeEventName={activeEvent ? `${activeEvent.name} vs ${activeEvent.opponent}` : undefined} />;
  }

  const runner = data.runners.find((item) => item.id === runnerId);
  if (!runner) return <Navigate to="/runner" replace />;

  const fallbackStatuses = runner.status === "returning" ? ["delivered"] : ["assigned", "delivering"];
  const currentOrder = data.orders.find((order) => order.id === runner.activeOrderId)
    ?? data.orders.find((order) => order.runnerId === runner.id && fallbackStatuses.includes(order.status));
  const currentEventOrders = data.orders.filter((order) => order.eventId === activeEvent?.id);
  const history = currentEventOrders
    .filter((order) => order.runnerId === runner.id && order.status === "delivered")
    .sort((a, b) => new Date(b.deliveredAt ?? b.placedAt).getTime() - new Date(a.deliveredAt ?? a.placedAt).getTime());
  const venue = data.venues.find((item) => item.id === currentOrder?.location.venueId);
  const zone = venue?.zones.find((item) => item.id === currentOrder?.location.zoneId);

  const confirmPickup = () => currentOrder && updateOrderStatus(currentOrder.id, "delivering");
  const markDelivered = () => currentOrder && updateOrderStatus(currentOrder.id, "delivered");
  const confirmReturn = () => markRunnerAvailable(runner.id);

  return (
    <section className="runner-mobile">
      <header className="runner-mobile__welcome">
        <div>
          <p className="runner-kicker">Runner workspace</p>
          <h1>Hi, {firstName(runner.name)}</h1>
          <p>{activeEvent ? `${activeEvent.name} vs ${activeEvent.opponent}` : "No active event is currently selected."}</p>
        </div>
        <StatusPill runner={runner} />
      </header>

      {currentOrder ? (
        <ActiveAssignment
          order={currentOrder}
          runner={runner}
          zoneName={zone?.name ?? "Unknown zone"}
          venueName={venue?.name ?? "Unknown venue"}
          onPickup={confirmPickup}
          onDelivered={markDelivered}
          onReturn={confirmReturn}
        />
      ) : (
        <section className={`runner-state-card ${runner.status === "available" ? "runner-state-card--waiting" : "runner-state-card--offline"}`}>
          {runner.status === "available" ? <div className="runner-pulse"><span /></div> : <div className="runner-state-card__icon"><Smartphone size={30} /></div>}
          <h2>{runner.status === "available" ? "You’re available" : "You’re unavailable"}</h2>
          <p>{runner.status === "available" ? "Stay on this screen. Your next assignment will appear automatically after Kitchen Operations assigns it." : "You will not receive a new assignment until you change your status to Available."}</p>
          <div className="runner-status-controls" role="group" aria-label="Runner availability">
            <button type="button" className={runner.status === "available" ? "is-selected" : ""} onClick={() => setRunnerStatus(runner.id, "available")}>Available</button>
            <button type="button" className={runner.status === "offline" ? "is-selected" : ""} onClick={() => setRunnerStatus(runner.id, "offline")}>Unavailable</button>
          </div>
          {runner.status === "available" && <div className="runner-waiting-meta"><Clock3 size={18} /><span>Available since {formatTime(runner.availableSince)}</span></div>}
        </section>
      )}

      <section className="runner-history">
        <div className="runner-section-heading">
          <div><p className="runner-kicker">Current event</p><h2>Completed deliveries</h2></div>
          <strong>{history.length}</strong>
        </div>
        {history.length === 0 ? <p className="runner-history__empty">No completed deliveries for this event yet.</p> : (
          <div className="runner-history__list">
            {history.map((order) => {
              const orderVenue = data.venues.find((item) => item.id === order.location.venueId);
              const orderZone = orderVenue?.zones.find((item) => item.id === order.location.zoneId);
              return <article key={order.id}><CheckCircle2 size={19} /><div><strong>{order.id}</strong><span>{orderZone?.name ?? "Unknown zone"} · {labelPosition(order)}</span></div><time>{formatTime(order.deliveredAt)}</time><b>${order.total.toFixed(2)}</b></article>;
            })}
          </div>
        )}
      </section>
    </section>
  );
}

function RunnerSelection({ runners, activeEventName }: { runners: Runner[]; activeEventName?: string }) {
  return (
    <section className="runner-select">
      <div className="runner-select__intro">
        <div className="runner-select__icon"><Users size={32} /></div>
        <p className="runner-kicker">Runner access</p>
        <h1>Select your runner profile</h1>
        <p>{activeEventName ?? "No active event"}</p>
      </div>
      <div className="runner-select__grid">
        {runners.map((runner) => (
          <Link to={`/runner/${runner.id}`} key={runner.id} className="runner-profile-card">
            <div className="runner-profile-card__avatar"><UserRound size={26} /></div>
            <div><strong>{runner.name}</strong><span>{runner.role === "lead" ? "Runner lead" : "Runner"}</span></div>
            <StatusPill runner={runner} compact />
            <ChevronRight size={20} />
          </Link>
        ))}
      </div>
      <p className="runner-select__note">This demo uses profile selection. Production access will use staff authentication or the staff QR code.</p>
    </section>
  );
}

function ActiveAssignment({ order, runner, zoneName, venueName, onPickup, onDelivered, onReturn }: { order: Order; runner: Runner; zoneName: string; venueName: string; onPickup: () => void; onDelivered: () => void; onReturn: () => void }) {
  const delivered = order.status === "delivered" || runner.status === "returning";
  return (
    <section className={`runner-assignment runner-assignment--${order.status}`}>
      <div className="runner-assignment__top">
        <div><p className="runner-kicker">Current assignment</p><h2>{order.id}</h2></div>
        <span>{order.status === "assigned" ? "Ready for pickup" : order.status === "delivering" ? "Out for delivery" : "Delivered"}</span>
      </div>

      <div className="runner-destination">
        <div className="runner-destination__icon"><Navigation size={27} /></div>
        <div><small>Deliver to</small><h3>{zoneName}</h3><p>{venueName}</p></div>
      </div>

      <div className="runner-position-grid">
        <div><MapPin size={18} /><span>Vertical position</span><strong>{capitalize(order.location.vertical)}</strong></div>
        <div><Navigation size={18} /><span>Facing the field</span><strong>{capitalize(order.location.horizontal)}</strong></div>
      </div>

      {order.location.notes && <div className="runner-customer-note"><strong>Customer note</strong><p>{order.location.notes}</p></div>}

      <section className="runner-order-items">
        <div className="runner-section-heading"><div><p className="runner-kicker">Order contents</p><h3>{order.customer.name}</h3></div><strong>{order.items.reduce((sum, item) => sum + item.quantity, 0)} items</strong></div>
        {order.items.map((item) => <div className="runner-order-line" key={`${order.id}-${item.menuItemId}`}><span><b>{item.quantity}×</b>{item.name}</span><strong>${(item.unitPrice * item.quantity).toFixed(2)}</strong></div>)}
      </section>

      <div className="runner-assignment__action">
        {order.status === "assigned" && <button type="button" className="runner-primary" onClick={onPickup}><PackageCheck size={21} />Confirm pickup and start delivery<ArrowRight size={20} /></button>}
        {order.status === "delivering" && <button type="button" className="runner-primary runner-primary--success" onClick={onDelivered}><CheckCircle2 size={21} />Mark order delivered<ArrowRight size={20} /></button>}
        {delivered && <button type="button" className="runner-primary runner-primary--return" onClick={onReturn}><RefreshCcw size={21} />I’m back at the kitchen<ArrowRight size={20} /></button>}
        <p>{order.status === "assigned" ? "Confirm after you physically receive the order from the kitchen." : order.status === "delivering" ? "Mark delivered only after handing the order to the customer." : "Returning to the kitchen makes you available for the next order."}</p>
      </div>
    </section>
  );
}

function StatusPill({ runner, compact = false }: { runner: Runner; compact?: boolean }) {
  const label = runner.status === "available" ? "Available" : runner.status === "assigned" ? "Busy" : runner.status === "returning" ? "Returning" : "Unavailable";
  return <span className={`runner-status runner-status--${runner.status} ${compact ? "runner-status--compact" : ""}`}><i />{label}</span>;
}

function firstName(name: string) { return name.trim().split(/\s+/)[0] || name; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function labelPosition(order: Order) { return `${capitalize(order.location.vertical)} ${capitalize(order.location.horizontal)}`; }
function formatTime(value?: string) { return value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "now"; }
