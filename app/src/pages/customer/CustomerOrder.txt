import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock3,
  CreditCard,
  MapPin,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSeatServe } from "../../state/SeatServeContext";
import type { FulfillmentMethod, HorizontalLocation, MenuItem, PaymentMethod, VerticalLocation } from "../../types/domain";
import "./CustomerOrder.css";

type CartEntry = { quantity: number; condiments: string[] };
type Cart = Record<string, CartEntry>;
type Step = "location" | "menu" | "cart" | "checkout";

const stepOrder: Step[] = ["location", "menu", "cart", "checkout"];
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const labels = { top: "Top", middle: "Middle", bottom: "Bottom", left: "Left", center: "Center", right: "Right" } as const;
const categoryIcon = (category: string) => {
  const normalized = category.toLowerCase();
  if (normalized.includes("drink") || normalized.includes("beverage")) return "🥤";
  if (normalized.includes("snack") || normalized.includes("popcorn")) return "🍿";
  if (normalized.includes("candy")) return "🍬";
  if (normalized.includes("dessert")) return "🍪";
  return "🍔";
};

export default function CustomerOrder() {
  const { eventId, venueId, zoneId } = useParams();
  const navigate = useNavigate();
  const { data, placeOrder } = useSeatServe();
  const event = data.events.find((item) => item.id === eventId);
  const venue = data.venues.find((item) => item.id === venueId);
  const zone = venue?.zones.find((item) => item.id === zoneId);
  const storageKey = `seatserve-customer-cart:v2:${eventId ?? "unknown"}:${zoneId ?? "unknown"}`;

  const [step, setStep] = useState<Step>("location");
  const [vertical, setVertical] = useState<VerticalLocation | "">("");
  const [horizontal, setHorizontal] = useState<HorizontalLocation | "">("");
  const [cart, setCart] = useState<Cart>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, CartEntry | number>;
      return Object.fromEntries(Object.entries(parsed).map(([id, value]) => [id, typeof value === "number" ? { quantity: value, condiments: [] } : value]));
    } catch {
      return {};
    }
  });
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ Drinks: true });
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);
  const [selectedCondiments, setSelectedCondiments] = useState<string[]>([]);
  const [customQuantity, setCustomQuantity] = useState(1);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [notes, setNotes] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(data.customerExperience.cashPaymentsEnabled ? "cash" : "card");
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>("delivery");

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(cart)); return undefined; }, [cart, storageKey]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); return undefined; }, [step]);
  useEffect(() => {
    if (paymentMethod === "cash" && !data.customerExperience.cashPaymentsEnabled && data.customerExperience.cardPaymentsEnabled) setPaymentMethod("card");
    if (paymentMethod === "card" && !data.customerExperience.cardPaymentsEnabled && data.customerExperience.cashPaymentsEnabled) setPaymentMethod("cash");
    return undefined;
  }, [data.customerExperience.cardPaymentsEnabled, data.customerExperience.cashPaymentsEnabled, paymentMethod]);

  const available = Boolean(event?.orderingEnabled && venue?.active && zone?.active && zone?.deliveryEnabled);
  const assignedMenu = data.menus.find((menu) => menu.id === event?.menuId && menu.active);
  const allowedItemIds = assignedMenu ? new Set(assignedMenu.itemIds.filter((id) => !(assignedMenu.hiddenItemIds ?? []).includes(id))) : undefined;
  const visibleCategories = [...data.menuCategories].filter((entry) => entry.visible).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const categories = ["All", ...visibleCategories.map((entry) => entry.name)];
  const filteredItems = data.menuItems.filter((item) =>
    (!allowedItemIds || allowedItemIds.has(item.id)) &&
    (category === "All" || item.category === category) &&
    (!query.trim() || `${item.name} ${item.description ?? ""} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const groupedItems = useMemo(() => visibleCategories.map((entry) => [entry.name, filteredItems.filter((item) => item.categoryId === entry.id || item.category === entry.name)] as const).filter(([, items]) => items.length > 0), [filteredItems, visibleCategories]);
  const cartLines = useMemo(() => Object.entries(cart)
    .map(([id, entry]) => ({ item: data.menuItems.find((menuItem) => menuItem.id === id), entry }))
    .filter((line): line is { item: MenuItem; entry: CartEntry } => Boolean(line.item && line.entry.quantity > 0)), [cart, data.menuItems]);
  const cartCount = cartLines.reduce((sum, line) => sum + line.entry.quantity, 0);
  const subtotal = cartLines.reduce((sum, line) => sum + line.item.price * line.entry.quantity, 0);
  const configuredDeliveryFee = Number.isFinite(data.customerExperience.deliveryFee) ? Math.max(0, data.customerExperience.deliveryFee) : 0;
  const deliveryFee = subtotal > 0 && fulfillmentMethod === "delivery" ? configuredDeliveryFee : 0;
  const taxRate = Math.max(0, data.customerExperience.taxRatePercent || 0) / 100;
  const tax = Number((subtotal * taxRate).toFixed(2));
  const cashTotal = Number((subtotal + deliveryFee + tax).toFixed(2));
  const estimatedCardFee = cashTotal > 0 ? Number((cashTotal * Math.max(0, data.customerExperience.estimatedCardFeePercent || 0) / 100 + Math.max(0, data.customerExperience.estimatedCardFeeFixed || 0)).toFixed(2)) : 0;
  const cardTotal = Number((cashTotal + estimatedCardFee).toFixed(2));
  const total = paymentMethod === "card" ? cardTotal : cashTotal;
  const currentStep = stepOrder.indexOf(step) + 1;

  const changeQuantity = (id: string, delta: number) => setCart((current) => {
    const currentEntry = current[id] ?? { quantity: 0, condiments: [] };
    const quantity = Math.max(0, currentEntry.quantity + delta);
    if (quantity === 0) {
      const next = { ...current };
      delete next[id];
      return next;
    }
    return { ...current, [id]: { ...currentEntry, quantity } };
  });

  const openCustomizer = (item: MenuItem) => {
    const current = cart[item.id];
    setCustomizing(item);
    setCustomQuantity(current?.quantity ?? 1);
    setSelectedCondiments(current?.condiments ?? []);
  };
  const saveCustomization = () => {
    if (!customizing) return;
    setCart((current) => ({ ...current, [customizing.id]: { quantity: customQuantity, condiments: selectedCondiments } }));
    setCustomizing(null);
  };

  const submit = () => {
    setSubmitAttempted(true);
    if (!event || !venue || !zone || !vertical || !horizontal || !name.trim() || cartLines.length === 0) return;
    if (paymentMethod === "cash" && !data.customerExperience.cashPaymentsEnabled) return;
    if (paymentMethod === "card" && !data.customerExperience.cardPaymentsEnabled) return;
    const orderId = placeOrder({
      eventId: event.id,
      fulfillmentMethod,
      items: cartLines.map(({ item, entry }) => ({ menuItemId: item.id, name: item.name, unitPrice: item.price, quantity: entry.quantity, condiments: entry.condiments })),
      customer: { name: name.trim(), mobile: mobile.trim() || undefined },
      location: { venueId: venue.id, zoneId: zone.id, vertical, horizontal, notes: notes.trim() || undefined },
      subtotal, tax, deliveryFee, total, paymentMethod, cashTotal, estimatedCardFee, cardTotal,
    });
    localStorage.removeItem(storageKey);
    navigate(`/order/track/${orderId}`);
  };

  if (!event || !venue || !zone) return <CustomerMessage title="This QR code is not valid" message="Ask a SeatServe staff member for the correct zone QR code." />;
  if (!available) return <CustomerMessage title="Ordering is currently closed" message={`${event.name} vs ${event.opponent} is not accepting delivery orders for ${zone.name} right now.`} />;

  return (
    <div className="customer-shell">
      <header className="customer-header"><div className="customer-header__inner">
        <div className="customer-brand"><img src="/seatserve-web-logo.png" alt="SeatServe" className="customer-brand__logo" /></div>
        <div className="customer-zone"><MapPin size={16} /><span>{zone.name}</span></div>
      </div></header>
      <main className="customer-main">
        <section className="customer-event-card"><div><p>{event.name}</p><h1>{event.name} vs {event.opponent}</h1><span><Check size={15} /> Ordering open · {venue.name}</span></div><div className="customer-event-card__eta"><Clock3 size={18} /><strong>About 8–12 min</strong><small>Estimated delivery</small></div></section>
        <nav className="customer-progress" aria-label="Order progress">{stepOrder.map((item, index) => <div key={item} className={index + 1 <= currentStep ? "is-active" : ""}><span>{index + 1 < currentStep ? <Check size={14} /> : index + 1}</span><small>{item === "location" ? "Location" : item === "menu" ? "Menu" : item === "cart" ? "Cart" : "Checkout"}</small></div>)}</nav>

        {step === "location" && <section className="customer-panel customer-location-panel">
          <div className="customer-step-label">Location confirmed by zone QR</div><h2>Where are you within {zone.name}?</h2><p className="customer-help">Choose your position while you are facing the field.</p>
          <div className="location-guide"><div className="location-guide__field">FIELD</div><div className="location-guide__grid">{(["bottom", "middle", "top"] as VerticalLocation[]).flatMap((row) => (["left", "center", "right"] as HorizontalLocation[]).map((column) => <button type="button" key={`${row}-${column}`} className={vertical === row && horizontal === column ? "is-selected" : ""} onClick={() => { setVertical(row); setHorizontal(column); }}><strong>{labels[row]}</strong><span>{labels[column]}</span></button>))}</div><p><ArrowRight size={15} /> Left and right are based on facing the field.</p></div>
          {vertical && horizontal && <div className="location-confirm"><MapPin size={19} /><div><small>Your delivery location</small><strong>{zone.name} · {labels[vertical]} {labels[horizontal]}</strong></div></div>}
          <button className="customer-primary" disabled={!vertical || !horizontal} onClick={() => setStep("menu")}>Browse menu <ArrowRight size={18} /></button>
        </section>}

        {step === "menu" && <section className="customer-panel customer-panel--menu">
          <div className="customer-section-heading"><div><button className="customer-back" onClick={() => setStep("location")}><ChevronLeft size={18} /> Location</button><h2>What can we bring you?</h2></div><div className="customer-location-chip"><MapPin size={15} /> {labels[vertical as VerticalLocation]} {labels[horizontal as HorizontalLocation]}</div></div>
          <label className="customer-search"><Search size={18} /><input placeholder="Search food and drinks" value={query} onChange={(event_) => setQuery(event_.target.value)} /></label>
          <div className="category-scroll">{categories.map((item) => <button key={item} className={category === item ? "is-selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
          <div className="compact-menu-list">
            {groupedItems.map(([group, items]) => {
              const expanded = expandedGroups[group] ?? true;
              return <section className="compact-menu-group" key={group}>
                <button className="compact-menu-group__header" onClick={() => setExpandedGroups((current) => ({ ...current, [group]: !expanded }))}><span><b>{visibleCategories.find((entry) => entry.name === group)?.emoji || categoryIcon(group)}</b><strong>{group}</strong><small>{items.length} choices</small></span>{expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
                {expanded && <div className="compact-menu-group__items">{items.map((item) => {
                  const quantity = cart[item.id]?.quantity ?? 0;
                  const hasCondiments = Boolean(item.condiments?.length);
                  return <article className={`compact-menu-row ${!item.available ? "is-sold-out" : ""}`} key={item.id}>
                    <div className="compact-menu-row__visual">{item.imageUrl && item.displayStyle !== "emoji" ? <img src={item.imageUrl} alt={item.imageAlt || item.name}/> : <span>{item.emoji || visibleCategories.find((entry) => entry.name === item.category)?.emoji || categoryIcon(item.category)}</span>}</div>
                    <div className="compact-menu-row__copy"><div><strong>{item.name}</strong>{!item.available && <em>Sold out</em>}</div><p>{item.description || "Fresh from the concession stand."}</p>{cart[item.id]?.condiments.length ? <small>Condiments: {cart[item.id].condiments.join(", ")}</small> : null}</div>
                    <strong className="compact-menu-row__price">{money(item.price)}</strong>
                    {item.available && (hasCondiments ? <button className="compact-customize" onClick={() => openCustomizer(item)}>{quantity ? `Edit · ${quantity}` : "Customize"}</button> : <div className="quantity-control"><button aria-label={`Remove one ${item.name}`} onClick={() => changeQuantity(item.id, -1)}><Minus size={16} /></button><strong>{quantity}</strong><button aria-label={`Add one ${item.name}`} onClick={() => changeQuantity(item.id, 1)}><Plus size={16} /></button></div>)}
                  </article>;
                })}</div>}
              </section>;
            })}
            {groupedItems.length === 0 && <div className="customer-empty"><Search size={22} /><strong>No menu items found</strong><span>Try another search or category.</span></div>}
          </div>
          {cartCount > 0 && <button className="floating-cart" onClick={() => setStep("cart")}><span><ShoppingBag size={19} /> View cart <em>{cartCount}</em></span><strong>{money(total)}</strong></button>}
        </section>}

        {step === "cart" && <section className="customer-panel"><button className="customer-back" onClick={() => setStep("menu")}><ChevronLeft size={18} /> Menu</button><h2>Review your order</h2><p className="customer-help">Your cart is saved on this device while you finish ordering.</p><div className="cart-list">{cartLines.map(({ item, entry }) => <div className="cart-line" key={item.id}><div className="cart-line__icon">{item.imageUrl && item.displayStyle !== "emoji" ? <img src={item.imageUrl} alt=""/> : item.emoji || visibleCategories.find((entry) => entry.name === item.category)?.emoji || categoryIcon(item.category)}</div><div><strong>{item.name}</strong><small>{money(item.price)} each</small>{entry.condiments.length > 0 && <small>Condiments: {entry.condiments.join(", ")}</small>}</div><div className="quantity-control"><button onClick={() => changeQuantity(item.id, -1)}><Minus size={15} /></button><strong>{entry.quantity}</strong><button onClick={() => changeQuantity(item.id, 1)}><Plus size={15} /></button></div><strong>{money(item.price * entry.quantity)}</strong></div>)}</div><OrderTotals subtotal={subtotal} deliveryFee={deliveryFee} tax={tax} cashTotal={cashTotal} estimatedCardFee={estimatedCardFee} cardTotal={cardTotal} /><button className="customer-primary" disabled={cartLines.length === 0} onClick={() => setStep("checkout")}>Continue to checkout <ArrowRight size={18} /></button></section>}

        {step === "checkout" && <section className="customer-panel"><button className="customer-back" onClick={() => setStep("cart")}><ChevronLeft size={18} /> Cart</button><h2>Checkout</h2>{data.customerExperience.pickupEnabled && <div className="payment-methods"><h3>How do you want your order?</h3><button type="button" className={fulfillmentMethod === "delivery" ? "is-selected" : ""} onClick={() => setFulfillmentMethod("delivery")}><MapPin size={22}/><span><strong>Deliver to my zone</strong><small>{zone.name} · {vertical && labels[vertical]} {horizontal && labels[horizontal]}</small></span><em>{money(configuredDeliveryFee)}</em></button><button type="button" className={fulfillmentMethod === "pickup" ? "is-selected" : ""} onClick={() => setFulfillmentMethod("pickup")}><ShoppingBag size={22}/><span><strong>Window Pickup</strong><small>{data.customerExperience.pickupLocationName}</small></span><em>Free</em></button></div>}{fulfillmentMethod === "delivery" ? <div className="delivery-summary"><MapPin size={20} /><div><strong>{zone.name} · {vertical && labels[vertical]} {horizontal && labels[horizontal]}</strong><span>Directions are relative to facing the field.</span></div></div> : <div className="delivery-summary"><ShoppingBag size={20}/><div><strong>{data.customerExperience.pickupLocationName}</strong><span>{data.customerExperience.pickupInstructions}</span></div></div>}<label className="customer-field"><span>Name for the order *</span><input className={submitAttempted && !name.trim() ? "is-invalid" : ""} value={name} onChange={(event_) => setName(event_.target.value)} autoComplete="name" placeholder="First and last name" />{submitAttempted && !name.trim() && <small>Please enter a name for the order.</small>}</label><label className="customer-field"><span>Mobile number <em>Optional</em></span><div className="input-with-icon"><Smartphone size={17} /><input value={mobile} onChange={(event_) => setMobile(event_.target.value)} inputMode="tel" autoComplete="tel" placeholder="For order updates" /></div></label><label className="customer-field"><span>Help your runner find you <em>Optional</em></span><textarea value={notes} onChange={(event_) => setNotes(event_.target.value)} placeholder="Jacket color, aisle marker, or another helpful detail" rows={3} maxLength={180} /><small>{notes.length}/180</small></label><div className="payment-methods"><h3>Payment at delivery</h3>{data.customerExperience.cashPaymentsEnabled && <button type="button" className={paymentMethod === "cash" ? "is-selected" : ""} onClick={() => setPaymentMethod("cash")}><Banknote size={22}/><span><strong>Pay exact cash</strong><small>Have {money(cashTotal)} in exact cash ready when you {fulfillmentMethod === "pickup" ? "pick up your order" : "meet your runner"}.</small></span><em>{money(cashTotal)}</em></button>}{data.customerExperience.cardPaymentsEnabled && <button type="button" className={paymentMethod === "card" ? "is-selected" : ""} onClick={() => setPaymentMethod("card")}><CreditCard size={22}/><span><strong>Pay by credit card at delivery</strong><small>Estimated card fee included. {fulfillmentMethod === "pickup" ? "The pickup window" : "Your runner"} will collect {money(cardTotal)} by card.</small></span><em>{money(cardTotal)}</em></button>}{!data.customerExperience.cashPaymentsEnabled && !data.customerExperience.cardPaymentsEnabled && <div className="payment-methods__warning">Payment methods are currently disabled. Please contact SeatServe staff.</div>}</div><div className="demo-payment"><ShieldCheck size={21} /><div><strong>Payment collected {fulfillmentMethod === "pickup" ? "at pickup" : "at delivery"}</strong><span>No online card information is entered in SeatServe.</span></div></div><OrderTotals subtotal={subtotal} deliveryFee={deliveryFee} tax={tax} cashTotal={cashTotal} estimatedCardFee={estimatedCardFee} cardTotal={cardTotal} /><button className="customer-primary" disabled={!name.trim() || cartLines.length === 0 || (!data.customerExperience.cashPaymentsEnabled && !data.customerExperience.cardPaymentsEnabled)} onClick={submit}>Place order · {money(total)} <ArrowRight size={18} /></button><p className="checkout-trust"><Sparkles size={14} /> You can track the order immediately after checkout.</p></section>}
      </main>

      {customizing && <div className="customer-sheet-backdrop" onMouseDown={() => setCustomizing(null)}><section className="customer-sheet" onMouseDown={(event) => event.stopPropagation()}><div className="customer-sheet__handle"/><div className="customer-sheet__heading">{customizing.imageUrl && customizing.displayStyle !== "emoji" ? <img className="customer-sheet__image" src={customizing.imageUrl} alt={customizing.imageAlt || customizing.name}/> : <div className="customer-sheet__emoji">{customizing.emoji || categoryIcon(customizing.category)}</div>}<div><small>{customizing.category}</small><h2>{customizing.name}</h2><p>{customizing.description}</p></div><strong>{money(customizing.price)}</strong></div><div className="customer-sheet__quantity"><span>Quantity</span><div className="quantity-control"><button onClick={() => setCustomQuantity(Math.max(1, customQuantity - 1))}><Minus size={17}/></button><strong>{customQuantity}</strong><button onClick={() => setCustomQuantity(customQuantity + 1)}><Plus size={17}/></button></div></div><fieldset><legend>Condiments <small>Choose any</small></legend><div className="condiment-grid">{(customizing.condiments ?? []).map((condiment) => <label key={condiment}><input type="checkbox" checked={selectedCondiments.includes(condiment)} onChange={() => setSelectedCondiments((current) => current.includes(condiment) ? current.filter((value) => value !== condiment) : [...current, condiment])}/><span>{condiment}</span></label>)}</div></fieldset><button className="customer-primary" onClick={saveCustomization}>Add to cart · {money(customizing.price * customQuantity)}</button></section></div>}
    </div>
  );
}

function OrderTotals({ subtotal, deliveryFee, tax, cashTotal, estimatedCardFee, cardTotal }: { subtotal: number; deliveryFee: number; tax: number; cashTotal: number; estimatedCardFee: number; cardTotal: number }) {
  return <div className="order-totals"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Delivery fee</span><strong>{money(deliveryFee)}</strong></div><div><span>Tax</span><strong>{money(tax)}</strong></div><div className="order-totals__total"><span>Exact cash total</span><strong>{money(cashTotal)}</strong></div><div><span>Estimated card fee</span><strong>{money(estimatedCardFee)}</strong></div><div className="order-totals__total order-totals__total--card"><span>Credit card total</span><strong>{money(cardTotal)}</strong></div></div>;
}
function CustomerMessage({ title, message }: { title: string; message: string }) {
  return <div className="customer-message"><div className="customer-brand"><img src="/seatserve-web-logo.png" alt="SeatServe" className="customer-brand__logo" /></div><h1>{title}</h1><p>{message}</p><Link to="/admin">Return to SeatServe</Link></div>;
}
