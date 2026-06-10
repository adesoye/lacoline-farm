import { roleAccess } from '@/lib/domain/constants';
import type { Role, RouteKey } from '@/lib/domain/types';

export function canAccess(role: Role | undefined | null, route: RouteKey) {
  if (!role) return false;
  return roleAccess[role]?.includes(route) ?? false;
}

export function canWriteFarm(role: Role | undefined | null) {
  return role === 'admin' || role === 'manager' || role === 'staff';
}

export function canManageFinance(role: Role | undefined | null) {
  return role === 'admin' || role === 'manager';
}

export function canManageUsers(role: Role | undefined | null) {
  return role === 'admin';
}

export function canDeleteRecords(role: Role | undefined | null) {
  return role === 'admin' || role === 'manager';
}
