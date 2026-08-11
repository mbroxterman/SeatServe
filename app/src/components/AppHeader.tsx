import { Bell, ChevronDown, CircleUserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getActiveWorkspace, listWorkspaces, switchWorkspace, type WorkspaceProfile } from "../services/persistence";
import "./AppHeader.css";

interface AppHeaderProps { pageTitle?: string; sectionLabel?: string; }

export default function AppHeader({ pageTitle = "Administration", sectionLabel = "SeatServe Administration" }: AppHeaderProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceProfile[]>(() => listWorkspaces());
  const [activeId, setActiveId] = useState(() => getActiveWorkspace().id);

  useEffect(() => {
    const refresh = () => { setWorkspaces(listWorkspaces()); setActiveId(getActiveWorkspace().id); };
    window.addEventListener("seatserve:workspaces", refresh);
    return () => window.removeEventListener("seatserve:workspaces", refresh);
  }, []);

  const changeWorkspace = (id: string) => {
    if (id === activeId) return;
    switchWorkspace(id);
    window.location.reload();
  };

  return (
    <header className="app-header">
      <Link to="/admin" className="app-header__brand" aria-label="SeatServe administration home">
        <img src="/seatserve-web-logo.png" alt="SeatServe — Skip the line. Stay in the game." className="app-header__logo" />
      </Link>
      <div className="app-header__context" aria-label="Current application"><div className="app-header__section">{sectionLabel}</div><div className="app-header__title">{pageTitle}</div></div>
      <div className="app-header__actions">
        <label className="workspace-switcher" aria-label="Current workspace">
          <span className="workspace-pill__status" />
          <select value={activeId} onChange={(event) => changeWorkspace(event.target.value)}>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.environment === "development" ? "DEV · " : workspace.environment === "demo" ? "DEMO · " : ""}{workspace.name}</option>)}</select>
          <ChevronDown size={14}/>
        </label>
        <button className="icon-button" type="button" aria-label="Notifications"><Bell size={18}/></button>
        <button className="profile-button" type="button"><CircleUserRound size={20}/><span>Administrator</span><ChevronDown size={15}/></button>
      </div>
    </header>
  );
}
