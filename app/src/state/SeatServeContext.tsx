import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { seedData } from "../data/seed";
import { createLocalBackup, getActiveDataStorageKey, getActiveWorkspaceId, getSyncConfig, markLocalChange, pollGoogleSheets, pushToGoogleSheets } from "../services/persistence";
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
  deleteZone: (venueId: string, zoneId: string) => void;
  addSection: (venueId: string, zoneId: string, draft: SectionDraft) => string;
  updateSection: (venueId: string, zoneId: string, sectionId: string, draft: SectionDraft) => void;
  deleteSection: (venueId: string, zoneId: string, sectionId: string) => void;
  updateCustomerExperience: (settings: CustomerExperienceSettings) => void;
  updateStaffAccess: (settings: StaffAccessSettings) => void;
  submitCustomerFeedback: (feedback: Omit<CustomerFeedback, "id" | "submittedAt">) => void;
  replaceData: (next: SeatServeData, reason?: string) => void;
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
    },
    staffAccess: { ...(seedData.staffAccess ?? {}), ...(safe.staffAccess ?? {}) },
    feedback,
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
    const config = getSyncConfig();
    if (!config.connected || !config.endpointUrl.trim() || !navigator.onLine) return () => { cancelled = true; };

    const poll = async () => {
      try {
        const result = await pollGoogleSheets(currentDataRef.current);
        if (!cancelled && result.data) {
          const migrated = migrateData(result.data);
          const serialized = JSON.stringify(migrated);
          if (serialized !== serializedDataRef.current) {
            replacingDataRef.current = true;
            serializedDataRef.current = serialized;
            setData(migrated);
          }
        }
      } catch {
        // Local and cross-tab updates continue even when the remote endpoint is unavailable.
      }
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, 4000);
    const onVisible = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", onVisible);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [workspaceRevision]);

  useEffect(() => {
    let cancelled = false;
    window.clearTimeout(autoSyncTimerRef.current);
    autoSyncTimerRef.current = undefined;

    currentDataRef.current = data;
    const serialized = JSON.stringify(data);
    serializedDataRef.current = serialized;
    localStorage.setItem(getActiveDataStorageKey(), serialized);
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
      activity: pushActivity(current, `Event ${draft.name} updated`, "info"),
    }));
  };

  const duplicateEvent = (eventId: string) => {
    setData((current) => {
      const source = current.events.find((event) => event.id === eventId);
      if (!source) return current;
      const copy = { ...source, id: crypto.randomUUID(), name: `${source.name} Copy`, status: "draft" as const, orderingEnabled: false };
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
      activity: pushActivity(current, `Customer ordering ${enabled ? "opened" : "closed"}`, enabled ? "success" : "warning"),
    }));
  };

  const placeOrder = (draft: OrderDraft) => {
    const id = `SS-${Math.floor(1000 + Math.random() * 9000)}`;
    setData((current) => ({
      ...current,
      orders: [{ ...draft, id, placedAt: new Date().toISOString(), status: "new" }, ...current.orders],
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
        ready: ["assigned", "cancelled"],
        assigned: ["delivering", "ready", "cancelled"],
        delivering: ["delivered", "cancelled"],
        delivered: [],
        cancelled: [],
      };
      if (!allowedTransitions[order.status].includes(status)) {
        return { ...current, activity: pushActivity(current, `Blocked invalid order transition ${order.id}: ${order.status} → ${status}`, "warning") };
      }
      if (status === "delivering" && !order.runnerId) {
        return { ...current, activity: pushActivity(current, `Order ${order.id} cannot leave the kitchen without an assigned runner`, "warning") };
      }
      const requiresPayment = order.paymentMethod === "cash" || order.paymentMethod === "card";
      if (status === "delivered" && requiresPayment && !order.paymentCollectedAt) {
        return { ...current, activity: pushActivity(current, `Order ${order.id} cannot be delivered until payment is collected`, "warning") };
      }

      const now = new Date().toISOString();
      const timestampPatch = status === "preparing" ? { acceptedAt: order.acceptedAt ?? now, preparingAt: order.preparingAt ?? now }
        : status === "ready" ? { readyAt: order.readyAt ?? now }
        : status === "assigned" ? { assignedAt: order.assignedAt ?? now }
        : status === "delivering" ? { deliveringAt: order.deliveringAt ?? now }
        : status === "delivered" ? { deliveredAt: order.deliveredAt ?? now }
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
        orders: current.orders.map((item) => item.id === orderId ? { ...item, status, ...timestampPatch, ...(status === "ready" ? { runnerId: undefined, assignedAt: undefined } : {}) } : item),
        runners: runnerAfterStatus,
        activity: pushActivity(current, `Order ${orderId} moved to ${status}`, status === "cancelled" ? "warning" : status === "delivered" ? "success" : "info"),
      };
    });
  };


  const markOrderPaymentCollected = (orderId: string) => {
    setData((current) => {
      const order = current.orders.find((item) => item.id === orderId);
      if (!order || order.paymentCollectedAt) return current;
      const now = new Date().toISOString();
      const methodLabel = order.paymentMethod === "card" ? "card payment" : "exact cash payment";
      return {
        ...current,
        orders: current.orders.map((item) => item.id === orderId ? { ...item, paymentCollectedAt: now } : item),
        activity: pushActivity(current, `${methodLabel} collected for order ${orderId}`, "success"),
      };
    });
  };

  const requestSeatBeacon = (orderId: string) => setData((current) => {
    const order = current.orders.find((item) => item.id === orderId);
    if (!order || order.status !== "delivering") return current;
    const now = new Date().toISOString();
    return { ...current, orders: current.orders.map((item) => item.id === orderId ? { ...item, seatBeaconRequestedAt: now } : item), activity: pushActivity(current, `SeatBeacon requested for order ${orderId}`, "info") };
  });
  const markSeatBeaconOpened = (orderId: string) => setData((current) => {
    const order = current.orders.find((item) => item.id === orderId);
    if (!order || order.seatBeaconOpenedAt) return current;
    const now = new Date().toISOString();
    return { ...current, orders: current.orders.map((item) => item.id === orderId ? { ...item, seatBeaconOpenedAt: now } : item), activity: pushActivity(current, `SeatBeacon activated for order ${orderId}`, "success") };
  });
  const markCustomerLocated = (orderId: string) => setData((current) => {
    const order = current.orders.find((item) => item.id === orderId);
    if (!order || order.status !== "delivering" || order.customerLocatedAt) return current;
    const now = new Date().toISOString();
    return { ...current, orders: current.orders.map((item) => item.id === orderId ? { ...item, customerLocatedAt: now } : item), activity: pushActivity(current, `Customer located for order ${orderId}`, "success") };
  });

  const getZoneEstimate = (current: SeatServeData, order: Order) => {
    const zone = current.venues.find((venue) => venue.id === order.location.venueId)?.zones.find((item) => item.id === order.location.zoneId);
    return zone?.learnedRoundTripMinutes ?? zone?.baselineRoundTripMinutes ?? 8;
  };

  const assignRunnerToOrder = (orderId: string, runnerId?: string) => {
    setData((current) => {
      const order = current.orders.find((item) => item.id === orderId);
      if (!order || !["ready", "assigned", "delivering"].includes(order.status)) return current;
      if (runnerId) {
        const requestedRunner = current.runners.find((runner) => runner.id === runnerId);
        const runnerIsCurrent = requestedRunner?.id === order.runnerId;
        if (!requestedRunner || !requestedRunner.active || (!runnerIsCurrent && (requestedRunner.status !== "available" || requestedRunner.activeOrderId))) {
          return { ...current, activity: pushActivity(current, `Runner assignment blocked for order ${orderId}; selected runner is not available`, "warning") };
        }
      }
      const now = new Date();
      const estimateMinutes = getZoneEstimate(current, order);
      const estimatedAvailableAt = new Date(now.getTime() + estimateMinutes * 60_000).toISOString();
      const nextStatus: Order["status"] = runnerId ? (order.status === "ready" ? "assigned" : order.status) : (order.status === "assigned" ? "ready" : order.status);
      return {
        ...current,
        orders: current.orders.map((item) => item.id === orderId ? { ...item, runnerId, status: nextStatus, assignedAt: runnerId ? now.toISOString() : undefined, assignmentQueuedAt: undefined } : item),
        runners: current.runners.map((runner) => {
          if (runner.id === order.runnerId && runner.id !== runnerId) return { ...runner, status: "available" as const, activeOrderId: undefined, assignedAt: undefined, estimatedAvailableAt: undefined, availableSince: now.toISOString() };
          if (runner.id === runnerId) return { ...runner, status: "assigned" as const, activeOrderId: orderId, assignedAt: now.toISOString(), estimatedAvailableAt, availableSince: undefined };
          return runner;
        }),
        activity: pushActivity(current, runnerId ? `Runner assigned to order ${orderId}` : `Runner removed from order ${orderId}`, "info"),
      };
    });
  };

  const autoAssignRunner = (orderId: string) => {
    let assignedRunnerId: string | undefined;
    setData((current) => {
      const order = current.orders.find((item) => item.id === orderId);
      if (!order || (order.status !== "ready" && order.status !== "assigned")) return current;
      const available = current.runners
        .filter((runner) => runner.active && runner.status === "available" && !runner.activeOrderId)
        .sort((a, b) => {
          const waited = new Date(a.availableSince ?? 0).getTime() - new Date(b.availableSince ?? 0).getTime();
          return waited || a.completedDeliveries - b.completedDeliveries;
        });
      const runner = available[0];
      if (!runner) {
        const queuedAt = order.assignmentQueuedAt ?? new Date().toISOString();
        return {
          ...current,
          orders: current.orders.map((item) => item.id === orderId ? { ...item, assignmentQueuedAt: queuedAt } : item),
          activity: pushActivity(current, `Order ${orderId} queued for the next available runner`, "warning"),
        };
      }
      assignedRunnerId = runner.id;
      const now = new Date();
      const estimateMinutes = getZoneEstimate(current, order);
      const estimatedAvailableAt = new Date(now.getTime() + estimateMinutes * 60_000).toISOString();
      return {
        ...current,
        orders: current.orders.map((item) => item.id === orderId ? { ...item, runnerId: runner.id, status: "assigned" as const, assignedAt: now.toISOString(), assignmentQueuedAt: undefined } : item),
        runners: current.runners.map((item) => item.id === runner.id ? { ...item, status: "assigned" as const, activeOrderId: orderId, assignedAt: now.toISOString(), estimatedAvailableAt, availableSince: undefined } : item),
        activity: pushActivity(current, `${runner.name} auto-assigned to order ${orderId}`, "success"),
      };
    });
    return assignedRunnerId;
  };

  const markRunnerAvailable = (runnerId: string) => {
    setData((current) => {
      const runner = current.runners.find((item) => item.id === runnerId);
      if (!runner) return current;
      const order = current.orders.find((item) => item.id === runner.activeOrderId);
      if (runner.status !== "returning" || !order || order.status !== "delivered") {
        return { ...current, activity: pushActivity(current, `${runner.name} cannot be returned to the queue until the active delivery is complete`, "warning") };
      }
      const now = new Date();
      let venues = current.venues;
      if (order?.assignedAt) {
        const actualMinutes = Math.max(1, (now.getTime() - new Date(order.assignedAt).getTime()) / 60_000);
        venues = current.venues.map((venue) => venue.id !== order.location.venueId ? venue : {
          ...venue,
          zones: venue.zones.map((zone) => {
            if (zone.id !== order.location.zoneId) return zone;
            const previous = zone.learnedRoundTripMinutes ?? zone.baselineRoundTripMinutes ?? actualMinutes;
            const learnedRoundTripMinutes = Number((previous * 0.7 + actualMinutes * 0.3).toFixed(1));
            return { ...zone, learnedRoundTripMinutes, completedTripCount: (zone.completedTripCount ?? 0) + 1 };
          }),
        });
      }
      const liveEventId = current.events.find((event) => event.status === "live")?.id;
      const queuedOrder = current.orders
        .filter((item) => item.status === "ready" && item.assignmentQueuedAt && (!liveEventId || item.eventId === liveEventId))
        .sort((a, b) => new Date(a.assignmentQueuedAt!).getTime() - new Date(b.assignmentQueuedAt!).getTime())[0];
      if (queuedOrder) {
        const estimateMinutes = getZoneEstimate(current, queuedOrder);
        const estimatedAvailableAt = new Date(now.getTime() + estimateMinutes * 60_000).toISOString();
        return {
          ...current,
          venues,
          orders: current.orders.map((item) => item.id === queuedOrder.id ? { ...item, runnerId, status: "assigned" as const, assignedAt: now.toISOString(), assignmentQueuedAt: undefined } : item),
          runners: current.runners.map((item) => item.id === runnerId ? {
            ...item,
            status: "assigned" as const,
            activeOrderId: queuedOrder.id,
            assignedAt: now.toISOString(),
            estimatedAvailableAt,
            availableSince: undefined,
            completedDeliveries: order?.status === "delivered" ? item.completedDeliveries + 1 : item.completedDeliveries,
          } : item),
          activity: pushActivity(current, `${runner.name} returned and was assigned to queued order ${queuedOrder.id}`, "success"),
        };
      }
      return {
        ...current,
        venues,
        runners: current.runners.map((item) => item.id === runnerId ? {
          ...item,
          status: "available" as const,
          activeOrderId: undefined,
          assignedAt: undefined,
          estimatedAvailableAt: undefined,
          availableSince: now.toISOString(),
          completedDeliveries: order?.status === "delivered" ? item.completedDeliveries + 1 : item.completedDeliveries,
        } : item),
        activity: pushActivity(current, `${runner.name} returned and is available`, "success"),
      };
    });
  };

  const cancelOrder = (orderId: string) => updateOrderStatus(orderId, "cancelled");


  const addRunner = (draft: RunnerDraft) => {
    const id = crypto.randomUUID();
    setData((current) => ({ ...current, runners: [...current.runners, { ...draft, id, completedDeliveries: 0, rating: 5 }], activity: pushActivity(current, `${draft.name} added to runner roster`, "success") }));
    return id;
  };
  const updateRunner = (runnerId: string, draft: RunnerDraft) => setData((current) => ({ ...current, runners: current.runners.map((runner) => runner.id === runnerId ? { ...runner, ...draft } : runner), activity: pushActivity(current, `${draft.name} runner profile updated`, "info") }));
  const duplicateRunner = (runnerId: string) => setData((current) => {
    const source = current.runners.find((runner) => runner.id === runnerId);
    if (!source) return current;
    const copy: Runner = { ...source, id: crypto.randomUUID(), name: `${source.name} Copy`, email: "", phone: "", status: "offline", activeOrderId: undefined, completedDeliveries: 0, rating: 5 };
    return { ...current, runners: [...current.runners, copy], activity: pushActivity(current, `${source.name} duplicated`, "info") };
  });
  const deleteRunner = (runnerId: string) => {
    if (data.runners.some((runner) => runner.id === runnerId && runner.activeOrderId)) return false;
    setData((current) => ({ ...current, runners: current.runners.filter((runner) => runner.id !== runnerId), activity: pushActivity(current, "Runner removed", "warning") }));
    return true;
  };
  const setRunnerStatus = (runnerId: string, status: RunnerStatus) => setData((current) => {
    const runner = current.runners.find((item) => item.id === runnerId);
    if (!runner) return current;
    if (status !== "available" && status !== "offline") {
      return { ...current, activity: pushActivity(current, "Busy and Returning runner states are controlled by active deliveries", "warning") };
    }
    if (runner.activeOrderId || runner.status === "assigned" || runner.status === "returning") {
      return { ...current, activity: pushActivity(current, `${runner.name} cannot change availability while an order is active`, "warning") };
    }
    const now = new Date().toISOString();
    return {
      ...current,
      runners: current.runners.map((item) => item.id === runnerId ? {
        ...item,
        status,
        availableSince: status === "available" ? now : undefined,
      } : item),
      activity: pushActivity(current, `Runner status changed to ${status}`, "info"),
    };
  });

  const addMenuItem = (draft: MenuItemDraft) => {
    const id = crypto.randomUUID();
    setData((current) => ({ ...current, menuItems: [...current.menuItems, { ...draft, id }], activity: pushActivity(current, `${draft.name} added to menu`, "success") }));
    return id;
  };
  const updateMenuItem = (itemId: string, draft: MenuItemDraft) => setData((current) => ({ ...current, menuItems: current.menuItems.map((item) => item.id === itemId ? { ...item, ...draft } : item), activity: pushActivity(current, `${draft.name} updated`, "info") }));
  const deleteMenuItem = (itemId: string) => setData((current) => ({ ...current, menuItems: current.menuItems.filter((item) => item.id !== itemId), activity: pushActivity(current, "Menu item deleted", "warning") }));

  const addMenuCategory = (draft: MenuCategoryDraft) => {
    const id = crypto.randomUUID();
    setData((current) => ({ ...current, menuCategories: [...(current.menuCategories ?? []), { ...draft, id }], activity: pushActivity(current, `${draft.name} category added`, "success") }));
    return id;
  };
  const updateMenuCategory = (categoryId: string, draft: MenuCategoryDraft) => setData((current) => {
    return { ...current, menuCategories: current.menuCategories.map((category) => category.id === categoryId ? { ...category, ...draft } : category), menuItems: current.menuItems.map((item) => item.categoryId === categoryId ? { ...item, category: draft.name } : item), activity: pushActivity(current, `${draft.name} category updated`, "info") };
  });
  const reorderMenuCategories = (orderedIds: string[]) => {
    setData((current) => {
      const order = new Map(orderedIds.map((id, index) => [id, index + 1]));
      return { ...current, menuCategories: current.menuCategories.map((category) => ({ ...category, sortOrder: order.get(category.id) ?? category.sortOrder })) };
    });
  };

  const reorderMenuItems = (categoryId: string, orderedIds: string[]) => {
    setData((current) => {
      const rank = new Map(orderedIds.map((id, index) => [id, index]));
      const inCategory = current.menuItems.filter((item) => item.categoryId === categoryId);
      const sorted = [...inCategory].sort((a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999));
      const positions = current.menuItems.map((item, index) => item.categoryId === categoryId ? index : -1).filter((index) => index >= 0);
      const next = [...current.menuItems];
      positions.forEach((position, index) => { next[position] = sorted[index]; });
      return { ...current, menuItems: next };
    });
  };

  const deleteMenuCategory = (categoryId: string) => {
    if (data.menuItems.some((item) => item.categoryId === categoryId)) return false;
    setData((current) => ({ ...current, menuCategories: current.menuCategories.filter((category) => category.id !== categoryId), activity: pushActivity(current, "Menu category deleted", "warning") }));
    return true;
  };
  const addMenu = (draft: MenuDefinitionDraft) => {
    const id = crypto.randomUUID();
    setData((current) => ({ ...current, menus: [...(current.menus ?? []), { ...draft, id }], activity: pushActivity(current, `${draft.name} menu added`, "success") }));
    return id;
  };
  const updateMenu = (menuId: string, draft: MenuDefinitionDraft) => setData((current) => ({ ...current, menus: current.menus.map((menu) => menu.id === menuId ? { ...menu, ...draft } : menu), activity: pushActivity(current, `${draft.name} menu updated`, "info") }));
  const deleteMenu = (menuId: string) => {
    if (data.events.some((event) => event.menuId === menuId)) return false;
    setData((current) => ({ ...current, menus: current.menus.filter((menu) => menu.id !== menuId), activity: pushActivity(current, "Menu deleted", "warning") }));
    return true;
  };
  const assignMenuToEvent = (eventId: string, menuId?: string) => setData((current) => ({ ...current, events: current.events.map((event) => event.id === eventId ? { ...event, menuId } : event), activity: pushActivity(current, "Event menu assignment updated", "info") }));

  const addVenue = (draft: VenueDraft) => {
    const id = crypto.randomUUID();
    setData((current) => ({ ...current, venues: [...current.venues, { ...draft, id, zones: [] }], activity: pushActivity(current, `${draft.name} venue created`, "success") }));
    return id;
  };
  const updateVenue = (venueId: string, draft: VenueDraft) => setData((current) => ({ ...current, venues: current.venues.map((venue) => venue.id === venueId ? { ...venue, ...draft } : venue), activity: pushActivity(current, `${draft.name} venue updated`, "info") }));
  const duplicateVenue = (venueId: string) => setData((current) => {
    const source = current.venues.find((venue) => venue.id === venueId);
    if (!source) return current;
    const copy: Venue = { ...source, id: crypto.randomUUID(), name: `${source.name} Copy`, active: false, zones: source.zones.map((zone) => ({ ...zone, id: crypto.randomUUID(), sections: zone.sections.map((section) => ({ ...section, id: crypto.randomUUID() })) })) };
    return { ...current, venues: [...current.venues, copy], activity: pushActivity(current, `${source.name} duplicated`, "info") };
  });
  const deleteVenue = (venueId: string) => {
    if (data.events.some((event) => event.venueId === venueId)) return false;
    setData((current) => ({ ...current, venues: current.venues.filter((item) => item.id !== venueId), activity: pushActivity(current, "Venue deleted", "warning") }));
    return true;
  };
  const addZone = (venueId: string, draft: ZoneDraft) => {
    const id = crypto.randomUUID();
    setData((current) => ({ ...current, venues: current.venues.map((venue) => venue.id === venueId ? { ...venue, zones: [...venue.zones, { ...draft, id, sections: [] }] } : venue), activity: pushActivity(current, `${draft.name} delivery zone added`, "success") }));
    return id;
  };
  const updateZone = (venueId: string, zoneId: string, draft: ZoneDraft) => setData((current) => ({ ...current, venues: current.venues.map((venue) => venue.id === venueId ? { ...venue, zones: venue.zones.map((zone) => zone.id === zoneId ? { ...zone, ...draft } : zone) } : venue), activity: pushActivity(current, `${draft.name} delivery zone updated`, "info") }));
  const deleteZone = (venueId: string, zoneId: string) => setData((current) => ({ ...current, venues: current.venues.map((venue) => venue.id === venueId ? { ...venue, zones: venue.zones.filter((zone) => zone.id !== zoneId) } : venue), activity: pushActivity(current, "Delivery zone deleted", "warning") }));
  const addSection = (venueId: string, zoneId: string, draft: SectionDraft) => {
    const id = crypto.randomUUID();
    setData((current) => ({ ...current, venues: current.venues.map((venue) => venue.id === venueId ? { ...venue, zones: venue.zones.map((zone) => zone.id === zoneId ? { ...zone, sections: [...zone.sections, { ...draft, id }] } : zone) } : venue), activity: pushActivity(current, `${draft.name} section added`, "success") }));
    return id;
  };
  const updateSection = (venueId: string, zoneId: string, sectionId: string, draft: SectionDraft) => setData((current) => ({ ...current, venues: current.venues.map((venue) => venue.id === venueId ? { ...venue, zones: venue.zones.map((zone) => zone.id === zoneId ? { ...zone, sections: zone.sections.map((section) => section.id === sectionId ? { ...section, ...draft } : section) } : zone) } : venue), activity: pushActivity(current, `${draft.name} section updated`, "info") }));
  const deleteSection = (venueId: string, zoneId: string, sectionId: string) => setData((current) => ({ ...current, venues: current.venues.map((venue) => venue.id === venueId ? { ...venue, zones: venue.zones.map((zone) => zone.id === zoneId ? { ...zone, sections: zone.sections.filter((section) => section.id !== sectionId) } : zone) } : venue), activity: pushActivity(current, "Venue section deleted", "warning") }));
  const updateCustomerExperience = (settings: CustomerExperienceSettings) => {
    setData((current) => ({
      ...current,
      customerExperience: settings,
      activity: pushActivity(current, "Customer experience settings updated", "success"),
    }));
  };

  const updateStaffAccess = (settings: StaffAccessSettings) => {
    setData((current) => ({ ...current, staffAccess: settings, activity: pushActivity(current, "Staff access settings updated", "success") }));
  };

  const submitCustomerFeedback = (feedback: Omit<CustomerFeedback, "id" | "submittedAt">) => {
    setData((current) => {
      if (current.feedback.some((item) => item.orderId === feedback.orderId)) return current;
      return {
        ...current,
        feedback: [{ ...feedback, id: crypto.randomUUID(), submittedAt: new Date().toISOString() }, ...current.feedback],
        activity: pushActivity(current, `Customer feedback received for order ${feedback.orderId}`, "success"),
      };
    });
  };

  const replaceData = (next: SeatServeData, reason = "SeatServe data replaced") => {
    createLocalBackup(data, "before-data-replace");
    replacingDataRef.current = true;
    setData(migrateData({
      ...next,
      activity: [activity(reason, "success"), ...(next.activity ?? [])].slice(0, 20),
    }));
  };
  const resetDemoData = () => {
    createLocalBackup(data, "before-demo-reset");
    setData(seedData);
  };

  const repairWorkspaceData = () => {
    createLocalBackup(data, "before-workspace-repair");
    setData((current) => {
      const menuIds = new Set(current.menus.map((menu) => menu.id));
      const itemIds = new Set(current.menuItems.map((item) => item.id));
      const orderIds = new Set(current.orders.filter((order) => order.status !== "delivered" && order.status !== "cancelled").map((order) => order.id));
      const repairedEvents = current.events.map((event) => event.menuId && !menuIds.has(event.menuId) ? { ...event, menuId: undefined } : event);
      const repairedMenus = current.menus.map((menu) => ({
        ...menu,
        itemIds: menu.itemIds.filter((id) => itemIds.has(id)),
        hiddenItemIds: (menu.hiddenItemIds ?? []).filter((id) => itemIds.has(id)),
        priceOverrides: Object.fromEntries(Object.entries(menu.priceOverrides ?? {}).filter(([id]) => itemIds.has(id))),
      }));
      const repairedRunners = current.runners.map((runner) => runner.activeOrderId && !orderIds.has(runner.activeOrderId) ? { ...runner, activeOrderId: undefined, status: runner.status === "assigned" || runner.status === "returning" ? "available" as const : runner.status, availableSince: new Date().toISOString(), assignedAt: undefined, estimatedAvailableAt: undefined } : runner);
      return { ...current, events: repairedEvents, menus: repairedMenus, runners: repairedRunners, activity: pushActivity(current, "Workspace links repaired and stale references removed", "success") };
    });
  };

  return <SeatServeContext.Provider value={{ data, activeEvent, addEvent, updateEvent, duplicateEvent, deleteEvent, startEvent, completeEvent, setOrderingEnabled, placeOrder, updateOrderStatus, markOrderPaymentCollected, requestSeatBeacon, markSeatBeaconOpened, markCustomerLocated, assignRunnerToOrder, autoAssignRunner, markRunnerAvailable, cancelOrder, addRunner, updateRunner, duplicateRunner, deleteRunner, setRunnerStatus, addMenuItem, updateMenuItem, deleteMenuItem, addMenuCategory, updateMenuCategory, reorderMenuCategories, reorderMenuItems, deleteMenuCategory, addMenu, updateMenu, deleteMenu, assignMenuToEvent, addVenue, updateVenue, duplicateVenue, deleteVenue, addZone, updateZone, deleteZone, addSection, updateSection, deleteSection, updateCustomerExperience, updateStaffAccess, submitCustomerFeedback, replaceData, resetDemoData, repairWorkspaceData }}>{children}</SeatServeContext.Provider>;
}

export function useSeatServe() {
  const context = useContext(SeatServeContext);
  if (!context) throw new Error("useSeatServe must be used inside SeatServeProvider");
  return context;
}
