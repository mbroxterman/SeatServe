import type { SeatServeData } from "../types/domain";

const CONFIG_KEY = "seatserve.googleSheets.config.v1";
const STATUS_KEY = "seatserve.googleSheets.status.v1";

export interface GoogleSheetsConfig {
  webAppUrl: string;
  syncToken: string;
  autoSync: boolean;
}

export interface GoogleSheetsStatus {
  state: "not-configured" | "idle" | "syncing" | "success" | "error";
  message: string;
  lastSyncedAt?: string;
}

const defaultConfig: GoogleSheetsConfig = { webAppUrl: "", syncToken: "", autoSync: false };

export function getGoogleSheetsConfig(): GoogleSheetsConfig {
  try { return { ...defaultConfig, ...JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "{}") }; }
  catch { return defaultConfig; }
}

export function saveGoogleSheetsConfig(config: GoogleSheetsConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent("seatserve-google-config-changed"));
}

export function getGoogleSheetsStatus(): GoogleSheetsStatus {
  try { return JSON.parse(localStorage.getItem(STATUS_KEY) ?? "null") ?? { state: "not-configured", message: "Google Sheets is not configured." }; }
  catch { return { state: "error", message: "Unable to read sync status." }; }
}

function setStatus(status: GoogleSheetsStatus) {
  localStorage.setItem(STATUS_KEY, JSON.stringify(status));
  window.dispatchEvent(new CustomEvent("seatserve-google-status-changed", { detail: status }));
}

function validateConfig(config: GoogleSheetsConfig) {
  if (!config.webAppUrl.startsWith("https://script.google.com/")) throw new Error("Enter a valid deployed Google Apps Script web app URL.");
  if (!config.syncToken.trim()) throw new Error("Enter the sync token configured in Apps Script.");
}

export async function pushDataToGoogleSheets(data: SeatServeData, config = getGoogleSheetsConfig()) {
  validateConfig(config);
  setStatus({ state: "syncing", message: "Saving SeatServe data to Google Sheets…" });
  try {
    const response = await fetch(config.webAppUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "save", token: config.syncToken, data }),
    });
    const result = await response.json() as { ok?: boolean; error?: string; updatedAt?: string };
    if (!response.ok || !result.ok) throw new Error(result.error || "Google Sheets rejected the save request.");
    const lastSyncedAt = result.updatedAt ?? new Date().toISOString();
    setStatus({ state: "success", message: "All configuration data is saved to Google Sheets.", lastSyncedAt });
    return lastSyncedAt;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save to Google Sheets.";
    setStatus({ state: "error", message });
    throw error;
  }
}

export async function pullDataFromGoogleSheets(config = getGoogleSheetsConfig()): Promise<SeatServeData> {
  validateConfig(config);
  setStatus({ state: "syncing", message: "Loading SeatServe data from Google Sheets…" });
  try {
    const url = new URL(config.webAppUrl);
    url.searchParams.set("action", "load");
    url.searchParams.set("token", config.syncToken);
    const response = await fetch(url.toString());
    const result = await response.json() as { ok?: boolean; error?: string; data?: SeatServeData; updatedAt?: string };
    if (!response.ok || !result.ok || !result.data) throw new Error(result.error || "No SeatServe data was returned from Google Sheets.");
    const lastSyncedAt = result.updatedAt ?? new Date().toISOString();
    setStatus({ state: "success", message: "SeatServe data loaded from Google Sheets.", lastSyncedAt });
    return result.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load from Google Sheets.";
    setStatus({ state: "error", message });
    throw error;
  }
}

export function downloadSeatServeBackup(data: SeatServeData) {
  const blob = new Blob([JSON.stringify({ schemaVersion: 3, exportedAt: new Date().toISOString(), data }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `seatserve-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
