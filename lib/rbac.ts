import { roleAccess } from '@/lib/domain/constants';
import type { Role, RouteKey } from '@/lib/domain/types';

export const allOrganizationRoles: Role[] = [
  'admin',
  'manager',
  'staff',
  'viewer'
];

export const managerAssignableRoles: Role[] = [
  'staff',
  'viewer'
];

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

export function canViewFinance(role?: Role | undefined | null ) {
  return role === 'admin' || role === 'manager';
}

export function canManageUsers(role: Role | undefined | null) {
  return role === 'admin' || role === 'manager';
}

export function canDeleteRecords(role: Role | undefined | null) {
  return role === 'admin' || role === 'manager';
}

export function getAssignableRoles(
  role: Role | undefined | null
): Role[] {
  if (role === 'admin') {
    return allOrganizationRoles;
  }

  if (role === 'manager') {
    return managerAssignableRoles;
  }

  return [];
}

/**
 * Determines whether the current user may modify an existing member.
 *
 * Managers can manage only staff and viewer accounts.
 * Users cannot modify their own membership from this screen.
 */
export function canManageMember(
  actorRole: Role | undefined | null,
  targetRole: Role,
  isSelf = false
) {
  if (!actorRole || isSelf) return false;

  if (actorRole === 'admin') {
    return true;
  }

  if (actorRole === 'manager') {
    return managerAssignableRoles.includes(targetRole);
  }

  return false;
}