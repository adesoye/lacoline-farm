import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

admin.initializeApp();
const auth = admin.auth();
const firestore = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

type Role = 'admin' | 'manager' | 'staff' | 'viewer';
const roles: Role[] = ['admin', 'manager', 'staff', 'viewer'];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 64) || `org-${Date.now()}`;
}

function assertRole(role: unknown): asserts role is Role {
  if (!roles.includes(role as Role)) throw new HttpsError('invalid-argument', 'Invalid role.');
}

async function assertOrgAdmin(uid: string | undefined, orgId: string | undefined) {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (!orgId) throw new HttpsError('invalid-argument', 'orgId is required.');

  const [orgSnapshot, memberSnapshot] = await Promise.all([
    firestore.doc(`organizations/${orgId}`).get(),
    firestore.doc(`organizations/${orgId}/members/${uid}`).get()
  ]);

  if (!orgSnapshot.exists) throw new HttpsError('not-found', 'Organization not found.');

  const org = orgSnapshot.data();
  const member = memberSnapshot.data();
  if (!memberSnapshot.exists || member?.role !== 'admin' || member?.active !== true || org?.status === 'suspended') {
    throw new HttpsError('permission-denied', 'Organization admin access is required.');
  }

  return { org: { id: orgSnapshot.id, ...orgSnapshot.data() }, member };
}

async function upsertUserOrgMembership(params: {
  uid: string;
  email: string;
  fullName: string;
  orgId: string;
  orgName: string;
  role: Role;
  active?: boolean;
}) {
  const { uid, email, fullName, orgId, orgName, role, active = true } = params;
  const now = FieldValue.serverTimestamp();
  const batch = firestore.batch();

  batch.set(firestore.doc(`users/${uid}`), {
    uid,
    email,
    fullName,
    active: true,
    activeOrgId: orgId,
    orgIds: FieldValue.arrayUnion(orgId),
    updatedAt: now,
    createdAt: now
  }, { merge: true });

  batch.set(firestore.doc(`users/${uid}/organizations/${orgId}`), {
    orgId,
    orgName,
    uid,
    email,
    fullName,
    role,
    active,
    updatedAt: now,
    createdAt: now
  }, { merge: true });

  batch.set(firestore.doc(`organizations/${orgId}/members/${uid}`), {
    uid,
    email,
    fullName,
    role,
    active,
    updatedAt: now,
    createdAt: now
  }, { merge: true });

  await batch.commit();
}

export const createOrganization = onCall(async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const { name, slug } = request.data || {};
  if (!name || String(name).trim().length < 2) throw new HttpsError('invalid-argument', 'Organization name is required.');

  const user = await auth.getUser(uid);
  const orgRef = firestore.collection('organizations').doc();
  const orgName = String(name).trim();
  const now = FieldValue.serverTimestamp();

  await orgRef.set({
    name: orgName,
    slug: slug ? slugify(String(slug)) : slugify(orgName),
    plan: 'starter',
    status: 'trialing',
    ownerUid: uid,
    createdAt: now,
    updatedAt: now
  });

  await upsertUserOrgMembership({
    uid,
    email: user.email || '',
    fullName: user.displayName || user.email || 'Admin',
    orgId: orgRef.id,
    orgName,
    role: 'admin',
    active: true
  });

  await auth.setCustomUserClaims(uid, { active: true });
  return { orgId: orgRef.id };
});

export const createUser = onCall(async request => {
  const { orgId, email, password, fullName, role } = request.data || {};
  assertRole(role);
  if (!email || !fullName) throw new HttpsError('invalid-argument', 'Email and fullName are required.');
  await assertOrgAdmin(request.auth?.uid, orgId);

  const orgSnapshot = await firestore.doc(`organizations/${orgId}`).get();
  const orgName = orgSnapshot.data()?.name || 'Organization';

  let user: admin.auth.UserRecord;
  try {
    user = await auth.getUserByEmail(String(email));
    await auth.updateUser(user.uid, { displayName: fullName, disabled: false });
  } catch {
    if (!password || String(password).length < 6) {
      throw new HttpsError('invalid-argument', 'A password of at least 6 characters is required for new users.');
    }
    user = await auth.createUser({ email, password, displayName: fullName, disabled: false });
  }

  await upsertUserOrgMembership({
    uid: user.uid,
    email: String(email),
    fullName: String(fullName),
    orgId,
    orgName,
    role,
    active: true
  });

  await auth.setCustomUserClaims(user.uid, { active: true });
  return { uid: user.uid };
});

export const updateUserRole = onCall(async request => {
  const { orgId, uid, role } = request.data || {};
  assertRole(role);
  if (!uid) throw new HttpsError('invalid-argument', 'uid is required.');
  await assertOrgAdmin(request.auth?.uid, orgId);

  const now = FieldValue.serverTimestamp();
  await Promise.all([
    firestore.doc(`organizations/${orgId}/members/${uid}`).set({ role, updatedAt: now }, { merge: true }),
    firestore.doc(`users/${uid}/organizations/${orgId}`).set({ role, updatedAt: now }, { merge: true })
  ]);

  return { uid, role };
});

export const setUserActive = onCall(async request => {
  const { orgId, uid, active } = request.data || {};
  if (!uid || typeof active !== 'boolean') throw new HttpsError('invalid-argument', 'uid and active are required.');
  await assertOrgAdmin(request.auth?.uid, orgId);
  if (uid === request.auth?.uid && active === false) throw new HttpsError('failed-precondition', 'You cannot disable your own organization membership.');

  const now = FieldValue.serverTimestamp();
  await Promise.all([
    firestore.doc(`organizations/${orgId}/members/${uid}`).set({ active, updatedAt: now }, { merge: true }),
    firestore.doc(`users/${uid}/organizations/${orgId}`).set({ active, updatedAt: now }, { merge: true })
  ]);

  return { uid, active };
});

export const resetUserPassword = onCall(async request => {
  const { uid, password, orgId } = request.data || {};
  if (!uid || !password || String(password).length < 6) throw new HttpsError('invalid-argument', 'uid and a password of at least 6 characters are required.');
  await assertOrgAdmin(request.auth?.uid, orgId);
  await auth.updateUser(uid, { password });
  return { uid };
});

export const deleteUserAccount = onCall(async request => {
  const { orgId, uid } = request.data || {};
  if (!uid) throw new HttpsError('invalid-argument', 'uid is required.');
  await assertOrgAdmin(request.auth?.uid, orgId);
  if (uid === request.auth?.uid) throw new HttpsError('failed-precondition', 'You cannot remove yourself from the organization.');

  const userSnapshot = await firestore.doc(`users/${uid}`).get();
  const currentUserData = userSnapshot.data() || {};
  const nextOrgIds = (currentUserData.orgIds || []).filter((id: string) => id !== orgId);
  const userUpdate: Record<string, unknown> = {
    orgIds: FieldValue.arrayRemove(orgId),
    updatedAt: FieldValue.serverTimestamp()
  };
  if (currentUserData.activeOrgId === orgId) {
    userUpdate.activeOrgId = nextOrgIds[0] || FieldValue.delete();
  }

  const batch = firestore.batch();
  batch.delete(firestore.doc(`organizations/${orgId}/members/${uid}`));
  batch.delete(firestore.doc(`users/${uid}/organizations/${orgId}`));
  batch.set(firestore.doc(`users/${uid}`), userUpdate, { merge: true });
  await batch.commit();

  return { uid };
});
