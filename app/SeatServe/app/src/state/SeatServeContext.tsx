import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { seedData } from "../data/seed";
import { createLocalBackup, getActiveDataStorageKey, getActiveWorkspaceId, getSyncConfig, markLocalChange, pullFromGoogleSheets, pushToGoogleSheets } from "../services/persistence";
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
  submitCustomerFeedback: (feedback: Omit<CustomerFeedback, "id" | "submittedAt">) => void;
  replaceData: (next: SeatServeData, reason?: string) => void;
  resetDemoData: () => void;
}

const SeatServeContext = createContext<SeatServeContextValue | undefined>(undefined);

const migrateData = (candidate: SeatServeData): SeatServeData => ({
  ...candidate,
  venues: candidate.venues.map((venue) => ({
    ...venue,
    address: venue.address ?? "",
    zones: (venue.zones ?? []).map((zone, index) => ({
      ...zone,
      sections: zone.sections ?? [],
      baselineRoundTripMinutes: zone.baselineRoundTripMinutes ?? Math.max(4, 12 - index * 2),
      learnedRoundTripMinutes: zone.learnedRoundTripMinutes,
      completedTripCount: zone.completedTripCount ?? 0,
    })),
  })),
  runners: candidate.runners.map((runner) => ({
    ...runner,
    availableSince: runner.availableSince ?? (runner.status === "available" ? new Date().toISOString() : undefined),
  })),
  menuCategories: candidate.menuCategories ?? [],
  menus: candidate.menus ?? [],
  menuItems: candidate.menuItems.map((item) => ({ ...item, description: item.description ?? "" })),
  customerExperience: {
    ...seedData.customerExperience,
    ...(candidate.customerExperience ?? {}),
    deliveryFee: Number.isFinite(candidate.customerExperience?.deliveryFee) ? Math.max(0, candidate.customerExperience.deliveryFee) : seedData.customerExperience.deliveryFee,
    taxRatePercent: Number.isFinite(candidate.customerExperience?.taxRatePercent) ? Math.max(0, candidate.customerExperience.taxRatePercent) : seedData.customerExperience.taxRatePercent,
    estimatedCardFeePercent: Number.isFinite(candidate.customerExperience?.estimatedCardFeePercent) ? Math.max(0, candidate.customerExperience.estimatedCardFeePercent) : seedData.customerExperience.estimatedCardFeePercent,
    estimatedCardFeeFixed: Number.isFinite(candidate.customerExperience?.estimatedCardFeeFixed) ? Math.max(0, candidate.customerExperience.estimatedCardFeeFixed) : seedData.customerExperience.estimatedCardFeeFixed,
    cashPaymentsEnabled: candidate.customerExperience?.cashPaymentsEnabled ?? seedData.customerExperience.cashPaymentsEnabled,
    cardPaymentsEnabled: candidate.customerExperience?.cardPaymentsEnabled ?? seedData.customerExperience.cardPaymentsEnabled,
  },
  feedback: candidate.feedback ?? [],
  orders: candidate.orders.map((order) => ({
    ...order,
    items: order.items ?? [],
    customer: order.customer ?? { name: "Guest" },
    location: order.location ?? {
      venueId: candidate.events.find((event) => event.id === order.eventId)?.venueId ?? "",
      zoneId: "",
      vertical: "middle",
      horizontal: "center",
    },
    subtotal: order.subtotal ?? Math.max(0, order.total - order.deliveryFee),
    tax: order.tax ?? 0,
    cashTotal: order.cashTotal ?? order.total,
    estimatedCardFee: order.estimatedCardFee ?? 0,
    cardTotal: order.cardTotal ?? order.total,
  })),
});

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
  const didMountRef = useRef(false);
  const replacingDataRef = useRef(false);
  const autoSyncTimerRef = useRef<number | undefined>(undefined);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const instanceIdRef = useRef(crypto.randomUUID());
  const serializedDataRef = useRef("");

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
    const onWorkspaceSwitch = () => refreshFromLocalStorage();
    const onVisibility = () => { if (document.visibilityState === "visible") refreshFromLocalStorage(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("seatserve:workspace-switched", onWorkspaceSwitch);
    window.addEventListener("focus", refreshFromLocalStorage);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      channelRef.current?.close();
      channelRef.current = null;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("seatserve:workspace-switched", onWorkspaceSwitch);
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
        const result = await pullFromGoogleSheets(data);
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.clearTimeout(autoSyncTimerRef.current);
    autoSyncTimerRef.current = undefined;

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
      if (!order) return current;
      const now = new Date().toISOString();
      const timestampPatch = status === "preparing" ? { acceptedAt: order.acceptedAt ?? now, preparingAt: now }
        : status === "ready" ? { readyAt: now }
        : status === "assigned" ? { assignedAt: order.assignedAt ?? now }
        : status === "delivering" ? { deliveringAt: now }
        : status === "delivered" ? { deliveredAt: now }
        : {};
      const runnerAfterStatus = current.runners.map((runner) => {
        if (runner.id !== order.runnerId) return runner;
        if (status === "delivered") return { ...runner, status: "returning" as const, activeOrderId: orderId };
        if (status === "cancelled") return { ...runner, status: "available" as const, activeOrderId: undefined, assignedAt: undefined, estimatedAvailableAt: undefined, availableSince: now };
        return runner;
      });
      return {
        ...current,
        orders: current.orders.map((item) => item.id === orderId ? { ...item, status, ...timestampPatch } : item),
        runners: runnerAfterStatus,
        activity: pushActivity(current, `Order ${orderId} moved to ${status}`, status === "cancelled" ? "warning" : status === "delivered" ? "success" : "info"),
      };
    });
  };

  const getZoneEstimate = (current: SeatServeData, order: Order) => {
    const zone = current.venues.find((venue) => venue.id === order.location.venueId)?.zones.find((item) => item.id === order.location.zoneId);
    return zone?.learnedRoundTripMinutes ?? zone?.baselineRoundTripMinutes ?? 8;
  };

  const assignRunnerToOrder = (orderId: string, runnerId?: string) => {
    setData((current) => {
      const order = current.orders.find((item) => item.id === orderId);
      if (!order) return current;
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
      const queuedOrder = current.orders
        .filter((item) => item.status === "ready" && item.assignmentQueuedAt)
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
    const now = new Date().toISOString();
    return {
      ...current,
      runners: current.runners.map((runner) => runner.id === runnerId ? {
        ...runner,
        status,
        availableSince: status === "available" ? now : runner.availableSince,
      } : runner),
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

  return <SeatServeContext.Provider value={{ data, activeEvent, addEvent, updateEvent, duplicateEvent, deleteEvent, startEvent, completeEvent, setOrderingEnabled, placeOrder, updateOrderStatus, assignRunnerToOrder, autoAssignRunner, markRunnerAvailable, cancelOrder, addRunner, updateRunner, duplicateRunner, deleteRunner, setRunnerStatus, addMenuItem, updateMenuItem, deleteMenuItem, addMenuCategory, updateMenuCategory, reorderMenuCategories, reorderMenuItems, deleteMenuCategory, addMenu, updateMenu, deleteMenu, assignMenuToEvent, addVenue, updateVenue, duplicateVenue, deleteVenue, addZone, updateZone, deleteZone, addSection, updateSection, deleteSection, updateCustomerExperience, submitCustomerFeedback, replaceData, resetDemoData }}>{children}</SeatServeContext.Provider>;
}

export function useSeatServe() {
  const context = useContext(SeatServeContext);
  if (!context) throw new Error("useSeatServe must be used inside SeatServeProvider");
  return context;
}
