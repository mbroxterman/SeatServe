// File location: /src/state/SeatServeContext.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import type { MenuCategory, MenuDefinition, MenuItem, Order, Event, DataSnapshot, CustomerExperienceSettings } from "../types/domain";
import { v4 as uuid } from "uuid";
import { applyReducer, getActiveDataStorageKey, getMetadataStorageKey, initialState, seatServeReducer } from "./reducer";

interface SeatServeContextValue {
  data: DataSnapshot;
  isLoading: boolean;
  lastSync: Date | null;
  syncStatus: "idle" | "syncing" | "success" | "error";
  testGoogleSheetConnection: () => Promise<void>;
  pushToGoogleSheets: () => Promise<void>;
  loadFromGoogleSheets: (isAutoLoad?: boolean) => Promise<void>;
  addMenuCategory: (category: Omit<MenuCategory, "id">) => string;
  updateMenuCategory: (id: string, updates: Partial<Omit<MenuCategory, "id">>) => void;
  reorderMenuCategories: (ids: string[]) => void;
  deleteMenuCategory: (id: string) => boolean;
  addMenuItem: (item: Omit<MenuItem, "id">) => string;
  updateMenuItem: (id: string, updates: Partial<Omit<MenuItem, "id">>) => void;
  duplicateMenuItem: (id: string) => string | undefined;
  reorderMenuItems: (categoryId: string, itemIds: string[]) => void;
  deleteMenuItem: (id: string) => void;
  addOrder: (order: Omit<Order, "id" | "createdAt" | "status" | "kitchenCompletedAt" | "deliveryCompletedAt" | "eventDate">) => string;
  updateOrder: (id:string, updates: Partial<Omit<Order, "id">>) => void;
  deleteOrder: (id: string) => void;
  addEvent: (event: Omit<Event, "id">) => string;
  updateEvent: (id: string, updates: Partial<Omit<Event, "id">>) => void;
  deleteEvent: (id: string) => boolean;
  addMenu: (menu: Omit<MenuDefinition, "id">) => string;
  updateMenu: (id: string, updates: Partial<Omit<MenuDefinition, "id">>) => void;
  deleteMenu: (id: string) => boolean;
  assignMenuToEvent: (eventId: string, menuId: string | undefined) => void;
  updateCustomerExperience: (settings: Partial<CustomerExperienceSettings>) => void;
  replaceData: (snapshot: DataSnapshot, source: string) => void;
}

const SeatServeContext = createContext<SeatServeContextValue>({} as SeatServeContextValue);

export function useSeatServe() {
  const context = useContext(SeatServeContext);
  if (!context) throw new Error("useSeatServe must be used within a SeatServeProvider");
  return context;
}

export function SeatServeProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(seatServeReducer, initialState);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");

  useEffect(() => {
    dispatch({ type: "HYDRATE" });
    loadFromGoogleSheets(true).finally(() => setIsLoading(false));
  }, []);

  const getUrl = () => {
    const metadata = JSON.parse(localStorage.getItem(getMetadataStorageKey()) ?? "{}");
    return metadata.googleScriptUrl as string | undefined;
  };

  const testGoogleSheetConnection = useCallback(async () => {
    const url = getUrl();
    if (!url) {
      window.alert("Connection failed: Google Sheets URL is not configured in Settings.");
      return;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Server returned HTTP ${response.status}`);
      const result = await response.json();
      if (result.status !== "ok") throw new Error(result.message || "The endpoint returned an error.");
      window.alert("Connection successful! SeatServe can communicate with Google Sheets.");
    } catch (error) {
      console.error("Google Sheets connection test failed", error);
      window.alert(`Connection failed: Could not connect to the Google Sheets endpoint. ${error instanceof Error ? error.message : ""}`);
    }
  }, []);

  const pushToGoogleSheets = useCallback(async () => {
    const url = getUrl();
    if (!url) {
      window.alert("Sync failed: Google Sheets URL is not configured.");
      return;
    }
    setSyncStatus("syncing");
    try {
      // Use the new Netlify proxy function for POST requests
      const response = await fetch("/.netlify/functions/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleScriptUrl: url,
          data: { action: "save", payload: data },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sync failed with status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      if (result.status !== "ok") throw new Error(result.message || "The sync endpoint returned an error.");

      setSyncStatus("success");
      setLastSync(new Date());
      window.alert("Sync successful! All local data has been saved to Google Sheets.");
    } catch (error) {
      console.error("Push to Google Sheets failed", error);
      setSyncStatus("error");
      window.alert(`Sync failed. Could not save data to Google Sheets. ${error instanceof Error ? error.message : "See console for details."}`);
    }
  }, [data]);

  const loadFromGoogleSheets = useCallback(async (isAutoLoad = false) => {
    const url = getUrl();
    if (!url) {
      if (!isAutoLoad) window.alert("Load failed: Google Sheets URL is not configured.");
      else console.warn("Auto-load skipped: Google Sheets URL is not configured.");
      return;
    }
    if (!isAutoLoad) setIsLoading(true);

    try {
      const response = await fetch(`${url}?action=load`);
      if (!response.ok) throw new Error(`Server returned HTTP ${response.status}`);
      const result = await response.json();
      if (result.status !== "ok") throw new Error(result.message || "The endpoint returned an error.");

      // This is the "Complete Replace on Load" fix.
      // It dispatches a full REPLACE action instead of merging.
      dispatch({ type: "REPLACE", payload: result.payload, source: "cloud-load" });

      if (!isAutoLoad) {
        window.alert("Load successful! The latest data from Google Sheets has been loaded into the app.");
      } else {
        console.log("Auto-load successful.");
      }
    } catch (error) {
      console.error("Load from Google Sheets failed", error);
      if (!isAutoLoad) {
        window.alert(`Load failed. Could not get data from Google Sheets. ${error instanceof Error ? error.message : "Using local data instead."}`);
      } else {
        console.warn("Auto-load failed. Using local cached data.");
      }
    } finally {
      if (!isAutoLoad) setIsLoading(false);
    }
  }, []);

  const memoizedValue = useMemo(() => ({
    data,
    isLoading,
    lastSync,
    syncStatus,
    testGoogleSheetConnection,
    pushToGoogleSheets,
    loadFromGoogleSheets,
    addMenuCategory: (category: Omit<MenuCategory, "id">) => applyReducer(dispatch, { type: "ADD_CATEGORY", payload: { id: uuid(), ...category } }),
    updateMenuCategory: (id: string, updates: Partial<Omit<MenuCategory, "id">>) => dispatch({ type: "UPDATE_CATEGORY", payload: { id, updates } }),
    reorderMenuCategories: (ids: string[]) => dispatch({ type: "REORDER_CATEGORIES", payload: ids }),
    deleteMenuCategory: (id: string) => applyReducer(dispatch, { type: "DELETE_CATEGORY", payload: id }),
    addMenuItem: (item: Omit<MenuItem, "id">) => applyReducer(dispatch, { type: "ADD_ITEM", payload: { id: uuid(), ...item } }),
    updateMenuItem: (id: string, updates: Partial<Omit<MenuItem, "id">>) => dispatch({ type: "UPDATE_ITEM", payload: { id, updates } }),
    duplicateMenuItem: (id: string) => applyReducer(dispatch, { type: "DUPLICATE_ITEM", payload: id }),
    reorderMenuItems: (categoryId: string, itemIds: string[]) => dispatch({ type: "REORDER_ITEMS", payload: { categoryId, itemIds } }),
    deleteMenuItem: (id: string) => dispatch({ type: "DELETE_ITEM", payload: id }),
    addOrder: (order: Omit<Order, "id" | "createdAt" | "status" | "kitchenCompletedAt" | "deliveryCompletedAt" | "eventDate">) => {
      const event = data.events.find((event) => event.id === order.eventId);
      return applyReducer(dispatch, { type: "ADD_ORDER", payload: { id: uuid(), createdAt: new Date().toISOString(), status: "new", eventDate: event?.startsAt ?? new Date().toISOString(), ...order } });
    },
    updateOrder: (id:string, updates: Partial<Omit<Order, "id">>) => dispatch({ type: "UPDATE_ORDER", payload: { id, updates } }),
    deleteOrder: (id: string) => dispatch({ type: "DELETE_ORDER", payload: id }),
    addEvent: (event: Omit<Event, "id">) => applyReducer(dispatch, { type: "ADD_EVENT", payload: { id: uuid(), ...event } }),
    updateEvent: (id: string, updates: Partial<Omit<Event, "id">>) => dispatch({ type: "UPDATE_EVENT", payload: { id, updates } }),
    deleteEvent: (id: string) => applyReducer(dispatch, { type: "DELETE_EVENT", payload: id }),
    addMenu: (menu: Omit<MenuDefinition, "id">) => applyReducer(dispatch, { type: "ADD_MENU", payload: { id: uuid(), ...menu } }),
    updateMenu: (id: string, updates: Partial<Omit<MenuDefinition, "id">>) => dispatch({ type: "UPDATE_MENU", payload: { id, updates } }),
    deleteMenu: (id: string) => applyReducer(dispatch, { type: "DELETE_MENU", payload: id }),
    assignMenuToEvent: (eventId: string, menuId: string | undefined) => dispatch({ type: "ASSIGN_MENU", payload: { eventId, menuId } }),
    updateCustomerExperience: (settings: Partial<CustomerExperienceSettings>) => dispatch({ type: "UPDATE_CUSTOMER_EXPERIENCE", payload: settings }),
    replaceData: (snapshot: DataSnapshot, source: string) => dispatch({ type: "REPLACE", payload: snapshot, source }),
  }), [data, isLoading, lastSync, syncStatus, testGoogleSheetConnection, pushToGoogleSheets, loadFromGoogleSheets]);

  return <SeatServeContext.Provider value={memoizedValue}>{children}</SeatServeContext.Provider>;
}
