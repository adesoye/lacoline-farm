import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import {
  cert,
  getApps,
  initializeApp,
  applicationDefault
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const rootDir = process.cwd();

const envPath = path.join(rootDir, '.env');
const envLocalPath = path.join(rootDir, '.env.local');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  throw new Error(
    'Set FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env or .env.local'
  );
}

function resolveCredential() {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (serviceAccountPath) {
    const absolutePath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.join(rootDir, serviceAccountPath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `GOOGLE_APPLICATION_CREDENTIALS was set, but the file was not found: ${absolutePath}`
      );
    }

    const serviceAccount = JSON.parse(
      fs.readFileSync(absolutePath, 'utf8')
    );

    return cert(serviceAccount);
  }

  return applicationDefault();
}

if (!getApps().length) {
  initializeApp({
    credential: resolveCredential(),
    projectId
  });
}

const auth = getAuth();
const db = getFirestore();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@lacoline.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
  const adminName = process.env.SEED_ADMIN_NAME || 'System Administrator';
  const orgName = process.env.SEED_ORG_NAME || 'Lacoline Farm';

  let user;

  try {
    user = await auth.getUserByEmail(adminEmail);
    console.log(`Admin auth user already exists: ${adminEmail}`);
  } catch {
    user = await auth.createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: adminName,
      emailVerified: true
    });

    console.log(`Created admin auth user: ${adminEmail}`);
  }

  const orgRef = db.collection('organizations').doc();

  await orgRef.set({
    name: orgName,
    slug: orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    ownerUid: user.uid,
    active: true,
    plan: 'starter',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  await db.collection('users').doc(user.uid).set(
    {
      uid: user.uid,
      email: adminEmail,
      fullName: adminName,
      active: true,
      defaultOrgId: orgRef.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await orgRef.collection('members').doc(user.uid).set(
    {
      uid: user.uid,
      email: adminEmail,
      fullName: adminName,
      role: 'admin',
      active: true,
      joinedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  console.log('');
  console.log('Seed complete.');
  console.log(`Admin email: ${adminEmail}`);
  console.log(`Admin password: ${adminPassword}`);
  console.log(`Organization ID: ${orgRef.id}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});