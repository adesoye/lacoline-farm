import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load env files from the project root.
// .env loads first, then .env.local overrides it if present.
const rootDir = process.cwd();

const envPath = path.join(rootDir, '.env');
const envLocalPath = path.join(rootDir, '.env.local');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

import * as admin from 'firebase-admin';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const email = process.env.SEED_ADMIN_EMAIL || 'admin@lacolinefarm.com';
const password = process.env.SEED_ADMIN_PASSWORD || 'admin123';
const fullName = process.env.SEED_ADMIN_NAME || 'Administrator';
const orgName = process.env.SEED_ORG_NAME || 'Lacoline Farm';

if (!projectId) {
  throw new Error('Set FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local');
}

admin.initializeApp({ projectId });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 64) || 'lacoline-farm';
}

async function main() {
  let user: admin.auth.UserRecord;
  try {
    user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password, displayName: fullName, disabled: false });
  } catch {
    user = await admin.auth().createUser({ email, password, displayName: fullName, disabled: false });
  }

  const orgRef = db.collection('organizations').doc();
  const now = FieldValue.serverTimestamp();

  await orgRef.set({
    name: orgName,
    slug: slugify(orgName),
    plan: 'starter',
    status: 'trialing',
    ownerUid: user.uid,
    createdAt: now,
    updatedAt: now
  });

  await db.doc(`users/${user.uid}`).set({
    uid: user.uid,
    email,
    fullName,
    active: true,
    activeOrgId: orgRef.id,
    orgIds: FieldValue.arrayUnion(orgRef.id),
    createdAt: now,
    updatedAt: now
  }, { merge: true });

  const membership = {
    uid: user.uid,
    email,
    fullName,
    role: 'admin',
    active: true,
    createdAt: now,
    updatedAt: now
  };

  await db.doc(`organizations/${orgRef.id}/members/${user.uid}`).set(membership, { merge: true });
  await db.doc(`users/${user.uid}/organizations/${orgRef.id}`).set({
    ...membership,
    orgId: orgRef.id,
    orgName
  }, { merge: true });

  await admin.auth().setCustomUserClaims(user.uid, { active: true });

  console.log(`Seeded SaaS organization: ${orgName} (${orgRef.id})`);
  console.log(`Seeded admin: ${email} / ${password}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
