import { createBrowserRouter, Navigate } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout";
import CustomerLayout from "../layouts/CustomerLayout";
import KitchenLayout from "../layouts/KitchenLayout";
import RunnerLayout from "../layouts/RunnerLayout";
import NotFound from "../pages/NotFound";
import AppErrorPage from "../pages/AppErrorPage";
import CustomerExperience from "../pages/administration/CustomerExperience";
import Dashboard from "../pages/administration/Dashboard";
import EventManager from "../pages/administration/EventManager";
import MenuManager from "../pages/administration/MenuManager";
import KitchenOperations from "../pages/administration/KitchenOperations";
import RunnerManager from "../pages/administration/RunnerManager";
import SettingsPage from "../pages/administration/SettingsPage";
import Reports from "../pages/administration/Reports";
import VenueManager from "../pages/administration/VenueManager";
import CustomerOrder from "../pages/customer/CustomerOrder";
import OrderTracking from "../pages/customer/OrderTracking";
import RunnerMobile from "../pages/runner/RunnerMobile";
import StableZoneEntry from "../pages/customer/StableZoneEntry";
import OrderLanding from "../pages/customer/OrderLanding";
import StaffEntry from "../pages/StaffEntry";
import StaffGuard from "../components/StaffGuard";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/admin" replace /> },
  {
    path: "/admin",
    element: <StaffGuard role="admin"><AdminLayout /></StaffGuard>,
    errorElement: <AppErrorPage />,
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
      { path: "reports", element: <Reports /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  {
    path: "/kitchen",
    element: <StaffGuard role="kitchen"><KitchenLayout /></StaffGuard>,
    errorElement: <AppErrorPage />,
    children: [
      { index: true, element: <KitchenOperations /> },
    ],
  },
  {
    path: "/order",
    element: <CustomerLayout />,
    errorElement: <AppErrorPage />,
    children: [
      { index: true, element: <OrderLanding /> },
      { path: ":eventId/:venueId/:zoneId", element: <CustomerOrder /> },
      { path: "zone/:venueId/:zoneId", element: <StableZoneEntry /> },
      { path: "track/:orderId", element: <OrderTracking /> },
    ],
  },
  {
    path: "/runner",
    element: <StaffGuard role="runner"><RunnerLayout /></StaffGuard>,
    errorElement: <AppErrorPage />,
    children: [
      { index: true, element: <RunnerMobile /> },
      { path: ":runnerId", element: <RunnerMobile /> },
    ],
  },
  { path: "/staff", element: <StaffEntry />, errorElement: <AppErrorPage /> },
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
