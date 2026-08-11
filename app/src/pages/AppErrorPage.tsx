import { AlertTriangle, Home, RefreshCcw } from "lucide-react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import "./AppErrorPage.css";

export default function AppErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText || "Application error"}`
    : error instanceof Error
      ? error.message
      : "SeatServe encountered an unexpected error.";

  return (
    <main className="app-error-page">
      <section className="app-error-card">
        <div className="app-error-card__icon"><AlertTriangle size={34} /></div>
        <p>SeatServe Pilot Recovery</p>
        <h1>Something went wrong</h1>
        <span>Your saved workspace data has not been deleted. Reload the page first; if the problem continues, return to Administration.</span>
        <code>{message}</code>
        <div className="app-error-actions">
          <button type="button" onClick={() => window.location.reload()}><RefreshCcw size={18}/>Reload SeatServe</button>
          <Link to="/admin"><Home size={18}/>Administration</Link>
        </div>
      </section>
    </main>
  );
}
