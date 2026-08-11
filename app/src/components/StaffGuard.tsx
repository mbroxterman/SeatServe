import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSeatServe } from '../state/SeatServeContext';
import { grantStaffSession, hasStaffSession, type StaffRole, verifyPin } from '../services/staffAuth';
import './StaffGuard.css';

export default function StaffGuard({ role, children }: { role: StaffRole; children?: ReactNode }) {
  const { data } = useSeatServe();
  const location = useLocation();
  const [authorized, setAuthorized] = useState(() => hasStaffSession(role));
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const hash = data.staffAccess?.[`${role}PinHash` as 'adminPinHash'];
  const protectedRole = Boolean(hash);

  useEffect(() => {
    const refresh = () => setAuthorized(hasStaffSession(role));
    window.addEventListener('seatserve:staff-auth', refresh);
    return () => window.removeEventListener('seatserve:staff-auth', refresh);
  }, [role]);

  if (!protectedRole) return children ?? <Outlet />;
  if (authorized) return children ?? <Outlet />;
  if (location.pathname === '/staff') return <Navigate to="/staff" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    const ok = await verifyPin(pin, hash);
    if (ok) { grantStaffSession(role); setAuthorized(true); }
    else setError('Incorrect PIN. Please try again.');
    setBusy(false);
  };

  const label = role === 'admin' ? 'Administration' : role === 'kitchen' ? 'Kitchen Operations' : 'Runner Mobile';
  return <main className="staff-guard"><section className="staff-guard__card"><img src="/seatserve-web-logo.png" alt="SeatServe"/><ShieldCheck size={34}/><p>Staff access</p><h1>{label}</h1><span>Enter the workspace PIN to continue.</span><form onSubmit={submit}><label><LockKeyhole size={18}/><input autoFocus inputMode="numeric" autoComplete="one-time-code" type="password" value={pin} onChange={(e)=>setPin(e.target.value)} placeholder="PIN"/></label>{error && <div className="staff-guard__error">{error}</div>}<button disabled={busy || !pin.trim()}>{busy ? 'Checking…' : 'Continue'}</button></form><Link to="/staff">Back to staff access</Link></section></main>;
}
