import { createBrowserRouter, Navigate } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout";
import CustomerLayout from "../layouts/CustomerLayout";
import KitchenLayout from "../layouts/KitchenLayout";
import RunnerLayout from "../layouts/RunnerLayout";
import NotFound from "../pages/NotFound";
import PlaceholderPage from "../pages/PlaceholderPage";
import CustomerExperience from "../pages/administration/CustomerExperience";
import Dashboard from "../pages/administration/Dashboard";
import EventManager from "../pages/administration/EventManager";
import MenuManager from "../pages/administration/MenuManager";
import KitchenOperations from "../pages/administration/KitchenOperations";
import RunnerManager from "../pages/administration/RunnerManager";
import SettingsPage from "../pages/administration/SettingsPage";
import VenueManager from "../pages/administration/VenueManager";
import CustomerOrder from "../pages/customer/CustomerOrder";
import OrderTracking from "../pages/customer/OrderTracking";
import RunnerMobile from "../pages/runner/RunnerMobile";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/admin" replace /> },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "events", element: <EventManager /> },
      { path: "venues", element: <VenueManager /> },
      { path: "zones", element: <Navigate to="/admin/venues" replace /> },
      { path: "menu", element: <MenuManager /> },
      { path: "runners", element: <RunnerManager /> },
      { path: "customer-experience", element: <CustomerExperience /> },
      { path: "kitchen", element: <Navigate to="/kitchen" replace /> },
      { path: "orders", element: <Navigate to="/kitchen" replace /> },
      { path: "reports", element: <PlaceholderPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  {
    path: "/kitchen",
    element: <KitchenLayout />,
    children: [
      { index: true, element: <KitchenOperations /> },
    ],
  },
  {
    path: "/order",
    element: <CustomerLayout />,
    children: [
      { path: ":eventId/:venueId/:zoneId", element: <CustomerOrder /> },
      { path: "track/:orderId", element: <OrderTracking /> },
    ],
  },
  {
    path: "/runner",
    element: <RunnerLayout />,
    children: [
      { index: true, element: <RunnerMobile /> },
      { path: ":runnerId", element: <RunnerMobile /> },
    ],
  },
  { path: "/track/:orderId", element: <LegacyTrackingRedirect /> },
  { path: "/administration", element: <Navigate to="/admin" replace /> },
  { path: "/administration/events", element: <Navigate to="/admin/events" replace /> },
  { path: "/administration/venues", element: <Navigate to="/admin/venues" replace /> },
  { path: "/administration/zones", element: <Navigate to="/admin/venues" replace /> },
  { path: "/administration/menu", element: <Navigate to="/admin/menu" replace /> },
  { path: "/administration/runners", element: <Navigate to="/admin/runners" replace /> },
  { path: "*", element: <NotFound /> },
]);

function LegacyTrackingRedirect() {
  const orderId = window.location.pathname.split("/").filter(Boolean).at(-1);
  return <Navigate to={`/order/track/${orderId ?? ""}`} replace />;
}
