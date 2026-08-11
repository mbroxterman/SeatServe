import { getActiveWorkspaceId } from './persistence';

export type StaffRole = 'admin' | 'kitchen' | 'runner';

const sessionKey = (role: StaffRole) => `seatserve.staff.${getActiveWorkspaceId()}.${role}`;
const runnerKey = () => `seatserve.staff.${getActiveWorkspaceId()}.runnerId`;

export async function hashPin(pin: string): Promise<string> {
  const normalized = pin.trim();
  if (!normalized) return '';
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(pin: string, expectedHash?: string): Promise<boolean> {
  if (!expectedHash) return true;
  return (await hashPin(pin)) === expectedHash;
}

export function grantStaffSession(role: StaffRole, runnerId?: string) {
  sessionStorage.setItem(sessionKey(role), '1');
  if (role === 'runner') {
    if (runnerId) sessionStorage.setItem(runnerKey(), runnerId);
    else sessionStorage.removeItem(runnerKey());
  }
  window.dispatchEvent(new CustomEvent('seatserve:staff-auth'));
}

export function revokeStaffSession(role?: StaffRole) {
  const roles: StaffRole[] = role ? [role] : ['admin', 'kitchen', 'runner'];
  roles.forEach((item) => sessionStorage.removeItem(sessionKey(item)));
  if (!role || role === 'runner') sessionStorage.removeItem(runnerKey());
  window.dispatchEvent(new CustomEvent('seatserve:staff-auth'));
}

export function hasStaffSession(role: StaffRole): boolean {
  return sessionStorage.getItem(sessionKey(role)) === '1';
}

export function getAuthorizedRunnerId(): string | undefined {
  return sessionStorage.getItem(runnerKey()) || undefined;
}
