import type { SeatServeData } from "../types/domain";

export const LEGACY_DATA_STORAGE_KEY = "seatserve.core.v2";
export const WORKSPACE_REGISTRY_KEY = "seatserve.workspaces.v1";
export const ACTIVE_WORKSPACE_KEY = "seatserve.workspace.active.v1";
export const LEGACY_SYNC_CONFIG_KEY = "seatserve.sync.config.v2";
export const OLDER_SYNC_CONFIG_KEY = "seatserve.sync.config.v1";
export const BACKUP_PREFIX = "seatserve.backup.";

export type AutoSyncInterval = 0 | 30 | 60 | 300;
export type WorkspaceEnvironment = "production" | "development" | "demo";
export type SyncState = "idle" | "saving" | "saved" | "error" | "conflict";

export interface WorkspaceProfile {
  id: string;
  name: string;
  environment: WorkspaceEnvironment;
  endpointUrl: string;
  autoSync: boolean;
  autoSyncIntervalSeconds: AutoSyncInterval;
  connected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncConfig {
  endpointUrl: string;
  autoSync: boolean;
  autoSyncIntervalSeconds: AutoSyncInterval;
  workspaceName: string;
  connected: boolean;
}

export interface SyncMeta {
  state: SyncState;
  lastLocalChangeAt?: string;
  lastSuccessfulSyncAt?: string;
  lastRemoteUpdatedAt?: string;
  lastError?: string;
  pendingChanges: boolean;
  lastConnectionTestAt?: string;
  remoteWorkspaceName?: string;
}

export interface RemoteEnvelope {
  ok: boolean;
  data?: SeatServeData;
  updatedAt?: string;
  conflict?: boolean;
  message?: string;
  workspaceName?: string;
  structuredSync?: boolean;
  schemaVersion?: number;
  menuItemCount?: number;
}

export const defaultSyncConfig: SyncConfig = {
  endpointUrl: "",
  autoSync: false,
  autoSyncIntervalSeconds: 30,
  workspaceName: "Mill Valley High School",
  connected: false,
};
export const defaultSyncMeta: SyncMeta = { state: "idle", pendingChanges: false };

const DEPLOYMENT_API_URL = String(import.meta.env.VITE_SEATSERVE_API_URL ?? "").trim();
const DEPLOYMENT_WORKSPACE_NAME = String(import.meta.env.VITE_SEATSERVE_WORKSPACE_NAME ?? "").trim();

export function isDeploymentManagedSync(): boolean {
  const workspace = getActiveWorkspace();
  return Boolean(DEPLOYMENT_API_URL && workspace.environment === "production");
}

export function getDeploymentApiUrl(): string {
  return isDeploymentManagedSync() ? DEPLOYMENT_API_URL : "";
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `workspace-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeInterval(value: unknown): AutoSyncInterval {
  const numeric = Number(value);
  return ([0, 30, 60, 300] as number[]).includes(numeric) ? numeric as AutoSyncInterval : 30;
}

function workspaceDataKey(id: string): string { return `seatserve.workspace.${id}.data.v1`; }
function workspaceMetaKey(id: string): string { return `seatserve.workspace.${id}.sync-meta.v1`; }

function migrateWorkspaceRegistry(): WorkspaceProfile[] {
  const existing = readJson<WorkspaceProfile[]>(WORKSPACE_REGISTRY_KEY, []);
  if (existing.length) return existing;
  const current = readJson<Partial<SyncConfig>>(LEGACY_SYNC_CONFIG_KEY, {});
  const older = readJson<Partial<SyncConfig>>(OLDER_SYNC_CONFIG_KEY, {});
  const legacy = { ...defaultSyncConfig, ...older, ...current };
  const now = new Date().toISOString();
  const first: WorkspaceProfile = {
    id: makeId(),
    name: legacy.workspaceName?.trim() || "Mill Valley High School",
    environment: "production",
    endpointUrl: legacy.endpointUrl?.trim() || "",
    autoSync: Boolean(legacy.autoSync),
    autoSyncIntervalSeconds: normalizeInterval(legacy.autoSyncIntervalSeconds),
    connected: Boolean(legacy.connected && legacy.endpointUrl?.trim()),
    createdAt: now,
    updatedAt: now,
  };
  localStorage.setItem(WORKSPACE_REGISTRY_KEY, JSON.stringify([first]));
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, first.id);
  const legacyData = localStorage.getItem(LEGACY_DATA_STORAGE_KEY) ?? localStorage.getItem("seatserve.core.v1");
  if (legacyData) localStorage.setItem(workspaceDataKey(first.id), legacyData);
  return [first];
}

export function listWorkspaces(): WorkspaceProfile[] {
  return migrateWorkspaceRegistry().sort((a, b) => a.name.localeCompare(b.name));
}

export function getActiveWorkspaceId(): string {
  const profiles = migrateWorkspaceRegistry();
  const stored = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  if (stored && profiles.some((item) => item.id === stored)) return stored;
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, profiles[0].id);
  return profiles[0].id;
}

export function getActiveWorkspace(): WorkspaceProfile {
  const id = getActiveWorkspaceId();
  return listWorkspaces().find((item) => item.id === id) ?? listWorkspaces()[0];
}

export function getActiveDataStorageKey(): string { return workspaceDataKey(getActiveWorkspaceId()); }

export function saveWorkspace(profile: WorkspaceProfile): WorkspaceProfile {
  const now = new Date().toISOString();
  const normalized: WorkspaceProfile = {
    ...profile,
    name: profile.name.trim() || "SeatServe Workspace",
    endpointUrl: profile.endpointUrl.trim(),
    connected: Boolean(profile.connected && profile.endpointUrl.trim()),
    autoSyncIntervalSeconds: normalizeInterval(profile.autoSyncIntervalSeconds),
    updatedAt: now,
  };
  const profiles = listWorkspaces();
  const next = profiles.some((item) => item.id === normalized.id)
    ? profiles.map((item) => item.id === normalized.id ? normalized : item)
    : [...profiles, normalized];
  localStorage.setItem(WORKSPACE_REGISTRY_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("seatserve:workspaces", { detail: next }));
  window.dispatchEvent(new CustomEvent("seatserve:sync-config", { detail: getSyncConfig() }));
  return normalized;
}

export function createWorkspace(input: { name: string; environment: WorkspaceEnvironment; endpointUrl?: string }): WorkspaceProfile {
  const now = new Date().toISOString();
  const profile: WorkspaceProfile = {
    id: makeId(), name: input.name.trim() || "New Workspace", environment: input.environment,
    endpointUrl: input.endpointUrl?.trim() || "", autoSync: false, autoSyncIntervalSeconds: 30,
    connected: false, createdAt: now, updatedAt: now,
  };
  saveWorkspace(profile);
  return profile;
}

export function duplicateWorkspace(sourceId: string, name?: string): WorkspaceProfile {
  const source = listWorkspaces().find((item) => item.id === sourceId);
  if (!source) throw new Error("Workspace not found.");
  const copy = createWorkspace({ name: name?.trim() || `${source.name} Dev`, environment: "development" });
  const sourceData = localStorage.getItem(workspaceDataKey(sourceId));
  if (sourceData) localStorage.setItem(workspaceDataKey(copy.id), sourceData);
  return copy;
}

export function switchWorkspace(id: string): void {
  if (!listWorkspaces().some((item) => item.id === id)) throw new Error("Workspace not found.");
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
  window.dispatchEvent(new CustomEvent("seatserve:workspace-switched", { detail: id }));
}

export function deleteWorkspace(id: string): void {
  const profiles = listWorkspaces();
  if (profiles.length <= 1) throw new Error("At least one workspace is required.");
  const next = profiles.filter((item) => item.id !== id);
  localStorage.setItem(WORKSPACE_REGISTRY_KEY, JSON.stringify(next));
  localStorage.removeItem(workspaceDataKey(id));
  localStorage.removeItem(workspaceMetaKey(id));
  if (getActiveWorkspaceId() === id) localStorage.setItem(ACTIVE_WORKSPACE_KEY, next[0].id);
  window.dispatchEvent(new CustomEvent("seatserve:workspaces", { detail: next }));
}

export function getSyncConfig(): SyncConfig {
  const workspace = getActiveWorkspace();
  if (DEPLOYMENT_API_URL && workspace.environment === "production") {
    return {
      endpointUrl: DEPLOYMENT_API_URL,
      autoSync: true,
      autoSyncIntervalSeconds: 0,
      workspaceName: DEPLOYMENT_WORKSPACE_NAME || workspace.name,
      connected: true,
    };
  }
  return {
    endpointUrl: workspace.endpointUrl,
    autoSync: workspace.autoSync,
    autoSyncIntervalSeconds: workspace.autoSyncIntervalSeconds,
    workspaceName: workspace.name,
    connected: workspace.connected,
  };
}

export function saveSyncConfig(config: SyncConfig): void {
  const active = getActiveWorkspace();
  const deploymentManaged = DEPLOYMENT_API_URL && active.environment === "production";
  saveWorkspace({
    ...active,
    name: deploymentManaged ? active.name : config.workspaceName,
    endpointUrl: deploymentManaged ? active.endpointUrl : config.endpointUrl,
    autoSync: deploymentManaged ? true : config.autoSync,
    autoSyncIntervalSeconds: deploymentManaged ? 0 : config.autoSyncIntervalSeconds,
    connected: deploymentManaged ? active.connected : config.connected,
  });
  window.dispatchEvent(new CustomEvent("seatserve:sync-config", { detail: getSyncConfig() }));
}

export function disconnectSync(): void {
  const active = getActiveWorkspace();
  if (DEPLOYMENT_API_URL && active.environment === "production") {
    throw new Error("This production connection is managed by the Netlify deployment. Remove or change VITE_SEATSERVE_API_URL in Netlify to disconnect it.");
  }
  saveWorkspace({ ...active, endpointUrl: "", connected: false, autoSync: false });
  saveSyncMeta({ ...getSyncMeta(), state: "idle", lastError: undefined, remoteWorkspaceName: undefined });
}

export function getSyncMeta(): SyncMeta {
  return { ...defaultSyncMeta, ...readJson(workspaceMetaKey(getActiveWorkspaceId()), defaultSyncMeta) };
}

export function saveSyncMeta(meta: SyncMeta): void {
  localStorage.setItem(workspaceMetaKey(getActiveWorkspaceId()), JSON.stringify(meta));
  window.dispatchEvent(new CustomEvent("seatserve:sync-meta", { detail: meta }));
}

export function markLocalChange(): SyncMeta {
  const next: SyncMeta = { ...getSyncMeta(), state: "idle", pendingChanges: true, lastLocalChangeAt: new Date().toISOString(), lastError: undefined };
  saveSyncMeta(next); return next;
}

export function createLocalBackup(data: SeatServeData, label = "automatic"): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const key = `${BACKUP_PREFIX}${getActiveWorkspaceId()}.${stamp}.${label}`;
  localStorage.setItem(key, JSON.stringify({ createdAt: new Date().toISOString(), label, workspaceId: getActiveWorkspaceId(), data }));
  const prefix = `${BACKUP_PREFIX}${getActiveWorkspaceId()}.`;
  Object.keys(localStorage).filter((item) => item.startsWith(prefix)).sort().reverse().slice(10).forEach((item) => localStorage.removeItem(item));
  return key;
}

export function listLocalBackups(): Array<{ key: string; createdAt: string; label: string }> {
  const prefix = `${BACKUP_PREFIX}${getActiveWorkspaceId()}.`;
  return Object.keys(localStorage).filter((key) => key.startsWith(prefix)).map((key) => {
    try { const parsed = JSON.parse(localStorage.getItem(key) ?? "{}") as { createdAt?: string; label?: string }; return { key, createdAt: parsed.createdAt ?? "", label: parsed.label ?? "backup" }; }
    catch { return { key, createdAt: "", label: "backup" }; }
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function restoreLocalBackup(key: string): SeatServeData {
  const raw = localStorage.getItem(key); if (!raw) throw new Error("Backup not found.");
  const parsed = JSON.parse(raw) as { data?: SeatServeData }; if (!parsed.data) throw new Error("Backup is invalid."); return parsed.data;
}

async function parseResponse(response: Response): Promise<RemoteEnvelope> {
  const text = await response.text();
  try { return JSON.parse(text) as RemoteEnvelope; }
  catch { throw new Error(`Sync endpoint returned an invalid response (${response.status}).`); }
}
function requireEndpoint(): SyncConfig { const config = getSyncConfig(); if (!config.endpointUrl.trim()) throw new Error("Add the Google Apps Script web app URL first."); return config; }

export async function testGoogleSheetsConnection(endpointUrl: string, workspaceName: string): Promise<RemoteEnvelope> {
  const normalized = endpointUrl.trim(); if (!normalized) throw new Error("Enter the Google Apps Script web app URL.");
  const separator = normalized.includes("?") ? "&" : "?";
  const response = await fetch(`${normalized}${separator}action=status&workspace=${encodeURIComponent(workspaceName)}&cacheBust=${Date.now()}`);
  const result = await parseResponse(response); if (!result.ok) throw new Error(result.message ?? "Google Sheets connection failed.");
  const now = new Date().toISOString();
  saveSyncMeta({ ...getSyncMeta(), state: "saved", lastConnectionTestAt: now, lastRemoteUpdatedAt: result.updatedAt || getSyncMeta().lastRemoteUpdatedAt, remoteWorkspaceName: result.workspaceName || workspaceName, lastError: undefined });
  return result;
}

export async function pushToGoogleSheets(data: SeatServeData, force = false): Promise<RemoteEnvelope> {
  const config = requireEndpoint(); const meta = getSyncMeta(); saveSyncMeta({ ...meta, state: "saving", lastError: undefined });
  try {
    const response = await fetch(config.endpointUrl.trim(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "save", data, workspaceName: config.workspaceName, clientUpdatedAt: meta.lastLocalChangeAt ?? new Date().toISOString(), lastKnownRemoteUpdatedAt: meta.lastRemoteUpdatedAt, force }) });
    const result = await parseResponse(response);
    if (result.conflict) { saveSyncMeta({ ...getSyncMeta(), state: "conflict", pendingChanges: true, lastError: result.message ?? "Remote data is newer." }); return result; }
    if (!result.ok) throw new Error(result.message ?? "Google Sheets sync failed.");
    if (result.schemaVersion !== undefined && result.schemaVersion < 6) throw new Error("Google Apps Script is out of date. Replace Code.gs with the v2.1.6A version and redeploy a new web-app version.");
    if (result.menuItemCount !== undefined && result.menuItemCount !== data.menuItems.length) throw new Error(`Google Sheets saved ${result.menuItemCount} menu items, but SeatServe sent ${data.menuItems.length}. Please redeploy Code.gs and try Sync now again.`);
    const now = new Date().toISOString(); saveSyncMeta({ ...getSyncMeta(), state: "saved", pendingChanges: false, lastSuccessfulSyncAt: now, lastRemoteUpdatedAt: result.updatedAt ?? now, remoteWorkspaceName: result.workspaceName ?? config.workspaceName, lastError: undefined }); return result;
  } catch (error) { const message = error instanceof Error ? error.message : "Google Sheets sync failed."; saveSyncMeta({ ...getSyncMeta(), state: "error", pendingChanges: true, lastError: message }); throw error; }
}


export async function pollGoogleSheets(currentData: SeatServeData): Promise<RemoteEnvelope> {
  const config = requireEndpoint();
  const meta = getSyncMeta();
  if (meta.pendingChanges) return { ok: true, message: "Skipped remote poll because local changes are waiting to sync." };
  try {
    const separator = config.endpointUrl.includes("?") ? "&" : "?";
    const response = await fetch(`${config.endpointUrl.trim()}${separator}action=load&workspace=${encodeURIComponent(config.workspaceName)}&cacheBust=${Date.now()}`);
    const result = await parseResponse(response);
    if (!result.ok || !result.data) return result;
    if (result.updatedAt && meta.lastRemoteUpdatedAt && result.updatedAt === meta.lastRemoteUpdatedAt) return { ...result, data: undefined };
    createLocalBackup(currentData, "before-remote-update");
    const now = new Date().toISOString();
    saveSyncMeta({ ...getSyncMeta(), state: "saved", pendingChanges: false, lastSuccessfulSyncAt: now, lastRemoteUpdatedAt: result.updatedAt ?? now, remoteWorkspaceName: result.workspaceName ?? config.workspaceName, lastError: undefined });
    return result;
  } catch (error) {
    // Background polling must never make the local app unusable. Keep the last
    // successful state and let explicit Sync/Load actions surface connection errors.
    return { ok: false, message: error instanceof Error ? error.message : "Background sync failed." };
  }
}

export async function pullFromGoogleSheets(currentData: SeatServeData): Promise<RemoteEnvelope> {
  const config = requireEndpoint(); createLocalBackup(currentData, "before-sheet-load"); saveSyncMeta({ ...getSyncMeta(), state: "saving", lastError: undefined });
  try {
    const separator = config.endpointUrl.includes("?") ? "&" : "?";
    const response = await fetch(`${config.endpointUrl.trim()}${separator}action=load&workspace=${encodeURIComponent(config.workspaceName)}&cacheBust=${Date.now()}`);
    const result = await parseResponse(response); if (!result.ok || !result.data) throw new Error(result.message ?? "No SeatServe data was found in Google Sheets.");
    const now = new Date().toISOString(); saveSyncMeta({ ...getSyncMeta(), state: "saved", pendingChanges: false, lastSuccessfulSyncAt: now, lastRemoteUpdatedAt: result.updatedAt ?? now, remoteWorkspaceName: result.workspaceName ?? config.workspaceName, lastError: undefined }); return result;
  } catch (error) { const message = error instanceof Error ? error.message : "Google Sheets load failed."; saveSyncMeta({ ...getSyncMeta(), state: "error", lastError: message }); throw error; }
}

export function downloadJsonBackup(data: SeatServeData): void {
  const blob = new Blob([JSON.stringify({ version: 3, workspace: getActiveWorkspace(), exportedAt: new Date().toISOString(), data }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `seatserve-${getActiveWorkspace().name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url);
}

export async function readJsonBackup(file: File): Promise<SeatServeData> {
  const parsed = JSON.parse(await file.text()) as unknown;
  const candidate = parsed && typeof parsed === "object" && "data" in parsed ? (parsed as { data?: unknown }).data : parsed;
  if (!candidate || typeof candidate !== "object") throw new Error("This is not a valid SeatServe backup file.");
  const data = candidate as Partial<SeatServeData>;
  if (!Array.isArray(data.events) || !Array.isArray(data.venues) || !Array.isArray(data.runners) || !Array.isArray(data.menuItems) || !Array.isArray(data.orders) || !Array.isArray(data.activity)) throw new Error("This is not a valid SeatServe backup file.");
  return data as SeatServeData;
}
