import {
    ArrowLeft, Banknote, Check, CheckCircle2, ChevronDown, ChevronUp, CreditCard, Clock3, ExternalLink, MapPin, PackageCheck, RefreshCw, Search, UserRound, X, Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useSeatServe } from "../../state/SeatServeContext";
import type { Order, OrderStatus, Runner } from "../../types/domain";
import { getSyncMeta, pullFromGoogleSheets, updateOrderStatusLive, type SyncMeta } from "../../services/persistence";
import "./KitchenOperations.css";

const FLOW: Array<{ status: OrderStatus; label: string }> = [
    { status: "new", label: "Received" },
    { status: "preparing", label: "Preparing" },
    { status: "ready", label: "Ready" },
    { status: "delivering", label: "Out for delivery" },
    { status: "delivered", label: "Delivered" },
];

const safeItems = (order: Order) => Array.isArray(order.items) ? order.items : [];
const titleCase = (value?: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : "—";
const formatTime = (value?: string) => value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
const elapsedSeconds = (value?: string) => value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)) : 0;
const elapsedLabel = (value?: string) => {
    const seconds = elapsedSeconds(value);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
const remainingMinutes = (value?: string) => value ? Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 60_000)) : 0;
const statusStep = (status: OrderStatus) => status === "assigned" ? 3 : Math.max(0, FLOW.findIndex((item) => item.status === status));

function KitchenDashboardHeader({ onRefresh, syncMeta, isSyncing, keepAwake, wakeActive, onToggleAwake, open, onToggleOpen, children }: { onRefresh: () => void; syncMeta: SyncMeta; isSyncing: boolean; keepAwake: boolean; wakeActive: boolean; onToggleAwake: () => void; open: boolean; onToggleOpen: () => void; children: React.ReactNode }) {
    const lastSync = syncMeta.lastSuccessfulSyncAt ? new Date(syncMeta.lastSuccessfulSyncAt).toLocaleString() : "never";
    return (
        <header className="ko-header">
            <div className="ko-header__row">
                {children}
                <button type="button" className="ko-header__toggle" onClick={onToggleOpen} aria-expanded={open} aria-label={open ? "Hide sync controls" : "Show sync controls"} title={open ? "Hide sync controls" : "Show sync controls"}>
                    {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    <span>{open ? "Hide" : "More"}</span>
                </button>
            </div>
            {open && (
                <div className="ko-header__sync">
                    <button onClick={onRefresh} disabled={isSyncing}>
                        <RefreshCw size={16} className={isSyncing ? "is-syncing" : ""} />
                        {isSyncing ? "Loading..." : "Load from Sheets"}
                    </button>
                    <button type="button" onClick={onToggleAwake} title="Keep the Kitchen display awake during the event">
                        <Zap size={16} />
                        {keepAwake ? (wakeActive ? "Screen Awake" : "Keep Awake On") : "Keep Awake Off"}
                    </button>
                    <div className="sync-status">
                        <CheckCircle2 size={16} />
                        <span>Last updated: {lastSync}</span>
                    </div>
                </div>
            )}
        </header>
    );
}

export default function KitchenOperations() {
    const { data, replaceData, activeEvent, mergeRemoteOrder, assignRunnerToOrder, autoAssignRunner, cancelOrder, refreshLiveOperationalData } = useSeatServe();
    const [query, setQuery] = useState("");
    const [zoneFilter, setZoneFilter] = useState("all");
    const [selectedOrderId, setSelectedOrderId] = useState<string>();
    const [deliveredOpen, setDeliveredOpen] = useState(false);
    const [expandedColumns, setExpandedColumns] = useState<Record<string, boolean>>({});
    const [, setTick] = useState(0);
    const [syncMeta, setSyncMeta] = useState<SyncMeta>(() => getSyncMeta());
    const [isSyncing, setIsSyncing] = useState(false);
    const [notice, setNotice] = useState("");
    const [keepAwake, setKeepAwake] = useState(true);
    const [wakeActive, setWakeActive] = useState(false);
    const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
    const [headerOpen, setHeaderOpen] = useState<boolean>(() => {
        try { return localStorage.getItem("seatserve:kitchen-header-open") !== "false"; } catch { return true; }
    });
    const toggleHeaderOpen = () => setHeaderOpen((value) => {
        const next = !value;
        try { localStorage.setItem("seatserve:kitchen-header-open", String(next)); } catch { /* ignore storage errors */ }
        return next;
    });

    useEffect(() => {
        const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const metaHandler = (event: Event) => setSyncMeta((event as CustomEvent<SyncMeta>).detail ?? getSyncMeta());
        window.addEventListener("seatserve:sync-meta", metaHandler);
        return () => window.removeEventListener("seatserve:sync-meta", metaHandler);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const refresh = async () => {
            if (cancelled || document.visibilityState !== "visible" || !navigator.onLine) return;
            try { await refreshLiveOperationalData(); } catch (error) { console.error("Kitchen live refresh failed", error); }
        };
        void refresh();
        const timer = window.setInterval(() => void refresh(), 3000);
        const onFocus = () => void refresh();
        const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
        const onOnline = () => void refresh();
        window.addEventListener("focus", onFocus);
        window.addEventListener("online", onOnline);
        document.addEventListener("visibilitychange", onVisible);
        return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("focus", onFocus); window.removeEventListener("online", onOnline); document.removeEventListener("visibilitychange", onVisible); };
    }, [refreshLiveOperationalData]);

    useEffect(() => {
        let cancelled = false;
        const acquire = async () => {
            if (!keepAwake || document.visibilityState !== "visible") return;
            try {
                const wakeLockApi = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
                if (!wakeLockApi) { setWakeActive(false); return; }
                wakeLockRef.current = await wakeLockApi.request("screen");
                if (!cancelled) setWakeActive(true);
            } catch { if (!cancelled) setWakeActive(false); }
        };
        if (keepAwake) void acquire();
        else { void wakeLockRef.current?.release().catch(() => undefined); wakeLockRef.current = null; setWakeActive(false); }
        const onVisible = () => { if (document.visibilityState === "visible" && keepAwake && !wakeLockRef.current) void acquire(); };
        document.addEventListener("visibilitychange", onVisible);
        return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); void wakeLockRef.current?.release().catch(() => undefined); wakeLockRef.current = null; };
    }, [keepAwake]);

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<{ message?: string; tone?: string }>).detail;
            if (!detail?.message) return;
            setNotice(detail.message);
            window.setTimeout(() => setNotice(""), 5000);
        };
        window.addEventListener("seatserve:operation-notice", handler);
        return () => window.removeEventListener("seatserve:operation-notice", handler);
    }, []);

    const handleRefresh = async () => {
        setIsSyncing(true);
        setNotice("");
        try {
            const result = await pullFromGoogleSheets(data);
            if (result.data) {
                replaceData(result.data, "Manual refresh successful");
                setNotice("Successfully loaded the latest data from Google Sheets.");
            } else {
                setNotice("Data is already up to date.");
            }
        } catch (error) {
            setNotice(error instanceof Error ? `Error: ${error.message}` : "Failed to load data.");
        } finally {
            setIsSyncing(false);
            setTimeout(() => setNotice(""), 5000);
        }
    };

    // FIX: Simplified variable initialization to satisfy React Compiler
    const allOrders = data.orders ?? [];
    const runners = data.runners ?? [];
    const venue = useMemo(() => (data.venues ?? []).find((item) => item.id === activeEvent?.venueId), [data.venues, activeEvent]);
    const zones = useMemo(() => venue?.zones ?? [], [venue]);

    const zoneName = useCallback((order: Order) => zones.find((zone) => zone.id === order.location?.zoneId)?.name ?? "Unknown zone", [zones]);
    const runnerFor = useCallback((order: Order) => runners.find((runner) => runner.id === order.runnerId), [runners]);

    const setStatusConfirmed = async (orderId: string, status: OrderStatus) => {
        setNotice(`Saving ${status}...`);
        try { const result = await updateOrderStatusLive(orderId, status); if (result.order) mergeRemoteOrder(result.order); setNotice(`Order ${orderId}: ${status} saved.`); }
        catch (error) { setNotice(`Failed: ${error instanceof Error ? error.message : "Order update failed."}`); }
        finally { }
    };

    const eventOrders = useMemo(() => {
        if (!activeEvent) return [];
        const needle = query.trim().toLowerCase();
        return allOrders
            .filter((order) => order.eventId === activeEvent.id)
            .filter((order) => zoneFilter === "all" || order.location?.zoneId === zoneFilter)
            .filter((order) => {
                if (!needle) return true;
                const values = [order.id, order.customer?.name, zoneName(order), order.location?.vertical, order.location?.horizontal];
                return values.filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
            })
            .sort((a, b) => new Date(a.placedAt ?? 0).getTime() - new Date(b.placedAt ?? 0).getTime());
    }, [activeEvent, allOrders, query, zoneFilter, zoneName]);

    const columns = useMemo(() => [
        { key: "new", label: "New", orders: eventOrders.filter((order) => order.status === "new") },
        { key: "preparing", label: "Preparing", orders: eventOrders.filter((order) => order.status === "preparing") },
        { key: "ready", label: "Ready", orders: eventOrders.filter((order) => order.status === "ready") },
        { key: "delivery", label: "Out for Delivery", orders: eventOrders.filter((order) => order.status === "assigned" || order.status === "delivering") },
    ], [eventOrders]);

    const delivered = useMemo(() => eventOrders.filter((order) => order.status === "delivered").sort((a, b) => new Date(b.deliveredAt ?? 0).getTime() - new Date(a.deliveredAt ?? 0).getTime()), [eventOrders]);
    const selectedOrder = useMemo(() => eventOrders.find((order) => order.id === selectedOrderId) ?? columns.flatMap((column) => column.orders)[0], [eventOrders, selectedOrderId, columns]);

    useEffect(() => {
        if (!selectedOrderId && selectedOrder) {
            Promise.resolve().then(() => setSelectedOrderId(selectedOrder.id));
        }
    }, [selectedOrder, selectedOrderId]);

    const autoAssignReadyOrders = () => {
        columns[2].orders
            .filter((order) => order.fulfillmentMethod !== "pickup" && !order.runnerId)
            .sort((a, b) => new Date(a.readyAt ?? a.placedAt).getTime() - new Date(b.readyAt ?? b.placedAt).getTime())
            .forEach((order) => autoAssignRunner(order.id));
    };

    if (!activeEvent) {
        return <div className="ko-empty"><PackageCheck size={48} /><h1>No active event</h1><p>Start an event in Administration before opening Kitchen Operations.</p><Link to="/admin/events">Go to Events</Link></div>;
    }

    return (
        <div className="ko-page">
            <section className="ko-workspace">
                <KitchenDashboardHeader onRefresh={handleRefresh} syncMeta={syncMeta} isSyncing={isSyncing} keepAwake={keepAwake} wakeActive={wakeActive} onToggleAwake={() => setKeepAwake((value) => !value)} open={headerOpen} onToggleOpen={toggleHeaderOpen}>
                    <div className="ko-metrics" aria-label="Current event order totals">
                        <Metric label="New" value={columns[0].orders.length} tone="blue" />
                        <Metric label="Preparing" value={columns[1].orders.length} tone="orange" />
                        <Metric label="Ready" value={columns[2].orders.length} tone="green" />
                        <Metric label="Out for Delivery" value={columns[3].orders.length} tone="blue" />
                        <Metric label="Delivered" value={delivered.length} tone="dark" />
                    </div>
                </KitchenDashboardHeader>

                <div className="ko-operations-bar">
                    <div className="ko-toolbar">
                        <label className="ko-select"><MapPin size={16} /><select value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)}><option value="all">All Zones</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select><ChevronDown size={15} /></label>
                        <label className="ko-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders..." /></label>
                        <span className="ko-toolbar__spacer" />
                        <button type="button" className="ko-tool ko-tool--primary" onClick={autoAssignReadyOrders} disabled={columns[2].orders.length === 0}><Zap size={17} />Auto Assign Ready</button>
                        <Link className="ko-tool ko-tool--icon" to="/admin" aria-label="Return to Administration"><ArrowLeft size={18} /></Link>
                    </div>
                </div>

                {notice && <div className="ko-notice">{notice}</div>}

                <main className="ko-board">
                    {columns.map((column) => (
                        <section className={`ko-column ko-column--${column.key}`} key={column.key}>
                            <div className="ko-column__head"><h2>{column.label} <span>({column.orders.length})</span></h2><button type="button" aria-label={`${column.label} options`}>•••</button></div>
                            <div className="ko-column__list">
                                {column.orders.length === 0 ? <div className="ko-column__empty">No orders</div> : column.orders.slice(0, expandedColumns[column.key] ? column.orders.length : 6).map((order) => (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        zone={zoneName(order)}
                                        runner={runnerFor(order)}
                                        selected={selectedOrder?.id === order.id}
                                        onSelect={() => setSelectedOrderId(order.id)}
                                        onAccept={() => void setStatusConfirmed(order.id, "preparing")}
                                        onAssign={() => autoAssignRunner(order.id)}
                                    />
                                ))}
                                {column.orders.length > 6 && <button className={`ko-more ko-more--${column.key}`} type="button" onClick={() => setExpandedColumns((current) => ({ ...current, [column.key]: !current[column.key] }))}>{expandedColumns[column.key] ? "Show fewer" : `+ ${column.orders.length - 6} more orders`}</button>}
                            </div>
                        </section>
                    ))}
                </main>
                <section className="ko-delivered">
                    <button type="button" onClick={() => setDeliveredOpen((open) => !open)}><span>Delivered ({delivered.length})</span>{deliveredOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
                    {deliveredOpen && <div className="ko-delivered__list">{delivered.length === 0 ? <p>No delivered orders for this event.</p> : delivered.map((order) => <button type="button" key={order.id} onClick={() => setSelectedOrderId(order.id)}><strong>{order.id}</strong><span>{zoneName(order)}</span><span>{runnerFor(order)?.name ?? "Unassigned"}</span><time>{formatTime(order.deliveredAt)}</time><b>${Number(order.total ?? 0).toFixed(2)}</b></button>)}</div>}
                </section>
            </section>
            <aside className="ko-detail">
                {selectedOrder ? <OrderDetail
                    order={selectedOrder}
                    zone={zoneName(selectedOrder)}
                    runner={runnerFor(selectedOrder)}
                    runners={runners}
                    onClose={() => setSelectedOrderId(undefined)}
                    onStatus={(status) => void setStatusConfirmed(selectedOrder.id, status)}
                    onAssign={(runnerId) => assignRunnerToOrder(selectedOrder.id, runnerId)}
                    onAutoAssign={() => autoAssignRunner(selectedOrder.id)}
                    onCancel={() => cancelOrder(selectedOrder.id)}
                /> : <div className="ko-detail__empty"><PackageCheck size={42} /><h2>Select an order</h2><p>Order information will appear here.</p></div>}
            </aside>
        </div>
    );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
    return <div className={`ko-metric ko-metric--${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function OrderCard({ order, zone, runner, selected, onSelect, onAccept, onAssign }: { order: Order; zone: string; runner?: Runner; selected: boolean; onSelect: () => void; onAccept: () => void; onAssign: () => void }) {
    const items = safeItems(order);
    const itemCount = items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
    const location = order.location ?? { vertical: "middle", horizontal: "center" };
    return (
        <article className={`ko-card ko-card--${order.status} ${selected ? "is-selected" : ""}`} onClick={onSelect}>
            <button type="button" className="ko-card__main" onClick={onSelect}>
                <div className="ko-card__top"><strong>{order.id}</strong><time>{formatTime(order.placedAt)}</time></div>
                <h3>{zone}</h3>
                <p><MapPin size={12} />{titleCase(location.vertical)} · {titleCase(location.horizontal)}</p>
                <div className="ko-card__meta"><span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>{order.status === "preparing" && <em><Clock3 size={13} />{elapsedLabel(order.preparingAt ?? order.placedAt)}</em>}</div>
                {(runner || order.status === "assigned" || order.status === "delivering") && <div className="ko-card__runner"><UserRound size={13} />{runner?.name ?? "Unassigned"}{runner?.estimatedAvailableAt && <b>ETA {remainingMinutes(runner.estimatedAvailableAt)}m</b>}</div>}
            </button>
            <div className="ko-card__action">
                {order.status === "new" && <button type="button" className="blue" onClick={(event) => { event.stopPropagation(); onAccept(); }}>Accept Order</button>}
                {order.status === "preparing" && <button type="button" className="outline" onClick={(event) => { event.stopPropagation(); onSelect(); }}>View Order</button>}
                {order.status === "ready" && (order.fulfillmentMethod === "pickup" ? <button type="button" className="green" onClick={(event) => { event.stopPropagation(); onSelect(); }}>Ready for Pickup</button> : <button type="button" className="green" onClick={(event) => { event.stopPropagation(); onAssign(); }}>Assign Runner</button>)}
            </div>
        </article>
    );
}

function OrderDetail({ order, zone, runner, runners, onClose, onStatus, onAssign, onAutoAssign, onCancel }: { order: Order; zone: string; runner?: Runner; runners: Runner[]; onClose: () => void; onStatus: (status: OrderStatus) => void; onAssign: (runnerId?: string) => void; onAutoAssign: () => void; onCancel: () => void }) {
    const items = safeItems(order);
    const location = order.location ?? { vertical: "middle", horizontal: "center", notes: "" };
    const currentStep = statusStep(order.status);
    const availableRunners = runners.filter((item) => item.active && (item.status === "available" || item.id === order.runnerId));
    const next = order.status === "new" ? { label: "Accept Order", status: "preparing" as OrderStatus }
        : order.status === "preparing" ? { label: order.fulfillmentMethod === "pickup" ? "Ready for Pickup" : "Mark Ready", status: "ready" as OrderStatus }
            : order.status === "ready" && order.fulfillmentMethod === "pickup" ? { label: "Mark Picked Up", status: "delivered" as OrderStatus }
                : undefined;

    return <div className="ko-detail__content">
        <header className="ko-detail__header"><div><div className="ko-detail__heading"><h2>Order {order.id.startsWith("#") ? order.id : `#${order.id.replace(/^SS-/, "")}`}</h2><span className={`ko-badge ko-badge--${order.status}`}>{order.status === "assigned" ? "Runner Assigned" : titleCase(order.status)}</span></div><p>Placed: {formatTime(order.placedAt)} · {Math.max(0, Math.floor(elapsedSeconds(order.placedAt) / 60))} minutes ago</p></div><div className="ko-detail__header-actions"><button type="button" aria-label="Open order in new window"><ExternalLink size={18} /></button><button type="button" onClick={onClose} aria-label="Close order"><X size={20} /></button></div></header>
        <section className="ko-location"><div><span><MapPin size={15} />{order.fulfillmentMethod === "pickup" ? "Fulfillment" : "Location"}</span><h3>{order.fulfillmentMethod === "pickup" ? "Window Pickup" : zone}</h3><p>{order.fulfillmentMethod === "pickup" ? "Customer will pick up at the concession window" : `${titleCase(location.vertical)} · ${titleCase(location.horizontal)}`}</p></div><div className="ko-location__map"><MapPin size={30} /></div></section>
        <section className="ko-status"><div className="ko-section-title"><h3>Order Status</h3><span>{elapsedLabel(order.placedAt)} elapsed</span></div><div className="ko-timeline">{FLOW.map((step, index) => <div key={step.status} className={`ko-timeline__step ${index < currentStep ? "is-complete" : ""} ${index === currentStep ? "is-current" : ""}`}><span>{index < currentStep ? <Check size={15} /> : ""}</span><strong>{step.label}</strong><small>{index === currentStep ? "Current" : index === 0 ? formatTime(order.placedAt) : ""}</small></div>)}</div></section>
        <section className="ko-items"><h3>Items ({items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)})</h3>{items.length === 0 ? <p className="ko-muted">No item details available.</p> : items.map((item, index) => <div className="ko-item" key={`${item.menuItemId}-${index}`}><div className="ko-item__image">{item.name?.slice(0, 1) ?? "•"}</div><span className="ko-item__qty">{item.quantity}</span><div><strong>{item.name}</strong><small>{item.condiments?.length ? `Condiments: ${item.condiments.join(", ")}` : ""}</small></div><p><strong>${(Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0)).toFixed(2)}</strong><small>${Number(item.unitPrice ?? 0).toFixed(2)} each</small></p></div>)}</section>
        <section className="ko-notes"><h3>Customer Notes</h3><p>{location.notes || "No special instructions."}</p></section>
        {order.fulfillmentMethod !== "pickup" && <section className="ko-runner"><h3>Runner</h3><div className="ko-runner__row"><span className="ko-avatar">{runner?.name?.slice(0, 1) ?? "?"}</span><div><strong>{runner?.name ?? "Unassigned"}</strong><small>{runner?.status ? titleCase(runner.status) : "No runner assigned"}</small></div>{order.status === "ready" ? <button type="button" onClick={onAutoAssign}>Auto Assign</button> : order.status === "assigned" ? <select value={order.runnerId ?? ""} onChange={(event) => onAssign(event.target.value || undefined)}><option value="">Unassigned</option>{availableRunners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : null}</div>{(order.status === "assigned" || order.status === "delivering") && <p className="ko-runner__handoff">{order.status === "assigned" ? "Waiting for the runner to confirm pickup in Runner Mobile." : "Runner is out for delivery. Delivery and payment completion are controlled from Runner Mobile."}</p>}</section>}
        {order.paymentMethod && <section className={`ko-payment ko-payment--${order.paymentMethod}`}>{order.paymentMethod === "card" ? <CreditCard size={20} /> : <Banknote size={20} />}<div><small>Payment at delivery</small><strong>{order.paymentMethod === "card" ? "Credit card" : "Exact cash"}</strong><span>{order.paymentCollectedAt ? "Payment collected" : "Runner will collect at delivery"}</span></div><b>${Number(order.paymentMethod === "card" ? (order.cardTotal ?? order.total) : (order.cashTotal ?? order.total)).toFixed(2)}</b></section>}
        <section className="ko-total"><span>Order Total</span><strong>${Number(order.total ?? 0).toFixed(2)}</strong></section>
        <footer className="ko-detail__footer">{next && <button type="button" className="ko-primary-action" onClick={() => onStatus(next.status)}><Check size={18} />{next.label}</button>}{(order.status === "assigned" || order.status === "delivering") && <div className="ko-runner-waiting"><Clock3 size={16} /><span>{order.status === "assigned" ? "Runner pickup pending" : "Runner delivery in progress"}</span></div>}<div className="ko-detail__footer-single">{order.status !== "delivered" && order.status !== "cancelled" && <button type="button" className="ko-danger-action" onClick={onCancel}><X size={17} />Cancel Order</button>}</div></footer>
    </div>;
}
