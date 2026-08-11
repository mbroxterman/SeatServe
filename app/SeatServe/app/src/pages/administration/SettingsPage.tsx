import {
  AlertCircle, CheckCircle2, CloudDownload, CloudUpload, Copy, Database, Download,
  ExternalLink, Link2, Plus, RefreshCw, Save, Trash2, Unplug, Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSeatServe } from "../../state/SeatServeContext";
import {
  createLocalBackup, createWorkspace, deleteWorkspace, disconnectSync, downloadJsonBackup,
  duplicateWorkspace, getActiveWorkspace, getSyncConfig, getSyncMeta, listLocalBackups,
  listWorkspaces, pullFromGoogleSheets, pushToGoogleSheets, readJsonBackup, restoreLocalBackup,
  saveSyncConfig, saveWorkspace, switchWorkspace, testGoogleSheetsConnection,
  type AutoSyncInterval, type SyncConfig, type SyncMeta, type WorkspaceEnvironment, type WorkspaceProfile,
} from "../../services/persistence";
import "./SettingsPage.css";

export default function SettingsPage() {
  const { data, replaceData, updateCustomerExperience } = useSeatServe();
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
  const disconnect = () => { if (!window.confirm("Disconnect Google Sheets for this workspace? Local data will remain available.")) return; disconnectSync(); refreshWorkspaceState(); setShowConnectionForm(true); setMessage("Google Sheets disconnected from this workspace."); };

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
          <div className="settings-card__title"><Link2 size={22}/><div><h2>Active workspace</h2><p>Rename it, label its purpose, and connect its own Google Sheet.</p></div></div>
          <div className="workspace-identity-grid">
            <label className="settings-field"><span>Workspace name</span><input value={active.name} onChange={(event) => updateActiveIdentity({ name: event.target.value })}/></label>
            <label className="settings-field"><span>Environment</span><select value={active.environment} onChange={(event) => updateActiveIdentity({ environment: event.target.value as WorkspaceEnvironment })}><option value="production">Production</option><option value="development">Development</option><option value="demo">Demo</option></select></label>
          </div>

          {connected && !showConnectionForm ? <div className="connection-summary"><div className="connection-summary__identity"><div className="connection-badge"><CheckCircle2 size={21}/> Connected</div><h3>{active.name}</h3><p>{meta.lastSuccessfulSyncAt ? `Last successful sync ${new Date(meta.lastSuccessfulSyncAt).toLocaleString()}` : "Connected and ready for the first synchronization."}</p></div><div className="connection-summary__actions"><button className="secondary" onClick={() => setShowConnectionForm(true)}><Link2 size={17}/> Connection details</button><button className="danger-ghost" onClick={disconnect}><Unplug size={17}/> Disconnect</button></div></div> : <div className="connection-form"><label className="settings-field"><span>Apps Script web app URL</span><input value={config.endpointUrl} onChange={(event) => setConfig({ ...config, endpointUrl: event.target.value, connected: false })} placeholder="https://script.google.com/macros/s/.../exec"/></label><div className="settings-actions"><button disabled={busy || !config.endpointUrl.trim()} onClick={connect}><Link2 size={17}/> {busy ? "Testing…" : "Connect workspace"}</button>{connected && <button className="secondary" onClick={() => setShowConnectionForm(false)}>Cancel</button>}</div></div>}

          {connected && <div className="sync-preferences"><label className="settings-toggle"><input type="checkbox" checked={config.autoSync} onChange={(event) => setConfig({ ...config, autoSync: event.target.checked })}/><span><strong>Automatic synchronization</strong><small>Sync only this workspace when its data changes.</small></span></label><label className="settings-field settings-field--compact"><span>Sync delay</span><select value={config.autoSyncIntervalSeconds} disabled={!config.autoSync} onChange={(event) => setConfig({ ...config, autoSyncIntervalSeconds: Number(event.target.value) as AutoSyncInterval })}><option value={0}>Immediately</option><option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={300}>5 minutes</option></select></label><div className="settings-actions"><button onClick={savePreferences}><Save size={17}/> Save preferences</button><button className="secondary" disabled={busy} onClick={() => runPush(false)}><CloudUpload size={17}/> Sync now</button><button className="secondary" disabled={busy} onClick={runPull}><CloudDownload size={17}/> Load from Sheets</button></div></div>}
          {meta.state === "conflict" && <div className="settings-conflict"><AlertCircle size={18}/><span>Google Sheets contains changes newer than this browser copy.</span><button disabled={busy} onClick={() => runPush(true)}>Force upload local data</button></div>}
        </article>

        <article className="settings-card"><div className="settings-card__title"><Download size={22}/><div><h2>Portable backup</h2><p>Export or restore the active workspace only.</p></div></div><div className="settings-stack"><button onClick={() => downloadJsonBackup(data)}><Download size={17}/> Export JSON backup</button><button className="secondary" onClick={() => inputRef.current?.click()}><Upload size={17}/> Restore JSON backup</button><input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={(event) => importBackup(event.target.files?.[0])}/></div></article>
        <article className="settings-card"><div className="settings-card__title"><RefreshCw size={22}/><div><h2>Local safety backups</h2><p>Backups are isolated by workspace.</p></div></div><div className="backup-list">{backups.length === 0 && <p className="muted">No automatic backups yet.</p>}{backups.slice(0,5).map((backup) => <div key={backup.key}><span><strong>{backup.label}</strong><small>{backup.createdAt ? new Date(backup.createdAt).toLocaleString() : "Unknown date"}</small></span><button className="text-button" onClick={() => { createLocalBackup(data,"before-local-restore"); replaceData(restoreLocalBackup(backup.key),"Restored local safety backup"); setMessage("Local backup restored."); }}>Restore</button></div>)}</div></article>
      </div>

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
          <label className="settings-field"><span>Delivery fee</span><div className="settings-money-field"><span>$</span><input type="number" min="0" step="0.25" inputMode="decimal" value={experience.deliveryFee} onChange={(event) => setExperience({ ...experience, deliveryFee: Math.max(0, Number(event.target.value) || 0) })}/></div><small>Added to every customer order in this workspace.</small></label>
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

      {message && <div className="settings-message">{message}</div>}
      <article className="settings-help"><div><h2>Google Sheet setup</h2><p>Each workspace may use its own Apps Script endpoint. A Dev workspace can remain local or connect to a separate test sheet.</p></div><a href="https://script.google.com" target="_blank" rel="noreferrer">Open Apps Script <ExternalLink size={16}/></a></article>
    </section>
  );
}

function SyncStatus({ meta, connected }: { meta: SyncMeta; connected: boolean }) {
  const label = !connected ? "Local only" : meta.state === "saving" ? "Saving…" : meta.state === "error" ? "Sync failed" : meta.state === "conflict" ? "Conflict" : meta.pendingChanges ? "Unsynced changes" : meta.lastSuccessfulSyncAt ? "Saved" : "Connected";
  return <div className={`sync-status sync-status--${meta.state}${meta.pendingChanges ? " is-pending" : ""}`}>{meta.state === "error" || meta.state === "conflict" ? <AlertCircle size={17}/> : <CheckCircle2 size={17}/>}<span><strong>{label}</strong>{meta.lastSuccessfulSyncAt && <small>Last sync {new Date(meta.lastSuccessfulSyncAt).toLocaleString()}</small>}</span></div>;
}
