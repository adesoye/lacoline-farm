import { httpsCallable } from 'firebase/functions';
import { functions } from './client';
import type { Role } from '@/lib/domain/types';

export function createOrganization(data: { name: string; slug?: string }) {
  return httpsCallable(functions, 'createOrganization')(data);
}

export function createFirebaseUser(data: { orgId: string; email: string; password: string; fullName: string; role: Role }) {
  return httpsCallable(functions, 'createUser')(data);
}

export function updateFirebaseUserRole(data: { orgId: string; uid: string; role: Role }) {
  return httpsCallable(functions, 'updateUserRole')(data);
}

export function setFirebaseUserActive(data: { orgId: string; uid: string; active: boolean }) {
  return httpsCallable(functions, 'setUserActive')(data);
}

export function deleteFirebaseUserAccount(data: { orgId: string; uid: string }) {
  return httpsCallable(functions, 'deleteUserAccount')(data);
}

export function resetFirebaseUserPassword(data: { orgId: string; uid: string; password: string }) {
  return httpsCallable(functions, 'resetUserPassword')(data);
}
