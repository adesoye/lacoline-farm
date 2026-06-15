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

const managerAssignableRoles: Role[] = [
  'staff',
  'viewer'
];

function isManagerAssignableRole(role: Role) {
  return managerAssignableRoles.includes(role);
}

async function assertOrgUserManager(
  uid: string | undefined,
  orgId: string | undefined
) {
  if (!uid) {
    throw new HttpsError(
      'unauthenticated',
      'Sign in required.'
    );
  }

  if (!orgId) {
    throw new HttpsError(
      'invalid-argument',
      'orgId is required.'
    );
  }

  const [orgSnapshot, memberSnapshot] = await Promise.all([
    firestore.doc(`organizations/${orgId}`).get(),
    firestore
      .doc(`organizations/${orgId}/members/${uid}`)
      .get()
  ]);

  if (!orgSnapshot.exists) {
    throw new HttpsError(
      'not-found',
      'Organization not found.'
    );
  }

  const org = orgSnapshot.data();
  const member = memberSnapshot.data();
  const callerRole = member?.role as Role | undefined;

  if (
    !memberSnapshot.exists ||
    member?.active !== true ||
    !callerRole ||
    !['admin', 'manager'].includes(callerRole) ||
    org?.status === 'suspended'
  ) {
    throw new HttpsError(
      'permission-denied',
      'Organization admin or manager access is required.'
    );
  }

  return {
    org: {
      id: orgSnapshot.id,
      ...org
    },
    member: {
      ...member,
      role: callerRole
    }
  };
}

function assertRoleCanBeAssigned(
  callerRole: Role,
  requestedRole: Role
) {
  if (
    callerRole === 'manager' &&
    !isManagerAssignableRole(requestedRole)
  ) {
    throw new HttpsError(
      'permission-denied',
      'Managers can assign only staff or viewer roles.'
    );
  }
}

async function getTargetMembership(
  orgId: string,
  uid: string
) {
  const snapshot = await firestore
    .doc(`organizations/${orgId}/members/${uid}`)
    .get();

  if (!snapshot.exists) {
    throw new HttpsError(
      'not-found',
      'Organization member not found.'
    );
  }

  const data = snapshot.data();
  const role = data?.role as Role;

  assertRole(role);

  return {
    snapshot,
    data,
    role
  };
}

function assertCanManageTarget(params: {
  callerUid: string;
  callerRole: Role;
  targetUid: string;
  targetRole: Role;
  ownerUid?: string;
}) {
  const {
    callerUid,
    callerRole,
    targetUid,
    targetRole,
    ownerUid
  } = params;

  if (callerUid === targetUid) {
    throw new HttpsError(
      'failed-precondition',
      'You cannot modify your own organization membership here.'
    );
  }

  if (targetUid === ownerUid) {
    throw new HttpsError(
      'permission-denied',
      'The organization owner cannot be modified from this page.'
    );
  }

  if (
    callerRole === 'manager' &&
    !isManagerAssignableRole(targetRole)
  ) {
    throw new HttpsError(
      'permission-denied',
      'Managers can manage only staff and viewer accounts.'
    );
  }
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
  const callerUid = request.auth?.uid;

  const {
    orgId,
    email,
    password,
    fullName,
    role
  } = request.data || {};

  assertRole(role);

  if (!email || !fullName) {
    throw new HttpsError(
      'invalid-argument',
      'Email and fullName are required.'
    );
  }

  const access = await assertOrgUserManager(
    callerUid,
    orgId
  );

  const callerRole = access.member.role as Role;

  assertRoleCanBeAssigned(callerRole, role);

  const normalizedEmail = String(email)
    .trim()
    .toLowerCase();

  const normalizedName = String(fullName).trim();

  const orgName =
    access.org.name || 'Organization';

  let user: admin.auth.UserRecord;
  let wasCreated = false;

  try {
    user = await auth.getUserByEmail(normalizedEmail);

    if (user.disabled) {
      throw new HttpsError(
        'failed-precondition',
        'This Firebase account has been globally disabled. A platform administrator must enable it.'
      );
    }
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    if (
      !password ||
      String(password).length < 6
    ) {
      throw new HttpsError(
        'invalid-argument',
        'A password of at least 6 characters is required for new users.'
      );
    }

    user = await auth.createUser({
      email: normalizedEmail,
      password: String(password),
      displayName: normalizedName,
      disabled: false
    });

    wasCreated = true;
  }

  const existingMembership = await firestore
    .doc(`organizations/${orgId}/members/${user.uid}`)
    .get();

  if (existingMembership.exists) {
    throw new HttpsError(
      'already-exists',
      'This user already belongs to the organization.'
    );
  }

  await upsertUserOrgMembership({
    uid: user.uid,
    email: normalizedEmail,
    fullName: normalizedName,
    orgId,
    orgName,
    role,
    active: true
  });

  return {
    uid: user.uid,
    wasCreated,
    role
  };
});

export const updateUserRole = onCall(async request => {
  const callerUid = request.auth?.uid;

  const {
    orgId,
    uid,
    role
  } = request.data || {};

  assertRole(role);

  if (!uid) {
    throw new HttpsError(
      'invalid-argument',
      'uid is required.'
    );
  }

  const access = await assertOrgUserManager(
    callerUid,
    orgId
  );

  const callerRole = access.member.role as Role;

  const target = await getTargetMembership(
    orgId,
    String(uid)
  );

  assertCanManageTarget({
    callerUid: callerUid!,
    callerRole,
    targetUid: String(uid),
    targetRole: target.role,
    ownerUid: access.org.ownerUid
  });

  assertRoleCanBeAssigned(callerRole, role);

  if (
    String(uid) === access.org.ownerUid &&
    role !== 'admin'
  ) {
    throw new HttpsError(
      'failed-precondition',
      'The organization owner must remain an administrator.'
    );
  }

  const now = FieldValue.serverTimestamp();

  await Promise.all([
    firestore
      .doc(`organizations/${orgId}/members/${uid}`)
      .set(
        {
          role,
          updatedAt: now,
          updatedBy: callerUid
        },
        { merge: true }
      ),

    firestore
      .doc(`users/${uid}/organizations/${orgId}`)
      .set(
        {
          role,
          updatedAt: now,
          updatedBy: callerUid
        },
        { merge: true }
      )
  ]);

  return {
    uid,
    role
  };
});

export const setUserActive = onCall(async request => {
  const callerUid = request.auth?.uid;

  const {
    orgId,
    uid,
    active
  } = request.data || {};

  if (!uid || typeof active !== 'boolean') {
    throw new HttpsError(
      'invalid-argument',
      'uid and active are required.'
    );
  }

  const access = await assertOrgUserManager(
    callerUid,
    orgId
  );

  const callerRole = access.member.role as Role;

  const target = await getTargetMembership(
    orgId,
    String(uid)
  );

  assertCanManageTarget({
    callerUid: callerUid!,
    callerRole,
    targetUid: String(uid),
    targetRole: target.role,
    ownerUid: access.org.ownerUid
  });

  if (
    String(uid) === access.org.ownerUid &&
    active === false
  ) {
    throw new HttpsError(
      'failed-precondition',
      'The organization owner cannot be disabled.'
    );
  }

  const now = FieldValue.serverTimestamp();

  await Promise.all([
    firestore
      .doc(`organizations/${orgId}/members/${uid}`)
      .set(
        {
          active,
          updatedAt: now,
          updatedBy: callerUid
        },
        { merge: true }
      ),

    firestore
      .doc(`users/${uid}/organizations/${orgId}`)
      .set(
        {
          active,
          updatedAt: now,
          updatedBy: callerUid
        },
        { merge: true }
      )
  ]);

  return {
    uid,
    active
  };
});

export const deleteUserAccount = onCall(async request => {
  const callerUid = request.auth?.uid;

  const {
    orgId,
    uid
  } = request.data || {};

  if (!uid) {
    throw new HttpsError(
      'invalid-argument',
      'uid is required.'
    );
  }

  const access = await assertOrgUserManager(
    callerUid,
    orgId
  );

  const callerRole = access.member.role as Role;

  const target = await getTargetMembership(
    orgId,
    String(uid)
  );

  assertCanManageTarget({
    callerUid: callerUid!,
    callerRole,
    targetUid: String(uid),
    targetRole: target.role,
    ownerUid: access.org.ownerUid
  });

  const userRef = firestore.doc(`users/${uid}`);
  const userSnapshot = await userRef.get();
  const userData = userSnapshot.data() || {};

  const currentOrgIds = Array.isArray(userData.orgIds)
    ? userData.orgIds
    : [];

  const nextOrgIds = currentOrgIds.filter(
    (id: string) => id !== orgId
  );

  const userUpdate: Record<string, unknown> = {
    orgIds: FieldValue.arrayRemove(orgId),
    updatedAt: FieldValue.serverTimestamp()
  };

  if (userData.activeOrgId === orgId) {
    userUpdate.activeOrgId =
      nextOrgIds[0] || FieldValue.delete();
  }

  const batch = firestore.batch();

  batch.delete(
    firestore.doc(
      `organizations/${orgId}/members/${uid}`
    )
  );

  batch.delete(
    firestore.doc(
      `users/${uid}/organizations/${orgId}`
    )
  );

  batch.set(
    userRef,
    userUpdate,
    { merge: true }
  );

  await batch.commit();

  return {
    uid,
    removedFromOrganization: true,
    accountDeleted: false
  };
});
