"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserAccount = exports.resetUserPassword = exports.setUserActive = exports.updateUserRole = exports.createUser = exports.createOrganization = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
admin.initializeApp();
const auth = admin.auth();
const firestore = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const roles = ['admin', 'manager', 'staff', 'viewer'];
function slugify(value) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
        .slice(0, 64) || `org-${Date.now()}`;
}
function assertRole(role) {
    if (!roles.includes(role))
        throw new https_1.HttpsError('invalid-argument', 'Invalid role.');
}
async function assertOrgAdmin(uid, orgId) {
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Sign in required.');
    if (!orgId)
        throw new https_1.HttpsError('invalid-argument', 'orgId is required.');
    const [orgSnapshot, memberSnapshot] = await Promise.all([
        firestore.doc(`organizations/${orgId}`).get(),
        firestore.doc(`organizations/${orgId}/members/${uid}`).get()
    ]);
    if (!orgSnapshot.exists)
        throw new https_1.HttpsError('not-found', 'Organization not found.');
    const org = orgSnapshot.data();
    const member = memberSnapshot.data();
    if (!memberSnapshot.exists || member?.role !== 'admin' || member?.active !== true || org?.status === 'suspended') {
        throw new https_1.HttpsError('permission-denied', 'Organization admin access is required.');
    }
    return { org: { id: orgSnapshot.id, ...orgSnapshot.data() }, member };
}
async function upsertUserOrgMembership(params) {
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
exports.createOrganization = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Sign in required.');
    const { name, slug } = request.data || {};
    if (!name || String(name).trim().length < 2)
        throw new https_1.HttpsError('invalid-argument', 'Organization name is required.');
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
exports.createUser = (0, https_1.onCall)(async (request) => {
    const { orgId, email, password, fullName, role } = request.data || {};
    assertRole(role);
    if (!email || !fullName)
        throw new https_1.HttpsError('invalid-argument', 'Email and fullName are required.');
    await assertOrgAdmin(request.auth?.uid, orgId);
    const orgSnapshot = await firestore.doc(`organizations/${orgId}`).get();
    const orgName = orgSnapshot.data()?.name || 'Organization';
    let user;
    try {
        user = await auth.getUserByEmail(String(email));
        await auth.updateUser(user.uid, { displayName: fullName, disabled: false });
    }
    catch {
        if (!password || String(password).length < 6) {
            throw new https_1.HttpsError('invalid-argument', 'A password of at least 6 characters is required for new users.');
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
exports.updateUserRole = (0, https_1.onCall)(async (request) => {
    const { orgId, uid, role } = request.data || {};
    assertRole(role);
    if (!uid)
        throw new https_1.HttpsError('invalid-argument', 'uid is required.');
    await assertOrgAdmin(request.auth?.uid, orgId);
    const now = FieldValue.serverTimestamp();
    await Promise.all([
        firestore.doc(`organizations/${orgId}/members/${uid}`).set({ role, updatedAt: now }, { merge: true }),
        firestore.doc(`users/${uid}/organizations/${orgId}`).set({ role, updatedAt: now }, { merge: true })
    ]);
    return { uid, role };
});
exports.setUserActive = (0, https_1.onCall)(async (request) => {
    const { orgId, uid, active } = request.data || {};
    if (!uid || typeof active !== 'boolean')
        throw new https_1.HttpsError('invalid-argument', 'uid and active are required.');
    await assertOrgAdmin(request.auth?.uid, orgId);
    if (uid === request.auth?.uid && active === false)
        throw new https_1.HttpsError('failed-precondition', 'You cannot disable your own organization membership.');
    const now = FieldValue.serverTimestamp();
    await Promise.all([
        firestore.doc(`organizations/${orgId}/members/${uid}`).set({ active, updatedAt: now }, { merge: true }),
        firestore.doc(`users/${uid}/organizations/${orgId}`).set({ active, updatedAt: now }, { merge: true })
    ]);
    return { uid, active };
});
exports.resetUserPassword = (0, https_1.onCall)(async (request) => {
    const { uid, password, orgId } = request.data || {};
    if (!uid || !password || String(password).length < 6)
        throw new https_1.HttpsError('invalid-argument', 'uid and a password of at least 6 characters are required.');
    await assertOrgAdmin(request.auth?.uid, orgId);
    await auth.updateUser(uid, { password });
    return { uid };
});
exports.deleteUserAccount = (0, https_1.onCall)(async (request) => {
    const { orgId, uid } = request.data || {};
    if (!uid)
        throw new https_1.HttpsError('invalid-argument', 'uid is required.');
    await assertOrgAdmin(request.auth?.uid, orgId);
    if (uid === request.auth?.uid)
        throw new https_1.HttpsError('failed-precondition', 'You cannot remove yourself from the organization.');
    const userSnapshot = await firestore.doc(`users/${uid}`).get();
    const currentUserData = userSnapshot.data() || {};
    const nextOrgIds = (currentUserData.orgIds || []).filter((id) => id !== orgId);
    const userUpdate = {
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
