import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Banknote, Cloud, CloudDownload, CloudUpload, CreditCard, DatabaseBackup, FileJson, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { useSeatServe } from "../../state/SeatServeContext";
import type { SeatServeData } from "../../types/domain";
import {
  downloadSeatServeBackup,
  getGoogleSheetsConfig,
  getGoogleSheetsStatus,
  pullDataFromGoogleSheets,
  pushDataToGoogleSheets,
  saveGoogleSheetsConfig,
  type GoogleSheetsConfig,
  type GoogleSheetsStatus,
} from "../../services/googleSheetsSync";
import "./Settings.css";

export default function Settings() {
  const { data, replaceData, updateCustomerExperience } = useSeatServe();
  const [config, setConfig] = useState<GoogleSheetsConfig>(getGoogleSheetsConfig);
  const [status, setStatus] = useState<GoogleSheetsStatus>(getGoogleSheetsStatus);
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [checkoutSettings, setCheckoutSettings] = useState(data.customerExperience);

  useEffect(() => { setCheckoutSettings(data.customerExperience); }, [data.customerExperience]);

  useEffect(() => {
    const refresh = () => setStatus(getGoogleSheetsStatus());
    window.addEventListener("seatserve-google-status-changed", refresh);
    return () => window.removeEventListener("seatserve-google-status-changed", refresh);
  }, []);

  const saveConnection = () => {
    saveGoogleSheetsConfig(config);
    setStatus({ state: config.webAppUrl ? "idle" : "not-configured", message: config.webAppUrl ? "Connection settings saved. Use Sync now to test." : "Google Sheets is not configured." });
  };

  const push = async () => { setBusy(true); try { await pushDataToGoogleSheets(data, config); } finally { setBusy(false); } };
  const pull = async () => {
    if (!window.confirm("Replace the data currently in SeatServe with the data stored in Google Sheets?")) return;
    setBusy(true);
    try { replaceData(await pullDataFromGoogleSheets(config)); } finally { setBusy(false); }
  };

  const saveCheckoutSettings = () => {
    updateCustomerExperience({
      ...checkoutSettings,
      deliveryFee: Math.max(0, Number(checkoutSettings.deliveryFee) || 0),
      taxRatePercent: Math.max(0, Number(checkoutSettings.taxRatePercent) || 0),
      estimatedCardFeePercent: Math.max(0, Number(checkoutSettings.estimatedCardFeePercent) || 0),
      estimatedCardFeeFixed: Math.max(0, Number(checkoutSettings.estimatedCardFeeFixed) || 0),
    });
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { data?: SeatServeData } | SeatServeData;
      const next = "data" in parsed && parsed.data ? parsed.data : parsed as SeatServeData;
      if (!Array.isArray(next.events) || !Array.isArray(next.venues) || !Array.isArray(next.menuItems)) throw new Error("Not a SeatServe backup file.");
      replaceData(next);
      setStatus({ state: "success", message: "Backup imported into SeatServe. Sync to Google Sheets when ready." });
    } catch (error) { setStatus({ state: "error", message: error instanceof Error ? error.message : "Unable to import backup." }); }
    event.target.value = "";
  };

  return (
    <section className="settings-page">
      <header className="settings-page__header"><div><p>Workspace</p><h1>Settings</h1><span>Keep SeatServe configuration backed up and synchronized.</span></div></header>
      <div className="settings-grid">
        <article className="settings-card settings-card--wide">
          <div className="settings-card__heading"><div className="settings-icon"><Banknote /></div><div><h2>Checkout &amp; payments</h2><p>Set the delivery fee and the totals customers see for exact cash or credit card payment at delivery.</p></div></div>
          <div className="settings-fields settings-fields--columns">
            <label>Delivery fee ($)<input type="number" min="0" step="0.01" value={checkoutSettings.deliveryFee} onChange={(e) => setCheckoutSettings({ ...checkoutSettings, deliveryFee: Number(e.target.value) })} /></label>
            <label>Tax rate (%)<input type="number" min="0" step="0.01" value={checkoutSettings.taxRatePercent} onChange={(e) => setCheckoutSettings({ ...checkoutSettings, taxRatePercent: Number(e.target.value) })} /></label>
            <label>Estimated card fee (%)<input type="number" min="0" step="0.01" value={checkoutSettings.estimatedCardFeePercent} onChange={(e) => setCheckoutSettings({ ...checkoutSettings, estimatedCardFeePercent: Number(e.target.value) })} /></label>
            <label>Estimated fixed card fee ($)<input type="number" min="0" step="0.01" value={checkoutSettings.estimatedCardFeeFixed} onChange={(e) => setCheckoutSettings({ ...checkoutSettings, estimatedCardFeeFixed: Number(e.target.value) })} /></label>
            <label className="settings-check"><input type="checkbox" checked={checkoutSettings.cashPaymentsEnabled} onChange={(e) => setCheckoutSettings({ ...checkoutSettings, cashPaymentsEnabled: e.target.checked })}/><span><strong>Exact cash at delivery</strong><small>Customer agrees to have the exact cash total ready for the runner.</small></span></label>
            <label className="settings-check"><input type="checkbox" checked={checkoutSettings.cardPaymentsEnabled} onChange={(e) => setCheckoutSettings({ ...checkoutSettings, cardPaymentsEnabled: e.target.checked })}/><span><strong>Credit card at delivery</strong><small>Runner collects card payment at delivery using the selected processor.</small></span></label>
          </div>
          <div className="payment-preview">
            <div><Banknote size={18}/><span>Cash total uses subtotal + delivery fee + tax.</span></div>
            <div><CreditCard size={18}/><span>Card total adds the configurable estimated card fee.</span></div>
          </div>
          <div className="settings-actions"><button className="is-primary" onClick={saveCheckoutSettings}><Save size={17}/>Save checkout settings</button></div>
        </article>
        <article className="settings-card settings-card--wide">
          <div className="settings-card__heading"><div className="settings-icon"><Cloud /></div><div><h2>Google Sheets data sync</h2><p>Save events, venues, zones, menus, runners, orders, and workspace activity to a Google Sheet.</p></div></div>
          <div className={`sync-status is-${status.state}`}><RefreshCw size={17} className={status.state === "syncing" ? "is-spinning" : ""}/><div><strong>{status.state === "success" ? "Synced" : status.state === "error" ? "Sync error" : status.state === "syncing" ? "Syncing" : "Connection status"}</strong><span>{status.message}</span>{status.lastSyncedAt && <small>Last sync: {new Date(status.lastSyncedAt).toLocaleString()}</small>}</div></div>
          <div className="settings-fields">
            <label>Apps Script web app URL<input value={config.webAppUrl} onChange={(e) => setConfig({ ...config, webAppUrl: e.target.value.trim() })} placeholder="https://script.google.com/macros/s/.../exec" /></label>
            <label>Sync token<input type="password" value={config.syncToken} onChange={(e) => setConfig({ ...config, syncToken: e.target.value })} placeholder="Your private SeatServe sync token" /></label>
            <label className="settings-check"><input type="checkbox" checked={config.autoSync} onChange={(e) => setConfig({ ...config, autoSync: e.target.checked })}/><span><strong>Automatic sync</strong><small>Save changes to Google Sheets after local edits.</small></span></label>
          </div>
          <div className="settings-actions"><button onClick={saveConnection}><Save size={17}/>Save connection</button><button className="is-primary" disabled={busy} onClick={push}><CloudUpload size={17}/>Sync now</button><button disabled={busy} onClick={pull}><CloudDownload size={17}/>Load from Sheets</button></div>
        </article>
        <article className="settings-card"><div className="settings-card__heading"><div className="settings-icon"><DatabaseBackup /></div><div><h2>Portable backup</h2><p>Keep an offline copy before major event or menu changes.</p></div></div><div className="settings-actions settings-actions--stack"><button onClick={() => downloadSeatServeBackup(data)}><FileJson size={17}/>Export JSON backup</button><button onClick={() => importRef.current?.click()}><CloudDownload size={17}/>Import JSON backup</button><input ref={importRef} type="file" accept="application/json" hidden onChange={importJson}/></div></article>
        <article className="settings-card"><div className="settings-card__heading"><div className="settings-icon"><ShieldCheck /></div><div><h2>What is protected</h2><p>Google Sheets stores the complete current SeatServe data snapshot in readable worksheet tabs.</p></div></div><ul><li>Events and ordering status</li><li>Venues and delivery zones</li><li>Menu items and pricing</li><li>Runner roster and status</li><li>Orders and delivery history</li></ul></article>
      </div>
    </section>
  );
}
