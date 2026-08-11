import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPinned,
  PackageCheck,
  Search,
  Truck,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { useSeatServe } from "../../state/SeatServeContext";
import type { Order, OrderStatus } from "../../types/domain";
import "./OrderDispatch.css";

const FILTERS: Array<{ label: string; value: "all" | OrderStatus }> = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "Preparing", value: "preparing" },
  { label: "Ready", value: "ready" },
  { label: "Assigned", value: "assigned" },
  { label: "Delivering", value: "delivering" },
  { label: "Delivered", value: "delivered" },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "preparing",
  preparing: "ready",
  ready: "assigned",
  assigned: "delivering",
  delivering: "delivered",
};

const statusLabel = (status: OrderStatus) => status.charAt(0).toUpperCase() + status.slice(1);

export default function OrderDispatch() {
  const { data, updateOrderStatus, assignRunnerToOrder, cancelOrder } = useSeatServe();
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(data.orders[0]?.id);

  const orders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (!normalized) return true;
      const zone = data.venues.flatMap((venue) => venue.zones).find((item) => item.id === order.location.zoneId);
      return [order.id, order.customer.name, order.customer.mobile ?? "", zone?.name ?? ""]
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [data.orders, data.venues, query, statusFilter]);

  const selected = data.orders.find((order) => order.id === selectedId) ?? orders[0];
  const availableRunners = data.runners.filter((runner) => runner.active && (runner.status === "available" || runner.id === selected?.runnerId));
  const activeCount = data.orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length;
  const readyCount = data.orders.filter((order) => order.status === "ready").length;
  const deliveringCount = data.orders.filter((order) => order.status === "delivering").length;

  return (
    <section className="dispatch-page">
      <header className="dispatch-heading">
        <div>
          <p className="eyebrow">Live operations</p>
          <h2>Order Dispatch</h2>
          <p>Monitor incoming orders, assign runners, and move deliveries through fulfillment.</p>
        </div>
      </header>

      <section className="dispatch-stats">
        <article><PackageCheck /><span>Active orders</span><strong>{activeCount}</strong></article>
        <article><Clock3 /><span>Ready for runner</span><strong>{readyCount}</strong></article>
        <article><Truck /><span>Delivering</span><strong>{deliveringCount}</strong></article>
        <article><UserRoundCheck /><span>Available runners</span><strong>{data.runners.filter((runner) => runner.active && runner.status === "available").length}</strong></article>
      </section>

      <section className="dispatch-toolbar panel">
        <div className="dispatch-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, customer, phone, or zone" />
        </div>
        <div className="dispatch-filters" aria-label="Order status filters">
          {FILTERS.map((filter) => (
            <button key={filter.value} className={statusFilter === filter.value ? "active" : ""} onClick={() => setStatusFilter(filter.value)}>
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section className="dispatch-workspace">
        <div className="dispatch-list panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Queue</p><h3>Orders</h3></div>
            <span>{orders.length} shown</span>
          </div>

          {orders.length === 0 ? (
            <div className="dispatch-empty"><CheckCircle2 /><h3>No matching orders</h3><p>New customer orders will appear here automatically.</p></div>
          ) : (
            <div className="order-rows">
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} selected={selected?.id === order.id} onSelect={() => setSelectedId(order.id)} />
              ))}
            </div>
          )}
        </div>

        <aside className="dispatch-detail panel">
          {!selected ? (
            <div className="dispatch-empty"><PackageCheck /><h3>Select an order</h3><p>Choose an order to review details and dispatch controls.</p></div>
          ) : (
            <>
              <div className="detail-title">
                <div><p className="eyebrow">Order detail</p><h3>{selected.id}</h3></div>
                <span className={`order-status order-status--${selected.status}`}>{statusLabel(selected.status)}</span>
              </div>

              <div className="detail-block">
                <span>Customer</span>
                <strong>{selected.customer.name}</strong>
                <small>{selected.customer.mobile || "No mobile number"}</small>
              </div>

              <div className="detail-block">
                <span>Delivery location</span>
                <strong><MapPinned size={15} /> {locationLabel(selected, data.venues)}</strong>
                <small>{selected.location.vertical} · {selected.location.horizontal} · facing the field</small>
                {selected.location.notes && <small className="location-note">“{selected.location.notes}”</small>}
              </div>

              <div className="detail-items">
                <span>Items</span>
                {selected.items.map((item) => <div key={`${item.menuItemId}-${item.name}`}><span>{item.quantity} × {item.name}</span><strong>${(item.unitPrice * item.quantity).toFixed(2)}</strong></div>)}
                <div className="detail-total"><span>Total</span><strong>${selected.total.toFixed(2)}</strong></div>
              </div>

              <label className="runner-select">
                <span>Assigned runner</span>
                <select value={selected.runnerId ?? ""} onChange={(event) => assignRunnerToOrder(selected.id, event.target.value || undefined)}>
                  <option value="">Unassigned</option>
                  {availableRunners.map((runner) => <option key={runner.id} value={runner.id}>{runner.name} · {runner.status}</option>)}
                </select>
              </label>

              <div className="detail-actions">
                {NEXT_STATUS[selected.status] && (
                  <button className="primary-action" disabled={NEXT_STATUS[selected.status] === "assigned" && !selected.runnerId} onClick={() => updateOrderStatus(selected.id, NEXT_STATUS[selected.status]!)}>
                    Advance to {statusLabel(NEXT_STATUS[selected.status]!)} <ChevronRight size={16} />
                  </button>
                )}
                {!['delivered', 'cancelled'].includes(selected.status) && (
                  <button className="danger-action" onClick={() => cancelOrder(selected.id)}><XCircle size={16} /> Cancel order</button>
                )}
              </div>

              {selected.status === "ready" && !selected.runnerId && <div className="detail-warning"><AlertTriangle size={16} /> Assign a runner before advancing this order.</div>}
            </>
          )}
        </aside>
      </section>
    </section>
  );
}

function OrderRow({ order, selected, onSelect }: { order: Order; selected: boolean; onSelect: () => void }) {
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(order.placedAt).getTime()) / 60000));
  return (
    <button className={`order-row ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="order-row__top"><strong>{order.id}</strong><span className={`order-status order-status--${order.status}`}>{statusLabel(order.status)}</span></div>
      <div className="order-row__body"><span>{order.customer.name}</span><strong>${order.total.toFixed(2)}</strong></div>
      <div className="order-row__meta"><span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} items</span><span>{elapsed} min ago</span></div>
    </button>
  );
}

function locationLabel(order: Order, venues: ReturnType<typeof useSeatServe>["data"]["venues"]) {
  const venue = venues.find((item) => item.id === order.location.venueId);
  const zone = venue?.zones.find((item) => item.id === order.location.zoneId);
  return `${venue?.name ?? "Unknown venue"} · ${zone?.name ?? "Unknown zone"}`;
}
