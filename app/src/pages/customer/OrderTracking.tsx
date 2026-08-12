import { Banknote, Check, Clock3, CreditCard, MapPin, PackageCheck, Star, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSeatServe } from "../../state/SeatServeContext";
import "./CustomerOrder.css";

const steps = ["new", "preparing", "ready", "assigned", "delivering", "delivered"] as const;
const names = { new: "Order received", preparing: "Preparing", ready: "Ready for runner", assigned: "Runner assigned", delivering: "On the way", delivered: "Delivered" } as const;
const statusCopy = {
  new: ["Order received", "Your order is waiting for the kitchen.", "15–20 min"],
  preparing: ["Your food is being prepared", "The kitchen is working on your order now.", "10–15 min"],
  ready: ["Your order is ready", "We’re waiting for the next runner.", "5–10 min"],
  assigned: ["Runner assigned", "Your runner is picking up your order.", "4–8 min"],
  delivering: ["Your order is on the way", "Watch for your runner and activate SeatBeacon when they get close.", "Arriving soon"],
  delivered: ["Delivered", "Thank you for using SeatServe.", "Delivered"],
} as const;

export default function OrderTracking() {
  const { orderId } = useParams();
  const { data, submitCustomerFeedback, markSeatBeaconOpened } = useSeatServe();
  const order = data.orders.find((item) => item.id === orderId);
  const [beaconActive, setBeaconActive] = useState(false);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const lastBeaconRequestRef = useRef<string | undefined>(undefined);

  const priorFeedback = useMemo(() => data.feedback.find((item) => item.orderId === orderId), [data.feedback, orderId]);

  useEffect(() => {
    if (order?.status === "delivered") {
      setBeaconActive(false);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(0);
    }
  }, [order?.status]);

  useEffect(() => {
    const requestedAt = order?.seatBeaconRequestedAt;
    if (!requestedAt || order?.status !== "delivering") return;
    const launch = () => {
      if (document.visibilityState !== "visible") return;
      if (requestedAt !== lastBeaconRequestRef.current) lastBeaconRequestRef.current = requestedAt;
      setBeaconActive(true);
      setVibrationEnabled(true);
      if (!order.seatBeaconOpenedAt) markSeatBeaconOpened(order.id);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate([300, 120, 300, 120, 500]); } catch { /* unsupported or blocked */ }
      }
    };
    launch();
    const onVisible = () => launch();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
  }, [order?.id, order?.seatBeaconRequestedAt, order?.seatBeaconOpenedAt, order?.status, markSeatBeaconOpened]);

  useEffect(() => {
    if (!beaconActive || !vibrationEnabled || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    const vibrate = () => {
      try { navigator.vibrate([260, 120, 260]); } catch { /* unsupported or blocked */ }
    };
    vibrate();
    const interval = window.setInterval(vibrate, 3200);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      try { navigator.vibrate(0); } catch { /* unsupported or blocked */ }
    }, 30000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      try { navigator.vibrate(0); } catch { /* unsupported or blocked */ }
    };
  }, [beaconActive, vibrationEnabled]);

  if (!order) return <div className="customer-message"><h1>Order not found</h1><p>Check the order number and try again.</p><Link to="/">Return to SeatServe</Link></div>;

  const event = data.events.find((item) => item.id === order.eventId);
  const venue = data.venues.find((item) => item.id === order.location.venueId);
  const zone = venue?.zones.find((item) => item.id === order.location.zoneId);
  const runner = data.runners.find((item) => item.id === order.runnerId);
  const currentIndex = Math.max(0, steps.indexOf(order.status === "cancelled" ? "new" : order.status));
  const settings = data.customerExperience;
  const copy = statusCopy[order.status === "cancelled" ? "new" : order.status];

  const submit = () => {
    if (!priorFeedback) submitCustomerFeedback({ orderId: order.id, eventId: order.eventId, rating: rating || undefined, comments: comments.trim() || undefined });
    setSubmitted(true);
  };

  const activateBeacon = () => {
    markSeatBeaconOpened(order.id);
    setBeaconActive(true);
    setVibrationEnabled(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate([300, 120, 300, 120, 500]); } catch { /* unsupported or blocked */ }
    }
  };

  const closeBeacon = () => {
    setBeaconActive(false);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(0); } catch { /* unsupported or blocked */ }
    }
  };

  if (order.status === "delivered") {
    return <div className="customer-shell customer-shell--delivered">
      <CustomerHeader orderId={order.id}/>
      <main className="customer-main customer-main--thank-you">
        <section className="thank-you-card">
          <div className="thank-you-card__check"><Check size={34}/></div>
          <p>Delivered</p>
          <h1>{settings.headline}</h1>
          <h2>{settings.schoolMessage}</h2>
          <span>{settings.message}</span>
          {!submitted && !priorFeedback ? <>
            {settings.showRating && <div className="feedback-block"><h3>{settings.ratingPrompt}</h3><div className="star-rating" aria-label="Customer rating">{[1,2,3,4,5].map((value) => <button key={value} aria-label={`${value} stars`} className={value <= rating ? "is-selected" : ""} onClick={() => setRating(value)}><Star size={30} fill={value <= rating ? "currentColor" : "none"}/></button>)}</div></div>}
            {settings.showComments && <label className="feedback-comments"><span>{settings.commentsPrompt}</span><textarea rows={3} value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Tell us how we can improve"/></label>}
          </> : <div className="feedback-thanks"><Check size={20}/><span>Thanks for helping us improve.</span></div>}
          <div className="community-support"><h3>{settings.supportTitle}</h3><div>{settings.supportLinks.filter((link) => link.enabled && link.url.trim()).map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer"><span>{link.icon}</span>{link.label}</a>)}</div></div>
          {!submitted && !priorFeedback ? <button className="customer-primary thank-you-finish" onClick={submit}>{settings.finishLabel}</button> : <Link className="customer-primary thank-you-finish" to="/">Done</Link>}
        </section>
      </main>
    </div>;
  }

  return <div className="customer-shell">
    <CustomerHeader orderId={order.id}/>
    <main className="customer-main">
      <section className={`tracking-hero tracking-hero--${order.status}`}><span><PackageCheck size={30}/></span><p>Thanks, {order.customer.name}</p><h1>{copy[0]}</h1><strong>{copy[2]}</strong><small>{copy[1]}</small>{runner && order.status !== "new" && order.status !== "preparing" && order.status !== "ready" && <div className="tracking-runner">Runner: <b>{runner.name}</b></div>}</section>
      {order.status === "delivering" && order.fulfillmentMethod !== "pickup" && <section className={`seatbeacon-callout ${order.seatBeaconRequestedAt ? "is-requested" : ""}`}><div><strong>{order.seatBeaconRequestedAt ? "Your runner is looking for you" : "Runner approaching your zone"}</strong><span>{order.seatBeaconRequestedAt ? "SeatBeacon should start automatically when this screen is awake. Hold your phone up." : "Activate SeatBeacon when your runner is nearby."}</span></div>{!order.seatBeaconRequestedAt && <button onClick={activateBeacon}>{settings.mascotSymbol} Activate SeatBeacon</button>}{order.seatBeaconRequestedAt && !beaconActive && <button onClick={activateBeacon}>{settings.mascotSymbol} Start SeatBeacon</button>}</section>}
      <section className="customer-panel"><div className="tracking-context"><div><Clock3 size={18}/><span>{event?.name} vs {event?.opponent}</span></div><div><MapPin size={18}/><span>{order.fulfillmentMethod === "pickup" ? `${settings.pickupLocationName} · Window Pickup` : `${zone?.name} · ${order.location.vertical} ${order.location.horizontal}`}</span></div></div><div className="tracking-steps">{steps.map((step, index) => <div className={`tracking-step ${index <= currentIndex ? "is-complete" : ""}`} key={step}><span>{index <= currentIndex ? <Check size={15}/> : index + 1}</span><div><strong>{names[step]}</strong>{index === currentIndex && <small>Current status</small>}</div></div>)}</div><div className="tracking-order"><h2>Order summary</h2>{order.items.map((item, index) => <div key={`${item.menuItemId}-${index}`}><span>{item.quantity} × {item.name}{item.condiments?.length ? <small> · {item.condiments.join(", ")}</small> : null}</span><strong>${(item.unitPrice * item.quantity).toFixed(2)}</strong></div>)}<div className="tracking-total"><span>Total</span><strong>${order.total.toFixed(2)}</strong></div></div>{order.paymentMethod && <div className={`tracking-payment tracking-payment--${order.paymentMethod}`}>{order.paymentMethod === "card" ? <CreditCard size={20}/> : <Banknote size={20}/>}<div><small>Payment at delivery</small><strong>{order.paymentMethod === "card" ? "Credit card" : "Exact cash"}</strong><span>{order.paymentCollectedAt ? "Payment collected" : order.paymentMethod === "cash" ? `Please have $${(order.cashTotal ?? order.total).toFixed(2)} in exact cash ready.` : `Your runner will collect $${(order.cardTotal ?? order.total).toFixed(2)} by card.`}</span></div></div>}</section>
    </main>
    {beaconActive && <div className="seatbeacon" style={{ "--beacon-primary": settings.primaryColor, "--beacon-secondary": settings.secondaryColor } as React.CSSProperties}><button className="seatbeacon__close" onClick={closeBeacon} aria-label="Close SeatBeacon"><X size={28}/></button><div className="seatbeacon__content"><span className="seatbeacon__mascot">{settings.mascotSymbol}</span><p>SeatBeacon Active</p><strong>{order.id}</strong><small>{order.customerLocatedAt ? "Your runner found you. Please keep your phone visible until handoff." : "Hold your phone up so your runner can find you."}</small><div className="seatbeacon__attention"><span>Screen flashing automatically</span>{typeof navigator !== "undefined" && "vibrate" in navigator ? <button type="button" onClick={() => setVibrationEnabled((current) => !current)}>{vibrationEnabled ? "Stop vibration" : "Start vibration"}</button> : <span className="seatbeacon__unsupported">Vibration is not supported by this browser.</span>}</div></div></div>}
  </div>;
}

function CustomerHeader({ orderId }: { orderId: string }) {
  return <header className="customer-header"><div className="customer-header__inner"><img className="customer-brand__logo" src="/seatserve-web-logo.png" alt="SeatServe"/><div className="customer-zone">Order {orderId}</div></div></header>;
}
