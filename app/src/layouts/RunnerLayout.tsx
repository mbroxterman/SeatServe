import { ArrowLeft, LogOut, Smartphone } from "lucide-react";
import { Link, Outlet, useParams } from "react-router-dom";
import { useSeatServe } from "../state/SeatServeContext";
import "./RunnerLayout.css";

export default function RunnerLayout() {
  const { runnerId } = useParams();
  const { activeEvent, data } = useSeatServe();
  const runner = data.runners.find((item) => item.id === runnerId);
  const venue = data.venues.find((item) => item.id === activeEvent?.venueId);

  return (
    <div className="runner-shell">
      <header className="runner-shell__header">
        <Link to="/runner" className="runner-shell__brand" aria-label="Runner home">
          <img src="/seatserve-web-logo.png" alt="SeatServe" />
          <div>
            <span>SeatServe Runner</span>
            <strong>Runner Mobile</strong>
          </div>
        </Link>

        <div className="runner-shell__event">
          <span className={activeEvent ? "is-live" : ""} />
          <div>
            <small>{activeEvent ? "Current event" : "Event status"}</small>
            <strong>{activeEvent ? `${activeEvent.name} vs ${activeEvent.opponent}` : "No active event"}</strong>
            {venue && <em>{venue.name}</em>}
          </div>
        </div>

        <nav className="runner-shell__actions" aria-label="Runner navigation">
          {runner ? <Link to="/runner"><ArrowLeft size={18} />Switch runner</Link> : <Link to="/admin/runners"><ArrowLeft size={18} />Runner manager</Link>}
          <span className="runner-shell__identity"><Smartphone size={18} />{runner?.name ?? "Runner access"}</span>
          <Link to="/admin" className="runner-shell__exit" aria-label="Exit Runner Mobile"><LogOut size={18} /></Link>
        </nav>
      </header>
      <main className="runner-shell__main"><Outlet /></main>
    </div>
  );
}
