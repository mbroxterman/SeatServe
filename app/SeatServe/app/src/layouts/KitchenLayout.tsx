import { ArrowLeft, Bell, CircleUserRound, LogOut } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import { useSeatServe } from "../state/SeatServeContext";
import "./KitchenLayout.css";

export default function KitchenLayout() {
  const { activeEvent, data } = useSeatServe();
  const venues = Array.isArray(data?.venues) ? data.venues : [];
  const venue = venues.find((item) => item.id === activeEvent?.venueId);

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
          <button type="button" aria-label="Kitchen notifications">
            <Bell size={19} />
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
