// File location: /src/state/SeatServeContext.tsx
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { seedData } from "../data/seed";
import { createLocalBackup, getActiveDataStorageKey, getActiveWorkspaceId, getSyncConfig, isDeploymentManagedSync, markLocalChange, pollGoogleSheets } from "../services/persistence";
import type {
    ActivityItem,
    DeliveryZone,
    Order,
    SeatServeData,
    SeatServeEvent,
    Venue,
    VenueSection,
    Runner,
    RunnerStatus,
    MenuItem,
    MenuCategory,
    MenuDefinition,
    CustomerExperienceSettings,
    CustomerFeedback,
    StaffAccessSettings,
} from "../types/domain";

type VenueDraft = Omit<Venue, "id" | "zones">;
type ZoneDraft = Omit<DeliveryZone, "id" | "sections">;
type SectionDraft = Omit<VenueSection, "id">;
type OrderDraft = Omit<Order, "id" | "placedAt" | "status">;
type RunnerDraft = Omit<Runner, "id" | "activeOrderId" | "completedDeliveries" | "rating">;
type MenuItemDraft = Omit<MenuItem, "id">;
type MenuCategoryDraft = Omit<MenuCategory, "id">;
type MenuDefinitionDraft = Omit<MenuDefinition, "id">;
type EventDraft = Omit<SeatServeEvent, "id">;

interface SeatServeContextValue {
    data: SeatServeData;
    getCurrentDataSnapshot: () => SeatServeData;
    activeEvent?: SeatServeEvent;
    addEvent: (draft: EventDraft) => string;
    updateEvent: (eventId: string, draft: EventDraft) => void;
    duplicateEvent: (eventId: string) => void;
    deleteEvent: (eventId: string) => boolean;
    startEvent: (eventId: string) => void;
    completeEvent: (eventId: string) => void;
    setOrderingEnabled: (eventId: string, enabled: boolean) => void;
    placeOrder: (draft: OrderDraft) => string;
    updateOrderStatus: (orderId: string, status: Order["status"]) => void;
    markOrderPaymentCollected: (orderId: string) => void;
    requestSeatBeacon: (orderId: string) => void;
    markSeatBeaconOpened: (orderId: string) => void;
    markCustomerLocated: (orderId: string) => void;
    assignRunnerToOrder: (orderId: string, runnerId?: string) => void;
    autoAssignRunner: (orderId: string) => string | undefined;
    markRunnerAvailable: (runnerId: string) => void;
    cancelOrder: (orderId: string) => void;
    addRunner: (draft: RunnerDraft) => string;
    updateRunner: (runnerId: string, draft: RunnerDraft) => void;
    duplicateRunner: (runnerId: string) => void;
    deleteRunner: (runnerId: string) => boolean;
    setRunnerStatus: (runnerId: string, status: RunnerStatus) => void;
    addMenuItem: (draft: MenuItemDraft) => string;
    updateMenuItem: (itemId: string, draft: MenuItemDraft) => void;
    duplicateMenuItem: (itemId: string) => string | undefined;
    deleteMenuItem: (itemId: string) => void;
    addMenuCategory: (draft: MenuCategoryDraft) => string;
    updateMenuCategory: (categoryId: string, draft: MenuCategoryDraft) => void;
    reorderMenuCategories: (orderedIds: string[]) => void;
    reorderMenuItems: (categoryId: string, orderedIds: string[]) => void;
    deleteMenuCategory: (categoryId: string) => boolean;
    addMenu: (draft: MenuDefinitionDraft) => string;
    updateMenu: (menuId: string, draft: MenuDefinitionDraft) => void;
    deleteMenu: (menuId: string) => boolean;
    assignMenuToEvent: (eventId: string, menuId?: string) => void;
    addVenue: (draft: VenueDraft) => string;
    updateVenue: (venueId: string, draft: VenueDraft) => void;
    duplicateVenue: (venueId: string) => void;
    deleteVenue: (venueId: string) => boolean;
    addZone: (venueId: string, draft: ZoneDraft) => string;
    updateZone: (venueId: string, zoneId: string, draft: ZoneDraft) => void;
    duplicateZone: (venueId: string, zoneId: string) => string | undefined;
    deleteZone: (venueId: string, zoneId: string) => void;
    addSection: (venueId: string, zoneId: string, draft: SectionDraft) => string;
    updateSection: (venueId: string, zoneId: string, sectionId: string, draft: SectionDraft) => void;
    deleteSection: (venueId: string, zoneId: string, sectionId: string) => void;
    updateCustomerExperience: (settings: CustomerExperienceSettings) => void;
    updateStaffAccess: (settings: StaffAccessSettings) => void;
    submitCustomerFeedback: (feedback: Omit<CustomerFeedback, "id" | "submittedAt">) => void;
    replaceData: (next: SeatServeData, reason?: string) => void;
    updateReportingData: (next: SeatServeData, reason?: string) => void;
    resetDemoData: () => void;
    repairWorkspaceData: () => void;
}

const SeatServeContext = createContext<SeatServeContextValue | undefined>(undefined);

const migrateData = (candidate: SeatServeData): SeatServeData => {
    const safe = (candidate && typeof candidate === "object" ? candidate : seedData) as SeatServeData;
    const events = Array.isArray(safe.events) ? safe.events : [];
    const venues = Array.isArray(safe.venues) ? safe.venues : [];
    const runners = Array.isArray(safe.runners) ? safe.runners : [];
    const menuItems = Array.isArray(safe.menuItems) ? safe.menuItems : [];
    const menuCategories = Array.isArray(safe.menuCategories) ? safe.menuCategories : [];
    const menus = Array.isArray(safe.menus) ? safe.menus : [];
    const orders = Array.isArray(safe.orders) ? safe.orders : [];
    const activityItems = Array.isArray(safe.activity) ? safe.activity : [];
    const feedback = Array.isArray(safe.feedback) ? safe.feedback : [];
    const archivedOrders = Array.isArray(safe.archivedOrders) ? safe.archivedOrders : [];
    const archivedFeedback = Array.isArray(safe.archivedFeedback) ? safe.archivedFeedback : [];
    return {
        ...seedData,
        ...safe,
        events,
        venues: venues.map((venue) => ({
            ...venue,
            address: venue.address ?? "",
            zones: (Array.isArray(venue.zones) ? venue.zones : []).map((zone, index) => ({
                ...zone,
                sections: Array.isArray(zone.sections) ? zone.sections : [],
                baselineRoundTripMinutes: zone.baselineRoundTripMinutes ?? Math.max(4, 12 - index * 2),
                learnedRoundTripMinutes: zone.learnedRoundTripMinutes,
                completedTripCount: zone.completedTripCount ?? 0,
            })),
        })),
        runners: runners.map((runner) => ({
            ...runner,
            zoneIds: Array.isArray(runner.zoneIds) ? runner.zoneIds : [],
            availableSince: runner.availableSince ?? (runner.status === "available" ? new Date().toISOString() : undefined),
        })),
        menuCategories,
        menus: menus.map((menu) => ({ ...menu, itemIds: Array.isArray(menu.itemIds) ? menu.itemIds : [] })),
        menuItems: menuItems.map((item) => ({ ...item, description: item.description ?? "", condiments: Array.isArray(item.condiments) ? item.condiments : [] })),
        customerExperience: {
            ...seedData.customerExperience,
            ...(safe.customerExperience ?? {}),
            supportLinks: Array.isArray(safe.customerExperience?.supportLinks) ? safe.customerExperience.supportLinks : seedData.customerExperience.supportLinks,
            deliveryFee: Number.isFinite(safe.customerExperience?.deliveryFee) ? Math.max(0, safe.customerExperience.deliveryFee) : seedData.customerExperience.deliveryFee,
            taxRatePercent: Number.isFinite(safe.customerExperience?.taxRatePercent) ? Math.max(0, safe.customerExperience.taxRatePercent) : seedData.customerExperience.taxRatePercent,
            estimatedCardFeePercent: Number.isFinite(safe.customerExperience?.estimatedCardFeePercent) ? Math.max(0, safe.customerExperience.estimatedCardFeePercent) : seedData.customerExperience.estimatedCardFeePercent,
            estimatedCardFeeFixed: Number.isFinite(safe.customerExperience?.estimatedCardFeeFixed) ? Math.max(0, safe.customerExperience.estimatedCardFeeFixed) : seedData.customerExperience.estimatedCardFeeFixed,
            cashPaymentsEnabled: safe.customerExperience?.cashPaymentsEnabled ?? seedData.customerExperience.cashPaymentsEnabled,
            cardPaymentsEnabled: safe.customerExperience?.cardPaymentsEnabled ?? seedData.customerExperience.cardPaymentsEnabled,
            pickupEnabled: safe.customerExperience?.pickupEnabled ?? seedData.customerExperience.pickupEnabled,
            pickupLocationName: safe.customerExperience?.pickupLocationName ?? seedData.customerExperience.pickupLocationName,
            pickupInstructions: safe.customerExperience?.pickupInstructions ?? seedData.customerExperience.pickupInstructions,
        },
        staffAccess: { ...(seedData.staffAccess ?? {}), ...(safe.staffAccess ?? {}) },
        feedback,
        archivedOrders,
        archivedFeedback,
        activity: activityItems,
        orders: orders.map((order) => ({
            ...order,
            items: Array.isArray(order.items) ? order.items.map((item) => ({ ...item, condiments: Array.isArray(item.condiments) ? item.condiments : [] })) : [],
            customer: order.customer ?? { name: "Guest" },
            location: order.location ?? {
                venueId: events.find((event) => event.id === order.eventId)?.venueId ?? "",
                zoneId: "",
                vertical: "middle",
                horizontal: "center",
            },
            subtotal: order.subtotal ?? Math.max(0, (order.total ?? 0) - (order.deliveryFee ?? 0)),
            deliveryFee: order.deliveryFee ?? 0,
            tax: order.tax ?? 0,
            total: order.total ?? 0,
            cashTotal: order.cashTotal ?? order.total ?? 0,
            estimatedCardFee: order.estimatedCardFee ?? 0,
            cardTotal: order.cardTotal ?? order.total ?? 0,
        })),
    };
};

const loadInitialData = (): SeatServeData => {
    try {
        const saved = localStorage.getItem(getActiveDataStorageKey()) ?? localStorage.getItem("seatserve.core.v2") ?? localStorage.getItem("seatserve.core.v1");
        return saved ? migrateData(JSON.parse(saved) as SeatServeData) : seedData;
    } catch {
        return seedData;
    }
};

const activity = (message: string, tone: ActivityItem["tone"]): ActivityItem => ({
    id: crypto.randomUUID(),
    message,
    tone,
    occurredAt: new Date().toISOString(),
});

export function SeatServeProvider({ children }: { children: ReactNode }) {
    const [data, setData] = useState<SeatServeData>(loadInitialData);
    const [workspaceRevision, setWorkspaceRevision] = useState(0);
    const didMountRef = useRef(false);
    const replacingDataRef = useRef(false);
    const autoSyncTimerRef = useRef<number | undefined>(undefined);
    const channelRef = useRef<BroadcastChannel | null>(null);
    const instanceIdRef = useRef(crypto.randomUUID());
    const serializedDataRef = useRef("");
    const currentDataRef = useRef(data);
    const [cloudBootstrapReady, setCloudBootstrapReady] = useState(() => !isDeploymentManagedSync());

    // --- START RELIABILITY PATCH v2.1.6E ---

    const replaceData = (next: SeatServeData, reason = "SeatServe data replaced") => {
        createLocalBackup(data, "before-data-replace");
        replacingDataRef.current = true;
        setData(migrateData({
            ...next,
            activity: [activity(reason, "success"), ...(next.activity ?? [])].slice(0, 20),
        }));
    };

    const pushToGoogleSheets = async (dataToPush: SeatServeData) => {
        const config = getSyncConfig();
        if (!config.connected || !config.endpointUrl) {
            window.alert("Sync failed: Google Sheets URL is not configured.");
            return;
        }
        window.alert("Syncing with Google Sheets...");
        try {
            const response = await fetch("/.netlify/functions/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    googleScriptUrl: config.endpointUrl,
                    data: { action: "save", payload: dataToPush },
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                // Corrected template literal
                throw new Error(`Sync failed with status ${response.status}: ${errorText}`);
            }
            const result = await response.json();
            if (result.status !== "ok") throw new Error(result.message || "The sync endpoint returned an error.");
            window.alert("Sync successful! All local data has been saved to Google Sheets.");
        } catch (error) {
            console.error("Push to Google Sheets failed", error);
            // Corrected template literal
            window.alert(`Sync failed. Could not save data to Google Sheets. ${error instanceof Error ? error.message : "See console for details."}`);
        }
    };

    // Auto-load logic is now integrated into this useEffect
    useEffect(() => {
        const loadFromSheets = async (isAutoLoad = false) => {
            const config = getSyncConfig();
            if (!config.connected || !config.endpointUrl) {
                if (!isAutoLoad) window.alert("Load failed: Google Sheets URL is not configured.");
                return;
            }
            if (!isAutoLoad) window.alert("Loading data from Google Sheets...");
            try {
                // The original pollGoogleSheets function works for this
                const result = await pollGoogleSheets(currentDataRef.current);
                if (result.data) {
                    // Using replaceData ensures a full overwrite
                    replaceData(result.data, "Loaded latest data from Google Sheets");
                    if (!isAutoLoad) window.alert("Load successful!");
                } else if (!isAutoLoad) {
                    window.alert("No new data was found in Google Sheets.");
                }
            } catch (error) {
                console.error("Load from Google Sheets failed", error);
                if (!isAutoLoad) {
                    // Corrected template literal
                    window.alert(`Load failed. Could not get data from Google Sheets. ${error instanceof Error ? error.message : "Using local data instead."}`);
                }
            } finally {
                if (isAutoLoad) {
                    setCloudBootstrapReady(true);
                }
            }
        };

        // This runs the auto-load on startup
        loadFromSheets(true);

        const onVisible = () => { if (document.visibilityState === "visible") void loadFromSheets(true); };
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            document.removeEventListener("visibilitychange", onVisible);
        }
    }, [workspaceRevision]);

    // --- END RELIABILITY PATCH v2.1.6E ---

    useEffect(() => {
        const applyExternalData = (candidate: SeatServeData) => {
            const migrated = migrateData(candidate);
            const serialized = JSON.stringify(migrated);
            if (serialized === serializedDataRef.current) return;
            replacingDataRef.current = true;
            serializedDataRef.current = serialized;
            setData(migrated);
        };

        if (typeof BroadcastChannel !== "undefined") {
            const channel = new BroadcastChannel("seatserve-live-data-v1");
            channelRef.current = channel;
            channel.onmessage = (event: MessageEvent<{ sourceId?: string; workspaceId?: string; data?: SeatServeData }>) => {
                if (event.data?.sourceId === instanceIdRef.current) return;
                if (event.data?.workspaceId !== getActiveWorkspaceId() || !event.data?.data) return;
                applyExternalData(event.data.data);
            };
        }

        const refreshFromLocalStorage = () => {
            try {
                const raw = localStorage.getItem(getActiveDataStorageKey());
                if (raw) applyExternalData(JSON.parse(raw) as SeatServeData);
            } catch {
                // Keep the current in-memory state if another tab writes incomplete data.
            }
        };
        const onStorage = (event: StorageEvent) => {
            if (event.key === getActiveDataStorageKey() && event.newValue) refreshFromLocalStorage();
        };
        const onWorkspaceSwitch = () => {
            try {
                const raw = localStorage.getItem(getActiveDataStorageKey());
                replacingDataRef.current = true;
                setData(raw ? migrateData(JSON.parse(raw) as SeatServeData) : migrateData(seedData));
            } catch {
                replacingDataRef.current = true;
                setData(migrateData(seedData));
            }
            setWorkspaceRevision((value) => value + 1);
        };
        const onSyncConfig = () => setWorkspaceRevision((value) => value + 1);
        const onVisibility = () => { if (document.visibilityState === "visible") refreshFromLocalStorage(); };
        window.addEventListener("storage", onStorage);
        window.addEventListener("seatserve:workspace-switched", onWorkspaceSwitch);
        window.addEventListener("seatserve:sync-config", onSyncConfig);
        window.addEventListener("focus", refreshFromLocalStorage);
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            channelRef.current?.close();
            channelRef.current = null;
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("seatserve:workspace-switched", onWorkspaceSwitch);
            window.removeEventListener("seatserve:sync-config", onSyncConfig);
            window.removeEventListener("focus", refreshFromLocalStorage);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        window.clearTimeout(autoSyncTimerRef.current);
        autoSyncTimerRef.current = undefined;

        currentDataRef.current = data;
        const serialized = JSON.stringify(data);
        serializedDataRef.current = serialized;
        try {
            localStorage.setItem(getActiveDataStorageKey(), serialized);
        } catch (error) {
            console.error("SeatServe local storage save failed", error);
            window.dispatchEvent(new CustomEvent("seatserve:storage-error", { detail: { message: "SeatServe could not save this change locally. Remove or replace large menu images and try again." } }));
            return;
        }
        channelRef.current?.postMessage({ sourceId: instanceIdRef.current, workspaceId: getActiveWorkspaceId(), data });

        if (!didMountRef.current) {
            didMountRef.current = true;
        } else if (replacingDataRef.current) {
            replacingDataRef.current = false;
        } else {
            markLocalChange();
            const config = getSyncConfig();
            if (config.autoSync && config.connected && config.endpointUrl.trim() && navigator.onLine) {
                const delayMs = Math.max(0, config.autoSyncIntervalSeconds) * 1000;
                autoSyncTimerRef.current = window.setTimeout(() => {
                    if (!cancelled) void pushToGoogleSheets(data).catch(() => undefined);
                }, delayMs);
            }
        }

        return () => {
            cancelled = true;
            window.clearTimeout(autoSyncTimerRef.current);
            autoSyncTimerRef.current = undefined;
        };
    }, [data]);

    const activeEvent = useMemo(() => {
        const live = data.events.find((event) => event.status === "live");
        if (live) return live;
        return [...data.events]
            .filter((event) => event.status === "scheduled")
            .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
    }, [data.events]);

    const pushActivity = (current: SeatServeData, message: string, tone: ActivityItem["tone"]): ActivityItem[] =>
        [activity(message, tone), ...current.activity].slice(0, 20);

    const addEvent = (draft: EventDraft) => {
        const id = crypto.randomUUID();
        setData((current) => ({
            ...current,
            events: [
                ...current.events.map((event) => draft.status === "live" && event.status === "live" ? { ...event, status: "completed" as const, orderingEnabled: false } : event),
                { ...draft, id },
            ],
            // Corrected template literal
            activity: pushActivity(current, `Event ${draft.name} created`, "success"),
        }));
        return id;
    };

    const updateEvent = (eventId: string, draft: EventDraft) => {
        setData((current) => ({
            ...current,
            events: current.events.map((event) => {
                if (event.id === eventId) return { ...draft, id: eventId };
                if (draft.status === "live" && event.status === "live") return { ...event, status: "completed" as const, orderingEnabled: false };
                return event;
            }),
            // Corrected template literal
            activity: pushActivity(current, `Event ${draft.name} updated`, "info"),
        }));
    };

    const duplicateEvent = (eventId: string) => {
        setData((current) => {
            const source = current.events.find((event) => event.id === eventId);
            if (!source) return current;
            // Corrected template literal
            const copy = { ...source, id: crypto.randomUUID(), name: `${source.name} Copy`, status: "draft" as const, orderingEnabled: false };
            // Corrected template literal
            return { ...current, events: [...current.events, copy], activity: pushActivity(current, `Event ${source.name} duplicated`, "info") };
        });
    };

    const deleteEvent = (eventId: string) => {
        let deleted = false;
        setData((current) => {
            if (current.orders.some((order) => order.eventId === eventId)) return current;
            deleted = true;
            return { ...current, events: current.events.filter((event) => event.id !== eventId), activity: pushActivity(current, "Event deleted", "warning") };
        });
        return deleted;
    };

    const startEvent = (eventId: string) => {
        setData((current) => ({
            ...current,
            events: current.events.map((event) => ({
                ...event,
                status: event.id === eventId ? "live" : event.status === "live" ? "completed" : event.status,
                orderingEnabled: event.id === eventId,
            })),
            activity: pushActivity(current, "Event started and customer ordering opened", "success"),
        }));
    };

    const completeEvent = (eventId: string) => {
        setData((current) => ({
            ...current,
            events: current.events.map((event) => event.id === eventId ? { ...event, status: "completed", orderingEnabled: false } : event),
            activity: pushActivity(current, "Event completed and customer ordering closed", "info"),
        }));
    };

    const setOrderingEnabled = (eventId: string, enabled: boolean) => {
        setData((current) => ({
            ...current,
            events: current.events.map((event) => event.id === eventId ? { ...event, orderingEnabled: enabled } : event),
            // Corrected template literal
            activity: pushActivity(current, `Customer ordering ${enabled ? "opened" : "closed"}`, enabled ? "success" : "warning"),
        }));
    };

    const placeOrder = (draft: OrderDraft) => {
        // Corrected template literal
        const id = `SS-${Math.floor(1000 + Math.random() * 9000)}`;
        setData((current) => ({
            ...current,
            orders: [{ ...draft, id, placedAt: new Date().toISOString(), status: "new" }, ...current.orders],
            // Corrected template literal
            activity: pushActivity(current, `Order ${id} received`, "success"),
        }));
        return id;
    };

    const updateOrderStatus = (orderId: string, status: Order["status"]) => {
        setData((current) => {
            const order = current.orders.find((item) => item.id === orderId);
            if (!order || order.status === status) return current;

            const allowedTransitions: Record<Order["status"], Order["status"][]> = {
                new: ["preparing", "cancelled"],
                preparing: ["ready", "cancelled"],
                ready: order.fulfillmentMethod === "pickup" ? ["delivered", "cancelled"] : ["assigned", "cancelled"],
                assigned: ["delivering", "ready", "cancelled"],
                delivering: ["delivered", "cancelled"],
                delivered: [],
                cancelled: [],
            };
            if (!allowedTransitions[order.status].includes(status)) {
                // Corrected template literal
                return { ...current, activity: pushActivity(current, `Blocked invalid order transition ${order.id}: ${order.status} to ${status}`, "warning") };
            }
            if (status === "delivering" && order.fulfillmentMethod !== "pickup" && !order.runnerId) {
                // Corrected template literal
                return { ...current, activity: pushActivity(current, `Order ${order.id} cannot leave the kitchen without an assigned runner`, "warning") };
            }
            const requiresPayment = order.paymentMethod === "cash" || order.paymentMethod === "card";
            if (status === "delivered" && order.fulfillmentMethod !== "pickup" && requiresPayment && !order.paymentCollectedAt) {
                // Corrected template literal
                return { ...current, activity: pushActivity(current, `Order ${order.id} cannot be delivered until payment is collected`, "warning") };
            }

            const now = new Date().toISOString();
            const timestampPatch = status === "preparing" ? { acceptedAt: order.acceptedAt ?? now, preparingAt: order.preparingAt ?? now }
                : status === "ready" ? { readyAt: order.readyAt ?? now }
                    : status === "assigned" ? { assignedAt: order.assignedAt ?? now }
                        : status === "delivering" ? { deliveringAt: order.deliveringAt ?? now }
                            : status === "delivered" ? { deliveredAt: order.deliveredAt ?? now, ...(order.fulfillmentMethod === "pickup" && requiresPayment && !order.paymentCollectedAt ? { paymentCollectedAt: now } : {}) }
                                : {};
            const runnerAfterStatus = current.runners.map((runner) => {
                if (runner.id !== order.runnerId) return runner;
                if (status === "delivered") return { ...runner, status: "returning" as const, activeOrderId: orderId };
                if (status === "cancelled" || status === "ready") return { ...runner, status: "available" as const, activeOrderId: undefined, assignedAt: undefined, estimatedAvailableAt: undefined, availableSince: now };
                if (status === "delivering") return { ...runner, status: "assigned" as const, activeOrderId: orderId };
                return runner;
            });
            return {
                ...current,
                orders: current.orders.map((item) => item.id === order
