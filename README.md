# Lacoline Farm Manager — SaaS Firebase Next.js App

This project is now structured as a multi-tenant SaaS farm-management app. Different farms, companies, or organizations can use the same application while keeping their users, pigs, feed records, finance, statistics, and reports isolated by organization workspace.

## What changed in SaaS mode

- Every user signs in with Firebase Authentication.
- Every user must belong to at least one organization workspace.
- Each organization has its own isolated Firestore subcollections.
- Roles are organization-specific, not global.
- One person can belong to multiple organizations and switch workspace from the sidebar.
- Farm data is no longer stored in top-level collections like `pigs` or `feedLogs`.
- Admin user creation and organization management use Firebase Cloud Functions.

## Multi-tenant Firestore structure

```txt
users/{uid}
  activeOrgId
  orgIds[]
  organizations/{orgId}
    orgName
    role
    active

organizations/{orgId}
  name
  slug
  plan
  status
  ownerUid

organizations/{orgId}/members/{uid}
organizations/{orgId}/pigs/{pigId}
organizations/{orgId}/pigEvents/{eventId}
organizations/{orgId}/feedLogs/{feedLogId}
organizations/{orgId}/feedPurchases/{purchaseId}
organizations/{orgId}/feedSettings/reorderLevels
organizations/{orgId}/weightRecords/{weightRecordId}
organizations/{orgId}/transactions/{transactionId}
organizations/{orgId}/monthlyInputs/{monthlyInputId}
organizations/{orgId}/liabilities/{liabilityId}
```

This is the key SaaS isolation rule: **all farm records live under `organizations/{orgId}`**.

## Roles

| Role | Access |
|---|---|
| Admin | Full access within their organization, users, finance, delete records, org settings |
| Manager | Farm modules, finance, reports, delete records, no user management |
| Staff | Farm modules and reports, no finance/user management |
| Viewer | Read-only access to allowed pages |

Roles are stored in:

```txt
organizations/{orgId}/members/{uid}
users/{uid}/organizations/{orgId}
```

## Folder structure

```txt
app/
  (auth)/login/
  (protected)/dashboard/
  (protected)/pigs/
  (protected)/feed/
  (protected)/feed-stock/
  (protected)/weights/
  (protected)/finance/
  (protected)/monthly-inputs/
  (protected)/financial-statements/
  (protected)/reports/
  (protected)/users/
  (protected)/organizations/
components/
  layout/
  ui/
features/
  dashboard/
  pigs/
  feed/
  feed-stock/
  weights/
  finance/
  monthly-inputs/
  financial-statements/
  reports/
  users/
  organizations/
lib/
  domain/
  firebase/
functions/
firebase/
scripts/
legacy/
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file:

```bash
cp .env.example .env.local
```

3. Add your Firebase web app config to `.env.local`.

4. Deploy Firestore rules:

```bash
npm run deploy:rules
```

5. Seed your first SaaS organization and admin user:

```bash
# Option A: set GOOGLE_APPLICATION_CREDENTIALS
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccount.json
npm run seed:admin

# Option B: use gcloud application default credentials
# gcloud auth application-default login
npm run seed:admin
```

You can customize the first organization/admin with:

```bash
SEED_ORG_NAME="Lacoline Farm"
SEED_ADMIN_EMAIL="admin@lacolinefarm.com"
SEED_ADMIN_PASSWORD="admin123"
SEED_ADMIN_NAME="Administrator"
```

6. Deploy Firebase Functions:

```bash
cd functions
npm install
npm run build
cd ..
npm run deploy:functions
```

7. Run the Next app:

```bash
npm run dev
```

## SaaS behavior

After sign-in, the app loads:

1. `users/{uid}`
2. the selected `activeOrgId`
3. `organizations/{activeOrgId}`
4. `organizations/{activeOrgId}/members/{uid}`
5. farm records under that organization only

If a user is authenticated but has no organization membership, the protected route shows a clear “No active organization workspace” message instead of hanging on the loading screen.

## Important Firebase notes

- Client code never stores passwords in Firestore.
- Farm records are organization-scoped.
- Firestore rules prevent one organization from reading/writing another organization’s data.
- Cloud Functions handle user creation, organization creation, role changes, disabling members, and removing members from an organization.
- Removing a user from an organization does not necessarily delete their global Firebase Auth account, because the same user may belong to another organization.

## Modules included

- Dashboard
- Pig Inventory
- Daily Feed Log
- Feed Stock & Purchases
- Weight Records
- Expenses & Income
- Monthly Inputs
- Financial Statements
- Reports
- User Management
- Organizations / SaaS Workspace Management
- Firebase Auth / Firestore SaaS RBAC
