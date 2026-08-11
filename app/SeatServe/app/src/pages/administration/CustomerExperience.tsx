import { ExternalLink, MapPin, QrCode, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { useSeatServe } from "../../state/SeatServeContext";
import "./CustomerExperience.css";

export default function CustomerExperience() {
  const { data, activeEvent } = useSeatServe();
  const venue = data.venues.find((item) => item.id === activeEvent?.venueId);
  const zones = venue?.zones.filter((zone) => zone.active && zone.deliveryEnabled) ?? [];

  return (
    <section className="customer-experience-page">
      <div className="customer-experience-heading">
        <div>
          <p className="eyebrow">Customer experience</p>
          <h2>Zone ordering links</h2>
          <p>Customer ordering is a separate mobile experience. Use this page to preview and manage each zone entry point.</p>
        </div>
        <Link className="secondary-button" to="/admin/venues">Manage Venue &amp; Zones</Link>
      </div>

      <section className="customer-experience-summary">
        <div className="customer-experience-icon"><ShoppingBag size={24} /></div>
        <div>
          <span>Current event</span>
          <h3>{activeEvent ? `${activeEvent.name} vs ${activeEvent.opponent}` : "No scheduled event"}</h3>
          <p>{venue?.name ?? "Assign a venue to the event"} · Ordering {activeEvent?.orderingEnabled ? "open" : "closed"}</p>
        </div>
      </section>

      <section className="customer-experience-panel">
        <div className="customer-experience-panel__heading">
          <div>
            <p className="eyebrow">Zone QR destinations</p>
            <h3>Customer ordering previews</h3>
          </div>
          <span>{zones.length} active zones</span>
        </div>

        {activeEvent && venue && zones.length > 0 ? (
          <div className="customer-zone-grid">
            {zones.map((zone) => {
              const path = `/order/${activeEvent.id}/${venue.id}/${zone.id}`;
              return (
                <article key={zone.id} className="customer-zone-card">
                  <div className="customer-zone-card__icon"><QrCode size={22} /></div>
                  <div className="customer-zone-card__copy">
                    <h4>{zone.name}</h4>
                    <p><MapPin size={14} /> {venue.name}</p>
                    <small>QR opens this zone automatically. Customer selects only top/middle/bottom and left/center/right.</small>
                  </div>
                  <Link to={path} target="_blank" rel="noreferrer">Preview <ExternalLink size={15} /></Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="customer-experience-empty">
            <QrCode size={30} />
            <h3>No customer zone links available</h3>
            <p>Schedule an event, assign a venue, and enable at least one delivery zone.</p>
            <Link className="primary-button" to="/admin/venues">Configure zones</Link>
          </div>
        )}
      </section>
    </section>
  );
}
