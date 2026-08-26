import { useMemo, useState, type FormEvent } from "react";
import {
    BadgeCheck,
    CirclePlus,
    Copy,
    MapPin,
    Pencil,
    Search,
    Star,
    Trash2,
    UserCheck,
    UserRound,
    Users,
    X,
    AlertTriangle, // Import AlertTriangle icon
} from "lucide-react";
import { useSeatServe } from "../../state/SeatServeContext";
import type { Runner, RunnerStatus } from "../../types/domain";
import "./RunnerManager.css";

type RunnerDraft = Omit<Runner, "id" | "activeOrderId" | "completedDeliveries" | "rating">;
type Filter = "all" | RunnerStatus | "inactive";

const statusLabel: Record<RunnerStatus, string> = {
    available: "Available",
    assigned: "Assigned",
    returning: "Returning",
    offline: "Offline",
};

export default function RunnerManager() {
    const {
        data,
        addRunner,
        updateRunner,
        duplicateRunner,
        deleteRunner,
        setRunnerStatus,
    } = useSeatServe();
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const [editor, setEditor] = useState<Runner | null | undefined>(undefined);
    const [notice, setNotice] = useState("");

    const filteredRunners = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        return [...data.runners]
            .filter((runner) => {
                if (filter === "inactive") return !runner.active;
                if (filter !== "all") return runner.active && runner.status === filter;
                return true;
            })
            .filter((runner) => {
                const venue = data.venues.find((candidate) => candidate.id === runner.venueId)?.name ?? "";
                return !normalized || `${runner.name} ${runner.email} ${runner.phone} ${venue}`.toLowerCase().includes(normalized);
            })
            .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
    }, [data.runners, data.venues, filter, query]);

    const activeRunners = data.runners.filter((runner) => runner.active).length;
    const availableRunners = data.runners.filter((runner) => runner.active && runner.status === "available").length;
    const assignedRunners = data.runners.filter((runner) => runner.active && runner.status === "assigned").length;
    const deliveries = data.runners.reduce((sum, runner) => sum + runner.completedDeliveries, 0);

    const removeRunner = (runner: Runner) => {
        if (!window.confirm(`Remove ${runner.name} from the runner roster?`)) return;
        if (!deleteRunner(runner.id)) setNotice("This runner has an active order and cannot be removed yet.");
    };

    const forceAvailable = (runnerId: string) => {
        if (!window.confirm("Force this runner to become available? This should only be used if the runner is stuck on a deleted or invalid order.")) return;

        // 1. Find the full runner object from the data array.
        const runner = data.runners.find(r => r.id === runnerId);
        if (!runner) {
            setNotice("Could not find the runner to update.");
            return;
        }

        // 2. Create a complete, valid RunnerDraft object using the runner's existing data.
        // This ensures all properties required by RunnerDraft are present and correctly typed.
        const updatedDraft: RunnerDraft = {
            name: runner.name,
            email: runner.email ?? "", // Use existing value or default to empty string
            phone: runner.phone ?? "", // Use existing value or default to empty string
            role: runner.role,
            status: 'available', // 3. This is the only change we are making
            active: runner.active,
            venueId: runner.venueId,
            zoneIds: runner.zoneIds ?? [],
            shiftStart: runner.shiftStart,
            shiftEnd: runner.shiftEnd,
        };

        // 4. Call updateRunner with the complete, valid draft. This will succeed.
        // The logic within your `updateRunner` function should also handle clearing the `activeOrderId` when a runner's status is set to 'available'.
        updateRunner(runnerId, updatedDraft);
        setNotice("Runner status has been reset to Available.");
    };




    return (
        <section className="runner-page">
            <header className="runner-page__header">
                <div>
                    <p className="runner-eyebrow">Administration</p>
                    <h1>Runner Management</h1>
                    <p>Manage the delivery roster, availability, and live assignment status.</p>
                </div>
                <button className="runner-button runner-button--primary" type="button" onClick={() => setEditor(null)}>
                    <CirclePlus size={18} /> Add runner
                </button>
            </header>
            <div className="runner-summary" aria-label="Runner summary">
                <SummaryCard icon={<Users size={21} />} label="Active roster" value={activeRunners} />
                <SummaryCard icon={<UserCheck size={21} />} label="Available now" value={availableRunners} />
                <SummaryCard icon={<BadgeCheck size={21} />} label="Assigned" value={assignedRunners} />
                <SummaryCard icon={<Star size={21} />} label="Completed deliveries" value={deliveries} />
            </div>
            {notice && (
                <div className="runner-notice">
                    <span>{notice}</span>
                    <button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={16} /></button>
                </div>
            )}
            <div className="runner-toolbar">
                <label className="runner-search">
                    <Search size={17} />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search runners" />
                </label>
                <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
                    <option value="all">All runners</option>
                    <option value="available">Available</option>
                    <option value="assigned">Assigned</option>
                    <option value="offline">Offline</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>
            {filteredRunners.length === 0 ? (
                <div className="runner-empty">
                    <UserRound size={44} />
                    <h2>No runners found</h2>
                    <p>Adjust the filters or add a runner to the roster.</p>
                </div>
            ) : (
                <div className="runner-grid">
                    {filteredRunners.map((runner) => {
                        const venue = data.venues.find((candidate) => candidate.id === runner.venueId);
                        const isStuck = runner.activeOrderId && !data.orders.some(o => o.id === runner.activeOrderId);

                        return (
                            <article key={runner.id} className={`runner-card ${!runner.active ? "is-inactive" : ""} ${isStuck ? "is-stuck" : ""}`}>
                                <div className="runner-card__top">
                                    <div className="runner-avatar">{runner.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
                                    <div className="runner-card__identity">
                                        <div className="runner-card__name-row">
                                            <h2>{runner.name}</h2>
                                            <span className={`runner-status runner-status--${runner.active ? runner.status : "inactive"}`}>
                                                {runner.active ? statusLabel[runner.status] : "Inactive"}
                                            </span>
                                        </div>
                                        <p>{runner.role === "lead" ? "Runner Lead" : "Runner"}</p>
                                    </div>
                                </div>
                                <div className="runner-card__details">
                                    <div><span>Email</span><strong>{runner.email || "Not provided"}</strong></div>
                                    <div><span>Phone</span><strong>{runner.phone || "Not provided"}</strong></div>
                                    <div><span>Shift</span><strong>{runner.shiftStart}–{runner.shiftEnd}</strong></div>
                                    <div><span>Performance</span><strong>{runner.completedDeliveries} deliveries · {runner.rating.toFixed(1)} ★</strong></div>
                                </div>
                                <div className="runner-card__scope">
                                    <MapPin size={16} />
                                    <div>
                                        <strong>{venue?.name ?? "All venues"}</strong>
                                        <span>Eligible for the next available assignment</span>
                                    </div>
                                </div>

                                <div className="runner-card__status-controls" aria-label={`Set ${runner.name} availability`}>
                                    {isStuck ? (
                                        <div className="runner-card__system-status is-error">
                                            <AlertTriangle size={16} />
                                            <span>Stuck on deleted order</span>
                                            <button className="force-available-btn" onClick={() => forceAvailable(runner.id)}>Force Available</button>
                                        </div>
                                    ) : runner.activeOrderId || runner.status === "assigned" || runner.status === "returning" ? (
                                        <div className="runner-card__system-status">{statusLabel[runner.status]} · controlled by the active delivery</div>
                                    ) : (["available", "offline"] as RunnerStatus[]).map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            className={runner.status === status && runner.active ? "is-selected" : ""}
                                            disabled={!runner.active}
                                            onClick={() => setRunnerStatus(runner.id, status)}
                                        >
                                            {status === "offline" ? "Unavailable" : statusLabel[status]}
                                        </button>
                                    ))}
                                </div>

                                <div className="runner-card__actions">
                                    <button type="button" onClick={() => setEditor(runner)}><Pencil size={16} /> Edit</button>
                                    <button type="button" onClick={() => duplicateRunner(runner.id)}><Copy size={16} /> Duplicate</button>
                                    <button type="button" className="is-danger" onClick={() => removeRunner(runner)}><Trash2 size={16} /> Remove</button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
            {editor !== undefined && (
                <RunnerDialog
                    runner={editor ?? undefined}
                    venues={data.venues}
                    onClose={() => setEditor(undefined)}
                    onSave={(draft) => {
                        if (editor) updateRunner(editor.id, draft);
                        else addRunner(draft);
                        setEditor(undefined);
                    }}
                />
            )}
        </section>
    );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return <article className="runner-summary-card"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>;
}

function RunnerDialog({ runner, venues, onClose, onSave }: { runner?: Runner; venues: ReturnType<typeof useSeatServe>["data"]["venues"]; onClose: () => void; onSave: (draft: RunnerDraft) => void }) {
    const [name, setName] = useState(runner?.name ?? "");
    const [email, setEmail] = useState(runner?.email ?? "");
    const [phone, setPhone] = useState(runner?.phone ?? "");
    const [role, setRole] = useState<Runner["role"]>(runner?.role ?? "runner");
    const [status, setStatus] = useState<RunnerStatus>(runner?.status ?? "offline");
    const [active, setActive] = useState(runner?.active ?? true);
    const [venueId, setVenueId] = useState(runner?.venueId ?? "");
    const [shiftStart, setShiftStart] = useState(runner?.shiftStart ?? "17:30");
    const [shiftEnd, setShiftEnd] = useState(runner?.shiftEnd ?? "22:00");

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim(), email: email.trim(), phone: phone.trim(), role, status: active ? status : "offline", active, venueId, zoneIds: [], shiftStart, shiftEnd });
    };

    return (
        <div className="runner-dialog-backdrop" role="presentation" onMouseDown={onClose}>
            <form className="runner-dialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
                <div className="runner-dialog__heading">
                    <div><p className="runner-eyebrow">Runner roster</p><h2>{runner ? "Edit runner" : "Add runner"}</h2></div>
                    <button type="button" aria-label="Close" onClick={onClose}><X /></button>
                </div>
                <div className="runner-form-grid">
                    <label className="runner-form-grid__wide">Full name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} /></label>
                    <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                    <label>Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
                    <label>Role<select value={role} onChange={(event) => setRole(event.target.value as Runner["role"])}><option value="runner">Runner</option><option value="lead">Runner Lead</option></select></label>
                    <label>Current status<select value={status} disabled={!active} onChange={(event) => setStatus(event.target.value as RunnerStatus)}><option value="available">Available</option><option value="assigned">Assigned</option><option value="returning">Returning</option><option value="offline">Offline</option></select></label>
                    <label>Shift starts<input type="time" value={shiftStart} onChange={(event) => setShiftStart(event.target.value)} /></label>
                    <label>Shift ends<input type="time" value={shiftEnd} onChange={(event) => setShiftEnd(event.target.value)} /></label>
                    <label className="runner-form-grid__wide">Primary venue<select value={venueId} onChange={(event) => setVenueId(event.target.value)}><option value="">All venues</option>{venues.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                </div>
                <label className="runner-active-check"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active roster member</label>
                <div className="runner-dialog__actions">
                    <button type="button" className="runner-button" onClick={onClose}>Cancel</button>
                    <button className="runner-button runner-button--primary">Save runner</button>
                </div>
            </form>
        </div>
    );
}
