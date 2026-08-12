import {
  AlertCircle, Banknote, CheckCircle2, CloudDownload, CloudUpload, Copy, CreditCard, Database, Download,
  ExternalLink, KeyRound, Link2, Plus, RefreshCw, Save, ShieldCheck, Trash2, Unplug, Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSeatServe } from "../../state/SeatServeContext";
import {
  createLocalBackup, createWorkspace, deleteWorkspace, disconnectSync, downloadJsonBackup,
  duplicateWorkspace, getActiveWorkspace, getSyncConfig, getSyncMeta, isDeploymentManagedSync, listLocalBackups,
  listWorkspaces, pullFromGoogleSheets, pushToGoogleSheets, readJsonBackup, restoreLocalBackup,
  saveSyncConfig, saveWorkspace, switchWorkspace, testGoogleSheetsConnection,
  type AutoSyncInterval, type SyncConfig, type SyncMeta, type WorkspaceEnvironment, type WorkspaceProfile,
} from "../../services/persistence";
import { grantStaffSession, hashPin, revokeStaffSession, type StaffRole } from "../../services/staffAuth";
import "./SettingsPage.css";

export default function SettingsPage() {
  const { data, replaceData, updateCustomerExperience, updateStaffAccess, repairWorkspaceData } = useSeatServe();
  const [experience, setExperience] = useState(() => data.customerExperience);
  const [workspaces, setWorkspaces] = useState<WorkspaceProfile[]>(() => listWorkspaces());
  const [active, setActive] = useState<WorkspaceProfile>(() => getActiveWorkspace());
  const [config, setConfig] = useState<SyncConfig>(() => getSyncConfig());
  const [meta, setMeta] = useState<SyncMeta>(() => getSyncMeta());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showConnectionForm, setShowConnectionForm] = useState(() => !getSyncConfig().connected);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("SeatServe Dev");
  const [newEnvironment, setNewEnvironment] = useState<WorkspaceEnvironment>("development");
  const inputRef = useRef<HTMLInputElement>(null);
  const [staffPins, setStaffPins] = useState({ admin: "", kitchen: "", runner: "" });

  const refreshWorkspaceState = () => {
    setWorkspaces(listWorkspaces()); setActive(getActiveWorkspace()); setConfig(getSyncConfig()); setMeta(getSyncMeta());
  };

  useEffect(() => { setExperience(data.customerExperience); }, [data.customerExperience]);

  useEffect(() => {
    const metaHandler = (event: Event) => setMeta((event as CustomEvent<SyncMeta>).detail ?? getSyncMeta());
    const configHandler = () => refreshWorkspaceState();
    window.addEventListener("seatserve:sync-meta", metaHandler);
    window.addEventListener("seatserve:sync-config", configHandler);
    window.addEventListener("seatserve:workspaces", configHandler);
    return () => {
      window.removeEventListener("seatserve:sync-meta", metaHandler);
      window.removeEventListener("seatserve:sync-config", configHandler);
      window.removeEventListener("seatserve:workspaces", configHandler);
    };
  }, []);

  const backups = useMemo(() => listLocalBackups(), [message, meta.lastSuccessfulSyncAt, active.id]);
  const connected = config.connected && Boolean(config.endpointUrl.trim());
  const deploymentManaged = isDeploymentManagedSync();
  const dataHealth = useMemo(() => {
    const menuIds = new Set(data.menus.map((menu) => menu.id));
    const itemIds = new Set(data.menuItems.map((item) => item.id));
    const activeOrderIds = new Set(data.orders.filter((order) => order.status !== "delivered" && order.status !== "cancelled").map((order) => order.id));
    const invalidEventMenus = data.events.filter((event) => event.menuId && !menuIds.has(event.menuId)).length;
    const invalidMenuItems = data.menus.reduce((sum, menu) => sum + menu.itemIds.filter((id) => !itemIds.has(id)).length + (menu.hiddenItemIds ?? []).filter((id) => !itemIds.has(id)).length, 0);
    const staleRunnerAssignments = data.runners.filter((runner) => runner.activeOrderId && !activeOrderIds.has(runner.activeOrderId)).length;
    return { invalidEventMenus, invalidMenuItems, staleRunnerAssignments, total: invalidEventMenus + invalidMenuItems + staleRunnerAssignments };
  }, [data.events, data.menus, data.menuItems, data.orders, data.runners]);

  const activate = (id: string) => {
    if (id === active.id) return;
    if (meta.pendingChanges && !window.confirm("This workspace has unsynced changes. Switch anyway? Local changes will remain saved on this device.")) return;
    switchWorkspace(id);
    window.location.reload();
  };

  const addWorkspace = () => {
    const profile = createWorkspace({ name: newName, environment: newEnvironment });
    setShowCreate(false); setNewName("SeatServe Dev"); setMessage(`${profile.name} created. Switch to it when you are ready.`); refreshWorkspaceState();
  };

  const copyWorkspace = (profile: WorkspaceProfile) => {
    const name = window.prompt("Name for the duplicated workspace", `${profile.name} Dev`);
    if (!name) return;
    const copy = duplicateWorkspace(profile.id, name); setMessage(`${copy.name} created with a copy of the current configuration.`); refreshWorkspaceState();
  };

  const removeWorkspace = (profile: WorkspaceProfile) => {
    if (!window.confirm(`Delete ${profile.name} from this device? This does not delete its Google Sheet.`)) return;
    try { deleteWorkspace(profile.id); if (profile.id === active.id) window.location.reload(); else refreshWorkspaceState(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Workspace could not be deleted."); }
  };

  const updateActiveIdentity = (patch: Partial<WorkspaceProfile>) => {
    const saved = saveWorkspace({ ...active, ...patch }); setActive(saved); setConfig(getSyncConfig());
  };

  const connect = async () => {
    setBusy(true); setMessage("");
    try {
      const cleaned = { ...config, endpointUrl: config.endpointUrl.trim(), workspaceName: active.name, connected: false };
      await testGoogleSheetsConnection(cleaned.endpointUrl, active.name);
      saveSyncConfig({ ...cleaned, connected: true }); refreshWorkspaceState(); setShowConnectionForm(false);
      setMessage("Google Sheets connected. This connection is saved only for the active workspace.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Connection failed."); }
    finally { setBusy(false); }
  };

  const savePreferences = () => { saveSyncConfig({ ...config, workspaceName: active.name }); setMessage("Workspace synchronization preferences saved."); };
  const runPush = async (force = false) => { setBusy(true); setMessage(""); try { const result = await pushToGoogleSheets(data, force); setMessage(result.conflict ? "Google Sheets contains newer data. Load it first or use Force upload." : "SeatServe data saved to Google Sheets."); } catch (error) { setMessage(error instanceof Error ? error.message : "Sync failed."); } finally { setBusy(false); } };
  const runPull = async () => { if (meta.pendingChanges && !window.confirm("You have unsynced local changes. A backup will be created before loading Google Sheets. Continue?")) return; setBusy(true); setMessage(""); try { const result = await pullFromGoogleSheets(data); if (result.data) replaceData(result.data, "Loaded configuration from Google Sheets"); setMessage("Google Sheets data loaded. A local safety backup was created first."); } catch (error) { setMessage(error instanceof Error ? error.message : "Load failed."); } finally { setBusy(false); } };
  const importBackup = async (file?: File) => { if (!file) return; try { createLocalBackup(data, "before-json-import"); replaceData(await readJsonBackup(file), "Restored configuration from JSON backup"); setMessage("JSON backup restored."); } catch (error) { setMessage(error instanceof Error ? error.message : "Backup restore failed."); } finally { if (inputRef.current) inputRef.current.value = ""; } };
  const disconnect = () => { if (deploymentManaged) { setMessage("Production Google Sheets is managed by Netlify for this deployment."); return; } if (!window.confirm("Disconnect Google Sheets for this workspace? Local data will remain available.")) return; try { disconnectSync(); refreshWorkspaceState(); setShowConnectionForm(true); setMessage("Google Sheets disconnected from this workspace."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to disconnect."); } };

  const saveStaffPins = async () => {
    setBusy(true); setMessage("");
    try {
      const invalid = Object.values(staffPins).find((pin) => pin.trim() && !/^\d{4,8}$/.test(pin.trim()));
      if (invalid) { setMessage("Staff PINs must be 4 to 8 digits."); return; }
      const next = { ...data.staffAccess };
      if (staffPins.admin.trim()) next.adminPinHash = await hashPin(staffPins.admin);
      if (staffPins.kitchen.trim()) next.kitchenPinHash = await hashPin(staffPins.kitchen);
      if (staffPins.runner.trim()) next.runnerPinHash = await hashPin(staffPins.runner);
      updateStaffAccess(next);
      if (staffPins.admin.trim()) grantStaffSession("admin");
      setStaffPins({ admin: "", kitchen: "", runner: "" });
      setMessage("Staff access PINs saved for this workspace. Existing authorized tabs remain active until closed or signed out.");
    } finally { setBusy(false); }
  };

  const removeStaffPin = (role: StaffRole) => {
    if (!window.confirm(`Remove ${role} PIN protection for this workspace?`)) return;
    const next = { ...data.staffAccess };
    delete next[`${role}PinHash` as keyof typeof next];
    updateStaffAccess(next); revokeStaffSession(role); setMessage(`${role === "admin" ? "Administration" : role === "kitchen" ? "Kitchen" : "Runner"} PIN protection removed.`);
  };

  return (
    <section className="settings-page">
      <header className="settings-page__heading"><div><p>Workspaces</p><h1>{active.name}</h1><span>Keep production, development, and demo data completely separated.</span></div><SyncStatus meta={meta} connected={connected} /></header>

      <article className="settings-card settings-card--wide workspace-manager">
        <div className="settings-card__title"><Database size={22}/><div><h2>Workspace library</h2><p>Switching workspaces reloads SeatServe with that workspace’s own local data and Google Sheets connection.</p></div><button onClick={() => setShowCreate((value) => !value)}><Plus size={17}/> New workspace</button></div>
        {showCreate && <div className="workspace-create"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Workspace name"/><select value={newEnvironment} onChange={(event) => setNewEnvironment(event.target.value as WorkspaceEnvironment)}><option value="production">Production</option><option value="development">Development</option><option value="demo">Demo</option></select><button onClick={addWorkspace} disabled={!newName.trim()}>Create</button></div>}
        <div className="workspace-list">
          {workspaces.map((workspace) => <div key={workspace.id} className={`workspace-row${workspace.id === active.id ? " is-active" : ""}`}>
            <button className="workspace-row__main" onClick={() => activate(workspace.id)}><span className={`environment-badge environment-badge--${workspace.environment}`}>{workspace.environment === "development" ? "DEV" : workspace.environment === "production" ? "PROD" : "DEMO"}</span><span><strong>{workspace.name}</strong><small>{workspace.connected ? "Google Sheets connected" : "Local data only"}</small></span>{workspace.id === active.id && <CheckCircle2 size={18}/>}</button>
            <div className="workspace-row__actions"><button title="Duplicate workspace" onClick={() => copyWorkspace(workspace)}><Copy size={16}/></button><button title="Delete workspace" onClick={() => removeWorkspace(workspace)}><Trash2 size={16}/></button></div>
          </div>)}
        </div>
      </article>

      <div className="settings-grid">
        <article className="settings-card settings-card--wide workspace-card">
          <div className="settings-card__title"><Link2 size={22}/><div><h2>Active workspace</h2><p>{deploymentManaged ? "Production cloud connection is supplied automatically by the Netlify deployment." : "Rename it, label its purpose, and connect its own Google Sheet."}</p></div></div>{deploymentManaged && <div className="settings-message settings-message--success"><CheckCircle2 size={18}/> Cloud workspace connected automatically. New devices do not need the Apps Script URL.</div>}
          <div className="workspace-identity-grid">
            <label className="settings-field"><span>Workspace name</span><input value={active.name} onChange={(event) => updateActiveIdentity({ name: event.target.value })}/></label>
            <label className="settings-field"><span>Environment</span><select value={active.environment} onChange={(event) => updateActiveIdentity({ environment: event.target.value as WorkspaceEnvironment })}><option value="production">Production</option><option value="development">Development</option><option value="demo">Demo</option></select></label>
          </div>

          {connected && !showConnectionForm ? <div className="connection-summary"><div className="connection-summary__identity"><div className="connection-badge"><CheckCircle2 size={21}/> Connected</div><h3>{active.name}</h3><p>{meta.lastSuccessfulSyncAt ? `Last successful sync ${new Date(meta.lastSuccessfulSyncAt).toLocaleString()}` : deploymentManaged ? "Netlify cloud bootstrap is active and ready to synchronize." : "Connected and ready for the first synchronization."}</p></div><div className="connection-summary__actions">{deploymentManaged ? <span className="connection-badge"><ShieldCheck size={17}/> Managed by Netlify</span> : <><button className="secondary" onClick={() => setShowConnectionForm(true)}><Link2 size={17}/> Connection details</button><button className="danger-ghost" onClick={disconnect}><Unplug size={17}/> Disconnect</button></>}</div></div> : deploymentManaged ? <div className="connection-summary"><div className="connection-summary__identity"><div className="connection-badge"><CheckCircle2 size={21}/> Connected</div><h3>{active.name}</h3><p>Production endpoint supplied by the Netlify deployment.</p></div></div> : <div className="connection-form"><label className="settings-field"><span>Apps Script web app URL</span><input value={config.endpointUrl} onChange={(event) => setConfig({ ...config, endpointUrl: event.target.value, connected: false })} placeholder="https://script.google.com/macros/s/.../exec"/></label><div className="settings-actions"><button disabled={busy || !config.endpointUrl.trim()} onClick={connect}><Link2 size={17}/> {busy ? "Testing…" : "Connect workspace"}</button>{connected && <button className="secondary" onClick={() => setShowConnectionForm(false)}>Cancel</button>}</div></div>}

          {connected && <div className="sync-preferences">{deploymentManaged ? <div className="settings-toggle"><CheckCircle2 size={18}/><span><strong>Automatic synchronization enabled</strong><small>Production changes sync immediately; other devices check for updates automatically.</small></span></div> : <><label className="settings-toggle"><input type="checkbox" checked={config.autoSync} onChange={(event) => setConfig({ ...config, autoSync: event.target.checked })}/><span><strong>Automatic synchronization</strong><small>Sync only this workspace when its data changes.</small></span></label><label className="settings-field settings-field--compact"><span>Sync delay</span><select value={config.autoSyncIntervalSeconds} disabled={!config.autoSync} onChange={(event) => setConfig({ ...config, autoSyncIntervalSeconds: Number(event.target.value) as AutoSyncInterval })}><option value={0}>Immediately</option><option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={300}>5 minutes</option></select></label></>}<div className="settings-actions">{!deploymentManaged && <button onClick={savePreferences}><Save size={17}/> Save preferences</button>}<button className="secondary" disabled={busy} onClick={() => runPush(false)}><CloudUpload size={17}/> Sync now</button><button className="secondary" disabled={busy} onClick={runPull}><CloudDownload size={17}/> Load from Sheets</button></div></div>}
          {meta.state === "conflict" && <div className="settings-conflict"><AlertCircle size={18}/><span>Google Sheets contains changes newer than this browser copy.</span><button disabled={busy} onClick={() => runPush(true)}>Force upload local data</button></div>}
        </article>

        <article className="settings-card"><div className="settings-card__title"><Download size={22}/><div><h2>Portable backup</h2><p>Export or restore the active workspace only.</p></div></div><div className="settings-stack"><button onClick={() => downloadJsonBackup(data)}><Download size={17}/> Export JSON backup</button><button className="secondary" onClick={() => inputRef.current?.click()}><Upload size={17}/> Restore JSON backup</button><input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={(event) => importBackup(event.target.files?.[0])}/></div></article>
        <article className="settings-card"><div className="settings-card__title"><RefreshCw size={22}/><div><h2>Local safety backups</h2><p>Backups are isolated by workspace.</p></div></div><div className="backup-list">{backups.length === 0 && <p className="muted">No automatic backups yet.</p>}{backups.slice(0,5).map((backup) => <div key={backup.key}><span><strong>{backup.label}</strong><small>{backup.createdAt ? new Date(backup.createdAt).toLocaleString() : "Unknown date"}</small></span><button className="text-button" onClick={() => { createLocalBackup(data,"before-local-restore"); replaceData(restoreLocalBackup(backup.key),"Restored local safety backup"); setMessage("Local backup restored."); }}>Restore</button></div>)}</div></article>
      </div>

      <article className="settings-card settings-card--wide checkout-payments-settings">
        <div className="settings-card__title"><Banknote size={22}/><div><h2>Checkout &amp; Payments</h2><p>Configure delivery fee, tax, and the totals customers see for exact cash or credit card payment at delivery.</p></div></div>
        <div className="checkout-settings-grid">
          <label className="settings-field"><span>Delivery fee ($)</span><input type="number" min="0" step="0.01" inputMode="decimal" value={experience.deliveryFee} onChange={(event) => setExperience({ ...experience, deliveryFee: Math.max(0, Number(event.target.value) || 0) })}/><small>Added to every customer order in this workspace.</small></label>
          <label className="settings-field"><span>Tax rate (%)</span><input type="number" min="0" step="0.01" inputMode="decimal" value={experience.taxRatePercent} onChange={(event) => setExperience({ ...experience, taxRatePercent: Math.max(0, Number(event.target.value) || 0) })}/></label>
          <label className="settings-field"><span>Estimated card fee (%)</span><input type="number" min="0" step="0.01" inputMode="decimal" value={experience.estimatedCardFeePercent} onChange={(event) => setExperience({ ...experience, estimatedCardFeePercent: Math.max(0, Number(event.target.value) || 0) })}/></label>
          <label className="settings-field"><span>Estimated fixed card fee ($)</span><input type="number" min="0" step="0.01" inputMode="decimal" value={experience.estimatedCardFeeFixed} onChange={(event) => setExperience({ ...experience, estimatedCardFeeFixed: Math.max(0, Number(event.target.value) || 0) })}/></label>
          <label className="settings-field"><span>Pickup location name</span><input value={experience.pickupLocationName} onChange={(event) => setExperience({ ...experience, pickupLocationName: event.target.value })} placeholder="Home Concession Stand"/><small>Shown to customers choosing Window Pickup.</small></label>
          <label className="settings-field"><span>Pickup instructions</span><textarea rows={3} value={experience.pickupInstructions} onChange={(event) => setExperience({ ...experience, pickupInstructions: event.target.value })} placeholder="North window by the main entrance"/></label>
        </div>
        <div className="checkout-payment-options">
          <label className="settings-toggle"><input type="checkbox" checked={experience.cashPaymentsEnabled} onChange={(event) => setExperience({ ...experience, cashPaymentsEnabled: event.target.checked })}/><span><strong>Exact cash at delivery</strong><small>Customer agrees to have the exact cash total ready when the runner arrives.</small></span></label>
          <label className="settings-toggle"><input type="checkbox" checked={experience.cardPaymentsEnabled} onChange={(event) => setExperience({ ...experience, cardPaymentsEnabled: event.target.checked })}/><span><strong>Credit card at delivery</strong><small>Runner collects card payment at delivery using the selected processor.</small></span></label>
          <label className="settings-toggle"><input type="checkbox" checked={experience.pickupEnabled} onChange={(event) => setExperience({ ...experience, pickupEnabled: event.target.checked })}/><span><strong>Window Pickup</strong><small>Customers can choose pickup instead of delivery. Delivery fee is removed automatically.</small></span></label>
        </div>
        <div className="checkout-payment-preview">
          <div><Banknote size={18}/><span><strong>Exact cash total</strong><small>Subtotal + delivery fee + tax</small></span></div>
          <div><CreditCard size={18}/><span><strong>Credit card total</strong><small>Cash total + estimated card fee</small></span></div>
        </div>
        <div className="settings-actions"><button onClick={() => { updateCustomerExperience(experience); setMessage("Checkout & payment settings saved for this workspace."); }}><Save size={17}/> Save checkout settings</button></div>
      </article>


      <article className="settings-card settings-card--wide staff-access-settings">
        <div className="settings-card__title"><ShieldCheck size={22}/><div><h2>Staff Access</h2><p>Protect the permanent staff QR and direct staff routes with workspace-specific PINs. PINs are stored as hashes, not readable PIN text.</p></div></div>
        <div className="staff-pin-grid">
          {([
            ["admin", "Administration PIN", data.staffAccess?.adminPinHash],
            ["kitchen", "Kitchen PIN", data.staffAccess?.kitchenPinHash],
            ["runner", "Runner PIN", data.staffAccess?.runnerPinHash],
          ] as const).map(([role,label,hash]) => <div className="staff-pin-card" key={role}><div className="staff-pin-card__status"><KeyRound size={18}/><span><strong>{label}</strong><small>{hash ? "Protection enabled" : "Not protected yet"}</small></span><i className={hash ? "is-on" : ""}/></div><label className="settings-field"><span>{hash ? "Set a new PIN" : "Create PIN"}</span><input type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} placeholder={hash ? "Leave blank to keep current PIN" : "Enter 4–8 digit PIN"} value={staffPins[role]} onChange={(event)=>setStaffPins({...staffPins,[role]:event.target.value})}/><small>Use a PIN staff can enter quickly, but do not print it on the QR sign.</small></label>{hash && <button className="text-button staff-pin-remove" type="button" onClick={()=>removeStaffPin(role)}>Remove PIN protection</button>}</div>)}
        </div>
        <div className="settings-actions"><button disabled={busy || !Object.values(staffPins).some((pin)=>pin.trim())} onClick={()=>void saveStaffPins()}><Save size={17}/> Save staff PINs</button></div>
      </article>

      <article className="settings-card settings-card--wide customer-experience-settings">
        <div className="settings-card__title"><ExternalLink size={22}/><div><h2>Customer experience</h2><p>Edit the delivered thank-you screen, quick rating, SeatBeacon colors, and community-support links for this workspace.</p></div></div>
        <div className="experience-grid">
          <label className="settings-field"><span>Thank-you headline</span><input value={experience.headline} onChange={(event) => setExperience({ ...experience, headline: event.target.value })}/></label>
          <label className="settings-field"><span>School message</span><input value={experience.schoolMessage} onChange={(event) => setExperience({ ...experience, schoolMessage: event.target.value })}/></label>
          <label className="settings-field settings-field--wide"><span>Supporting message</span><textarea rows={2} value={experience.message} onChange={(event) => setExperience({ ...experience, message: event.target.value })}/></label>
          <label className="settings-field"><span>Rating prompt</span><input value={experience.ratingPrompt} onChange={(event) => setExperience({ ...experience, ratingPrompt: event.target.value })}/></label>
          <label className="settings-field"><span>Comments prompt</span><input value={experience.commentsPrompt} onChange={(event) => setExperience({ ...experience, commentsPrompt: event.target.value })}/></label>
          <label className="settings-field"><span>Support section title</span><input value={experience.supportTitle} onChange={(event) => setExperience({ ...experience, supportTitle: event.target.value })}/></label>
          <label className="settings-field"><span>Finish button</span><input value={experience.finishLabel} onChange={(event) => setExperience({ ...experience, finishLabel: event.target.value })}/></label>
          <label className="settings-field"><span>SeatBeacon mascot symbol</span><input value={experience.mascotSymbol} onChange={(event) => setExperience({ ...experience, mascotSymbol: event.target.value })}/></label>
          <label className="settings-field"><span>SeatBeacon navy</span><input type="color" value={experience.primaryColor} onChange={(event) => setExperience({ ...experience, primaryColor: event.target.value })}/></label>
          <label className="settings-field"><span>SeatBeacon silver</span><input type="color" value={experience.secondaryColor} onChange={(event) => setExperience({ ...experience, secondaryColor: event.target.value })}/></label>
        </div>
        <div className="experience-toggles">
          <label className="settings-toggle"><input type="checkbox" checked={experience.showRating} onChange={(event) => setExperience({ ...experience, showRating: event.target.checked })}/><span><strong>Show quick rating</strong><small>Customers can tap one to five stars after delivery.</small></span></label>
          <label className="settings-toggle"><input type="checkbox" checked={experience.showComments} onChange={(event) => setExperience({ ...experience, showComments: event.target.checked })}/><span><strong>Show optional comments</strong><small>Keep feedback on the same thank-you screen.</small></span></label>
        </div>
        <div className="support-link-editor">
          {experience.supportLinks.map((link, index) => <div className="support-link-row" key={link.id}>
            <label><input type="checkbox" checked={link.enabled} onChange={(event) => setExperience({ ...experience, supportLinks: experience.supportLinks.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item) })}/></label>
            <input aria-label="Icon" value={link.icon} onChange={(event) => setExperience({ ...experience, supportLinks: experience.supportLinks.map((item, itemIndex) => itemIndex === index ? { ...item, icon: event.target.value } : item) })}/>
            <input aria-label="Button label" value={link.label} onChange={(event) => setExperience({ ...experience, supportLinks: experience.supportLinks.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })}/>
            <input aria-label="Button URL" value={link.url} onChange={(event) => setExperience({ ...experience, supportLinks: experience.supportLinks.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item) })}/>
          </div>)}
        </div>
        <div className="settings-actions"><button onClick={() => { updateCustomerExperience(experience); setMessage("Customer experience settings saved for this workspace."); }}><Save size={17}/> Save customer experience</button></div>
      </article>


      <article className="settings-card settings-card--wide workspace-health-card">
        <div className="settings-card__title"><Database size={22}/><div><h2>Workspace data health</h2><p>Checks event-menu links, menu-item references, and runner assignments in the active workspace.</p></div></div>
        <div className="workspace-health-grid">
          <div><span>Event menu links</span><strong>{dataHealth.invalidEventMenus}</strong><small>Missing menu references</small></div>
          <div><span>Menu item links</span><strong>{dataHealth.invalidMenuItems}</strong><small>Missing item references</small></div>
          <div><span>Runner assignments</span><strong>{dataHealth.staleRunnerAssignments}</strong><small>Stale active-order links</small></div>
        </div>
        <div className="settings-actions"><button disabled={dataHealth.total === 0} onClick={() => { repairWorkspaceData(); setMessage(dataHealth.total === 0 ? "Workspace links are healthy." : "Workspace links repaired. A safety backup was created first."); }}><RefreshCw size={17}/> {dataHealth.total === 0 ? "Workspace links are healthy" : `Repair ${dataHealth.total} issue${dataHealth.total === 1 ? "" : "s"}`}</button></div>
      </article>

      {message && <div className="settings-message">{message}</div>}
      <article className="settings-help"><div><h2>Google Sheet setup</h2><p>Each workspace may use its own Apps Script endpoint. A Dev workspace can remain local or connect to a separate test sheet.</p></div><a href="https://script.google.com" target="_blank" rel="noreferrer">Open Apps Script <ExternalLink size={16}/></a></article>
    </section>
  );
}

function SyncStatus({ meta, connected }: { meta: SyncMeta; connected: boolean }) {
  const label = !connected ? "Local only" : meta.state === "saving" ? "Saving…" : meta.state === "error" ? "Sync failed" : meta.state === "conflict" ? "Conflict" : meta.pendingChanges ? "Unsynced changes" : meta.lastSuccessfulSyncAt ? "Saved" : "Connected";
  return <div className={`sync-status sync-status--${meta.state}${meta.pendingChanges ? " is-pending" : ""}`}>{meta.state === "error" || meta.state === "conflict" ? <AlertCircle size={17}/> : <CheckCircle2 size={17}/>}<span><strong>{label}</strong>{meta.lastSuccessfulSyncAt && <small>Last sync {new Date(meta.lastSuccessfulSyncAt).toLocaleString()}</small>}</span></div>;
}
