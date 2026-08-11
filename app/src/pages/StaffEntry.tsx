import { ChefHat, Gauge, LockKeyhole, Smartphone, UserRound } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { grantStaffSession, type StaffRole, verifyPin } from "../services/staffAuth";
import { useSeatServe } from "../state/SeatServeContext";
import "./StaffEntry.css";

type Choice = { role: StaffRole; label: string; description: string; icon: typeof ChefHat; path: string };
const choices: Choice[] = [
  { role: "kitchen", label: "Kitchen Operations", description: "Prepare orders and dispatch runners", icon: ChefHat, path: "/kitchen" },
  { role: "runner", label: "Runner Mobile", description: "Open runner delivery workflow", icon: Smartphone, path: "/runner" },
  { role: "admin", label: "Administration", description: "Setup, reporting, and workspace settings", icon: Gauge, path: "/admin" },
];

export default function StaffEntry() {
  const { data, activeEvent } = useSeatServe();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Choice>();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [runnerAuthorized, setRunnerAuthorized] = useState(false);

  const choose = async (choice: Choice) => {
    setSelected(choice); setPin(""); setError(""); setRunnerAuthorized(false);
    const hash = data.staffAccess?.[`${choice.role}PinHash` as "adminPinHash"];
    if (!hash) {
      grantStaffSession(choice.role);
      if (choice.role === "runner") setRunnerAuthorized(true); else navigate(choice.path);
    }
  };

  const submitPin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true); setError("");
    const hash = data.staffAccess?.[`${selected.role}PinHash` as "adminPinHash"];
    if (await verifyPin(pin, hash)) {
      grantStaffSession(selected.role);
      if (selected.role === "runner") setRunnerAuthorized(true); else navigate(selected.path);
    } else setError("Incorrect PIN. Please try again.");
    setBusy(false);
  };

  const runners = data.runners.filter((runner) => runner.active);
  return (
    <main className="staff-entry">
      <section className="staff-entry__card">
        <img src="/seatserve-web-logo.png" alt="SeatServe" className="staff-entry__logo" />
        <p className="staff-entry__eyebrow">Staff access</p>
        {!selected && <><h1>Choose your SeatServe workspace</h1><p className="staff-entry__intro">Staff QR access is protected by the PINs configured for this workspace.</p><div className="staff-entry__grid">{choices.map((choice) => { const Icon=choice.icon; return <button type="button" key={choice.role} onClick={()=>void choose(choice)}><Icon size={28}/><span><strong>{choice.label}</strong><small>{choice.description}</small></span></button>; })}</div></>}
        {selected && !runnerAuthorized && <><h1>{selected.label}</h1><p className="staff-entry__intro">Enter the {selected.label} PIN.</p><form className="staff-entry__pin" onSubmit={submitPin}><label><LockKeyhole size={18}/><input autoFocus type="password" inputMode="numeric" autoComplete="one-time-code" value={pin} onChange={(e)=>setPin(e.target.value)} placeholder="PIN"/></label>{error && <div className="staff-entry__error">{error}</div>}<button disabled={busy || !pin.trim()}>{busy ? "Checking…" : "Continue"}</button><button className="staff-entry__back" type="button" onClick={()=>setSelected(undefined)}>Back</button></form></>}
        {selected?.role === "runner" && runnerAuthorized && <><h1>Who are you?</h1><p className="staff-entry__intro">{activeEvent?.name ?? "No live event"} · Select your runner profile.</p><div className="staff-entry__runners">{runners.map((runner)=><button key={runner.id} onClick={()=>{grantStaffSession("runner", runner.id); navigate(`/runner/${runner.id}`);}}><UserRound size={22}/><span><strong>{runner.name}</strong><small>{runner.role === "lead" ? "Runner lead" : "Runner"}</small></span></button>)}</div><button className="staff-entry__back standalone" type="button" onClick={()=>{setSelected(undefined);setRunnerAuthorized(false)}}>Back</button></>}
      </section>
    </main>
  );
}
