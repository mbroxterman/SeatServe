import {
  BarChart3,
  CalendarDays,
  Gauge,
  MapPinned,
  MenuSquare,
  QrCode,
  Settings,
  UsersRound,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import "./AdminLayout.css";

const setupLinks = [
  { to: "/admin/events", label: "Events", icon: CalendarDays },
  { to: "/admin/venues", label: "Venue & Zones", icon: MapPinned },
  { to: "/admin/menu", label: "Menu Management", icon: MenuSquare },
  { to: "/admin/runners", label: "Runner Management", icon: UsersRound },
  { to: "/admin/customer-experience", label: "QR & Customer", icon: QrCode },
];

export default function AdminLayout() {
  return (
    <div className="admin-shell">
      <AppHeader />
      <div className="admin-shell__body">
        <aside className="admin-sidebar" aria-label="Administration navigation">
          <NavItem to="/admin" label="Dashboard" icon={Gauge} end />
          <NavGroup label="Event setup" links={setupLinks} />
          <div className="admin-sidebar__group">
            <p>Reports</p>
            <NavItem to="/admin/reports" label="Reports" icon={BarChart3} />
          </div>
          <div className="admin-sidebar__group">
            <p>Workspace</p>
            <NavItem to="/admin/settings" label="Settings" icon={Settings} />
          </div>
          <div className="admin-sidebar__version">SeatServe v2.1.7H</div>
        </aside>

        <div className="admin-shell__content">
          <main className="admin-shell__main"><Outlet /></main>
          <footer className="admin-shell__footer">© 2026 SeatServe · Administration v2.1.7H</footer>
        </div>
      </div>
    </div>
  );
}

function NavGroup({ label, links }: { label: string; links: typeof setupLinks }) {
  return (
    <div className="admin-sidebar__group">
      <p>{label}</p>
      {links.map((link) => <NavItem key={link.to} {...link} />)}
    </div>
  );
}

function NavItem({ to, label, icon: Icon, end = false }: { to: string; label: string; icon: typeof Gauge; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `admin-sidebar__link${isActive ? " is-active" : ""}`}>
      <Icon size={20} strokeWidth={2.1} />
      <span>{label}</span>
    </NavLink>
  );
}
