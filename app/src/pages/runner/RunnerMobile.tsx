import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Copy,
  MessageCircle,
  MapPin,
  Navigation,
  PackageCheck,
  RefreshCcw,
  RefreshCw,
  Smartphone,
  Radio,
  LocateFixed,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useSeatServe, MAX_RUNNER_ORDERS } from "../../state/SeatServeContext";
import type { Order, Runner } from "../../types/domain";
import { getSyncMeta, pullFromGoogleSheets, type SyncMeta } from "../../services/persistence";
import "./RunnerMobile.css";

export default function RunnerMobile() {
  const { runnerId } = useParams();
  const { data, replaceData, activeEvent, updateOrderStatus, markOrderPaymentCollected, requestSeatBeacon, markCustomerLocated, markRunnerAvailable, setRunnerStatus, assignRunnerToOrder, refreshLiveOperationalData } = useSeatServe();
  const [syncMeta, setSyncMeta] = useState<SyncMeta>(() => getSyncMeta());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");

  useEffect(() => {
    const metaHandler = (event: Event) => setSyncMeta((event as CustomEvent<SyncMeta>).detail ?? getSyncMeta());
    window.addEventListener("seatserve:sync-meta", metaHandler);
    return () => window.removeEventListener("seatserve:sync-meta", metaHandler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (cancelled || document.visibilityState !== "visible" || !navigator.onLine) return;
      try { await refreshLiveOperationalData(); } catch (error) { console.error("Runner live refresh failed", error); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1500);
    const onFocus = () => void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisible); };
  }, [refreshLiveOperationalData]);

  const loadLatest = async () => {
    setIsSyncing(true);
    setSyncNotice("");
    try {
      const result = await pullFromGoogleSheets(data);
      if (result.data) {
        replaceData(result.data, "Runner loaded latest cloud data");
        setSyncNotice("Latest data loaded from Google Sheets.");
      } else {
        setSyncNotice("Runner data is already up to date.");
      }
    } catch (error) {
      setSyncNotice(error instanceof Error ? `Load failed: ${error.message}` : "Load from Sheets failed.");
    } finally {
      setIsSyncing(false);
      window.setTimeout(() => setSyncNotice(""), 5000);
    }
  };

  if (!runnerId) {
    return <RunnerSelection runners={data.runners.filter((runner) => runner.active)} activeEventName={activeEvent ? `${activeEvent.name} vs ${activeEvent.opponent}` : undefined} />;
  }

  const runner = data.runners.find((item) => item.id === runnerId);
  if (!runner) return <Navigate to="/runner" replace />;

  const activeOrders = runner.activeOrderIds
    .map((id) => data.orders.find((order) => order.id === id))
    .filter((order): order is Order => Boolean(order));
  const allDelivered = activeOrders.length > 0 && activeOrders.every((order) => order.status === "delivered");
  const currentEventOrders = data.orders.filter((order) => order.eventId === activeEvent?.id);
  const history = currentEventOrders
    .filter((order) => order.runnerId === runner.id && order.status === "delivered")
    .sort((a, b) => new Date(b.deliveredAt ?? b.placedAt).getTime() - new Date(a.deliveredAt ?? a.placedAt).getTime());
  const pickupCandidates = runner.active && runner.status !== "offline" && runner.status !== "returning" && activeOrders.length < MAX_RUNNER_ORDERS
    ? currentEventOrders.filter((order) => order.status === "ready" && !order.runnerId && order.fulfillmentMethod !== "pickup")
    : [];

  const confirmPickup = (orderId: string) => updateOrderStatus(orderId, "delivering");
  const markDelivered = (orderId: string) => updateOrderStatus(orderId, "delivered");
  const confirmPayment = (orderId: string) => markOrderPaymentCollected(orderId);
  const requestBeacon = (orderId: string) => requestSeatBeacon(orderId);
  const customerLocated = (orderId: string) => markCustomerLocated(orderId);
  const confirmReturn = () => markRunnerAvailable(runner.id);
  const pickUpOrder = (orderId: string) => assignRunnerToOrder(orderId, runner.id);

  return (
    <section className="runner-mobile">
      <header className="runner-mobile__welcome">
        <div>
          <p className="runner-kicker">Runner workspace</p>
          <h1>Hi, {firstName(runner.name)}</h1>
          <p>{activeEvent ? `${activeEvent.name} vs ${activeEvent.opponent}` : "No active event is currently selected."}</p>
        </div>
        <div className="runner-mobile__sync-tools">
          <StatusPill runner={runner} />
          <button type="button" className="runner-load-button" onClick={() => void loadLatest()} disabled={isSyncing}>
            <RefreshCw size={16} className={isSyncing ? "is-syncing" : ""} />
            {isSyncing ? "Loading..." : "Load from Sheets"}
          </button>
          <small>Last sync: {syncMeta.lastSuccessfulSyncAt ? new Date(syncMeta.lastSuccessfulSyncAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "never"}</small>
        </div>
      </header>
      {syncNotice && <div className={`runner-sync-notice${syncNotice.toLowerCase().includes("failed") ? " is-error" : ""}`}>{syncNotice}</div>}

      {activeOrders.length > 0 ? (
        <>
          {activeOrders.length > 1 && <div className="runner-batch-heading"><Users size={17} /><span>Carrying {activeOrders.length} orders</span></div>}
          {activeOrders.map((order) => {
            const venue = data.venues.find((item) => item.id === order.location.venueId);
            const zone = venue?.zones.find((item) => item.id === order.location.zoneId);
            return (
              <ActiveAssignment
                key={order.id}
                order={order}
                zoneName={zone?.name ?? "Unknown zone"}
                venueName={venue?.name ?? "Unknown venue"}
                onPickup={() => confirmPickup(order.id)}
                onDelivered={() => markDelivered(order.id)}
                onPaymentCollected={() => confirmPayment(order.id)}
                onRequestBeacon={() => requestBeacon(order.id)}
                onCustomerLocated={() => customerLocated(order.id)}
              />
            );
          })}
          {allDelivered && (
            <section className="runner-return-card">
              <CheckCircle2 size={22} />
              <div><strong>All caught up</strong><p>{activeOrders.length > 1 ? "Every order in this run has been delivered." : "This order has been delivered."}</p></div>
              <button type="button" className="runner-primary runner-primary--return" onClick={confirmReturn}><RefreshCcw size={21} />I’m back at the kitchen<ArrowRight size={20} /></button>
            </section>
          )}
          {!allDelivered && pickupCandidates.length > 0 && (
            <PickupList orders={pickupCandidates} data={data} onPickUp={pickUpOrder} capacityLeft={MAX_RUNNER_ORDERS - activeOrders.length} />
          )}
        </>
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
      {runner.status === "available" && activeOrders.length === 0 && pickupCandidates.length > 0 && (
        <PickupList orders={pickupCandidates} data={data} onPickUp={pickUpOrder} capacityLeft={MAX_RUNNER_ORDERS} />
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

function PickupList({ orders, data, onPickUp, capacityLeft }: { orders: Order[]; data: ReturnType<typeof useSeatServe>["data"]; onPickUp: (orderId: string) => void; capacityLeft: number }) {
  return (
    <section className="runner-pickup-list">
      <div className="runner-section-heading">
        <div><p className="runner-kicker">Ready for pickup</p><h2>Add to your run</h2></div>
        <strong>{capacityLeft} more{capacityLeft === 1 ? "" : ""}</strong>
      </div>
      <div className="runner-pickup-list__items">
        {orders.map((order) => {
          const venue = data.venues.find((item) => item.id === order.location.venueId);
          const zone = venue?.zones.find((item) => item.id === order.location.zoneId);
          return (
            <article key={order.id} className="runner-pickup-item">
              <div><strong>{order.id}</strong><span>{zone?.name ?? "Unknown zone"} · {labelPosition(order)}</span></div>
              <button type="button" onClick={() => onPickUp(order.id)}>Add to my run<ArrowRight size={16} /></button>
            </article>
          );
        })}
      </div>
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

function ActiveAssignment({ order, zoneName, venueName, onPickup, onDelivered, onPaymentCollected, onRequestBeacon, onCustomerLocated }: { order: Order; zoneName: string; venueName: string; onPickup: () => void; onDelivered: () => void; onPaymentCollected: () => void; onRequestBeacon: () => void; onCustomerLocated: () => void }) {
  const requiresPayment = order.paymentMethod === "cash" || order.paymentMethod === "card";
  const paymentCollected = Boolean(order.paymentCollectedAt) || !requiresPayment;
  const paymentAmount = order.paymentMethod === "card" ? (order.cardTotal ?? order.total) : (order.cashTotal ?? order.total);
  const paymentLabel = order.paymentMethod === "card" ? "Credit card at delivery" : order.paymentMethod === "cash" ? "Exact cash at delivery" : "Payment not specified";
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

      {order.customer.mobile && <div className="runner-customer-note"><strong>Customer contact</strong><p>{order.customer.mobile}</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" onClick={() => navigator.clipboard.writeText(order.customer.mobile || "")}><Copy size={15}/> Copy number</button><a href={`sms:${order.customer.mobile}`} style={{display:"inline-flex",alignItems:"center",gap:6}}><MessageCircle size={15}/> Text customer</a></div></div>}
      {order.location.notes && <div className="runner-customer-note"><strong>Customer note</strong><p>{order.location.notes}</p></div>}

      {order.status === "delivering" && <section className="runner-seatbeacon"><div><Radio size={24}/><span><small>SeatBeacon</small><strong>{order.seatBeaconOpenedAt ? "Customer beacon active" : order.seatBeaconRequestedAt ? "Beacon requested" : "Help locate customer"}</strong></span></div><div className="runner-seatbeacon__actions"><button type="button" onClick={onRequestBeacon}><Radio size={17}/> {order.seatBeaconRequestedAt ? "Request again" : "Request SeatBeacon"}</button><button type="button" className={order.customerLocatedAt ? "is-complete" : ""} onClick={onCustomerLocated}><LocateFixed size={17}/> {order.customerLocatedAt ? "Customer located" : "Customer Located"}</button></div></section>}

      <section className={`runner-payment ${order.paymentMethod === "card" ? "runner-payment--card" : "runner-payment--cash"}`}>
        <div className="runner-payment__icon">{order.paymentMethod === "card" ? <CreditCard size={25}/> : <Banknote size={25}/>}</div>
        <div className="runner-payment__copy"><small>Payment due at delivery</small><h3>{paymentLabel}</h3><p>{order.paymentMethod === "cash" ? `Collect exactly $${paymentAmount.toFixed(2)} from the customer.` : order.paymentMethod === "card" ? `Collect $${paymentAmount.toFixed(2)} by card before completing delivery.` : `Order total: $${paymentAmount.toFixed(2)}`}</p></div>
        <strong>${paymentAmount.toFixed(2)}</strong>
        {requiresPayment && !paymentCollected && order.status === "delivering" && <button type="button" onClick={onPaymentCollected}>{order.paymentMethod === "cash" ? "Confirm cash received" : "Confirm card payment"}</button>}
        {requiresPayment && paymentCollected && <span className="runner-payment__paid"><CheckCircle2 size={16}/> Payment collected</span>}
      </section>

      <section className="runner-order-items">
        <div className="runner-section-heading"><div><p className="runner-kicker">Order contents</p><h3>{order.customer.name}</h3></div><strong>{order.items.reduce((sum, item) => sum + item.quantity, 0)} items</strong></div>
        {order.items.map((item) => <div className="runner-order-line" key={`${order.id}-${item.menuItemId}`}><span><b>{item.quantity}×</b>{item.name}</span><strong>${(item.unitPrice * item.quantity).toFixed(2)}</strong></div>)}
      </section>

      <div className="runner-assignment__action">
        {order.status === "assigned" && <button type="button" className="runner-primary" onClick={onPickup}><PackageCheck size={21} />Confirm pickup and start delivery<ArrowRight size={20} /></button>}
        {order.status === "delivering" && <button type="button" className="runner-primary runner-primary--success" onClick={onDelivered} disabled={!paymentCollected}><CheckCircle2 size={21} />{paymentCollected ? "Mark order delivered" : "Collect payment before delivery"}<ArrowRight size={20} /></button>}
        {order.status === "delivered" && <div className="runner-assignment__delivered"><CheckCircle2 size={20} /><span>Delivered</span></div>}
        <p>{order.status === "assigned" ? "Confirm after you physically receive the order from the kitchen." : order.status === "delivering" ? (paymentCollected ? "Mark delivered only after handing the order to the customer." : "Confirm payment collection before marking the order delivered.") : "This order is complete."}</p>
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
