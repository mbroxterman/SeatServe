import { useLocation } from "react-router-dom";
import PageState from "../components/ui/PageState";

const titles: Record<string, [string, string]> = {
  "/admin/events": ["Event Manager", "Create, schedule, publish, and operate SeatServe events."],
  "/admin/venues": ["Venue & Zone Manager", "Configure venues, sections, delivery zones, and service points."],
  "/admin/menu": ["Menu Manager", "Manage categories, items, pricing, availability, and concession locations."],
  "/admin/runners": ["Runner Management", "Manage the runner roster, availability, and assignments."],
  "/admin/orders": ["Order Dispatch", "Monitor live orders, preparation status, and delivery assignments."],
  "/admin/reports": ["Reports & Analytics", "Review sales, delivery performance, runner metrics, and fees."],
  "/admin/settings": ["Workspace Settings", "Configure organization, permissions, notifications, and integrations."],
};

export default function PlaceholderPage() {
  const location = useLocation();
  const [title, description] = titles[location.pathname] ?? ["SeatServe", "This module is ready for its feature package."];
  return <PageState title={title} description={description} />;
}
