import { ArrowLeft, Bell, BellOff, CircleUserRound, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useSeatServe } from "../state/SeatServeContext";
import "./KitchenLayout.css";

const SOUND_PREF_KEY = "seatserve:kitchen-sound-enabled";

// A short, pleasant two-note chime synthesized with the Web Audio API - no
// external sound file to host, no CORS/loading concerns, and it fails
// silently if audio is blocked rather than breaking the dashboard.
function playNewOrderChime() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.28, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.05);
    };
    playTone(880, 0, 0.18);
    playTone(1174.66, 0.16, 0.28);
    window.setTimeout(() => void ctx.close(), 700);
  } catch {
    // Sound is a nice-to-have - never let it break the dashboard.
  }
}

export default function KitchenLayout() {
  const { activeEvent, data } = useSeatServe();
  const venues = Array.isArray(data?.venues) ? data.venues : [];
  const venue = venues.find((item) => item.id === activeEvent?.venueId);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(SOUND_PREF_KEY) !== "false"; } catch { return true; }
  });
  // null means "haven't seeded yet" - used so we never alert for orders that
  // were already sitting in New before this page was opened, only ones that
  // arrive afterward.
  const knownNewOrderIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const currentNewIds = new Set((data?.orders ?? []).filter((order) => order.status === "new").map((order) => order.id));
    if (knownNewOrderIdsRef.current === null) {
      knownNewOrderIdsRef.current = currentNewIds;
      return;
    }
    const previouslyKnown = knownNewOrderIdsRef.current;
    const hasGenuinelyNewOrder = [...currentNewIds].some((id) => !previouslyKnown.has(id));
    if (hasGenuinelyNewOrder && soundEnabled) playNewOrderChime();
    knownNewOrderIdsRef.current = currentNewIds;
  }, [data?.orders, soundEnabled]);

  const toggleSound = () => {
    setSoundEnabled((value) => {
      const next = !value;
      try { localStorage.setItem(SOUND_PREF_KEY, String(next)); } catch { /* ignore storage errors */ }
      return next;
    });
  };

  return (
    <div className="kitchen-shell">
      <header className="kitchen-shell__header">
        <div className="kitchen-shell__brand">
          <img src="/seatserve-web-logo.png" alt="SeatServe" />
          <div>
            <span>Live event operations</span>
            <strong>Kitchen Operations</strong>
          </div>
        </div>

        <div className="kitchen-shell__event">
          <span className={activeEvent ? "is-live" : ""} aria-hidden="true" />
          <div>
            <small>{activeEvent ? "Current event" : "Event status"}</small>
            <strong>
              {activeEvent
                ? `${activeEvent.name} vs ${activeEvent.opponent}`
                : "No active event"}
            </strong>
            {venue && <em>{venue.name}</em>}
          </div>
        </div>

        <nav className="kitchen-shell__actions" aria-label="Kitchen actions">
          <Link to="/admin" className="kitchen-shell__admin-link">
            <ArrowLeft size={17} />
            <span>Administration</span>
          </Link>
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? "Mute new order sound" : "Unmute new order sound"}
            title={soundEnabled ? "New order sound: on" : "New order sound: off"}
          >
            {soundEnabled ? <Bell size={19} /> : <BellOff size={19} />}
          </button>
          <button type="button" aria-label="Kitchen user">
            <CircleUserRound size={20} />
            <span>Kitchen Staff</span>
          </button>
          <Link to="/admin" className="kitchen-shell__exit" aria-label="Exit Kitchen Operations">
            <LogOut size={18} />
          </Link>
        </nav>
      </header>

      <main className="kitchen-shell__main">
        <Outlet />
      </main>
    </div>
  );
}
