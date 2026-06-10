# SaaS Architecture

## Core idea

The application is multi-tenant. A tenant is an organization/farm/company. Users authenticate globally with Firebase Auth, but their permissions and records are scoped to an organization.

## Data isolation

All farm data lives under:

```txt
organizations/{orgId}/{moduleCollection}/{docId}
```

The active organization ID comes from:

```txt
users/{uid}.activeOrgId
```

The signed-in user's role for that organization comes from:

```txt
organizations/{orgId}/members/{uid}.role
```

## Why this is safer than top-level collections

Bad for SaaS:

```txt
pigs/{pigId}
feedLogs/{feedLogId}
transactions/{transactionId}
```

Good for SaaS:

```txt
organizations/{orgId}/pigs/{pigId}
organizations/{orgId}/feedLogs/{feedLogId}
organizations/{orgId}/transactions/{transactionId}
```

With this structure, Firestore rules can check membership before allowing reads/writes.

## User membership model

Global user profile:

```txt
users/{uid}
```

Organization copy for fast switching:

```txt
users/{uid}/organizations/{orgId}
```

Organization member record used by security rules:

```txt
organizations/{orgId}/members/{uid}
```

## Roles are per organization

The same Firebase Auth user can be:

- Admin in Organization A
- Viewer in Organization B
- Staff in Organization C

This is why roles should not be treated as one global role on `users/{uid}`.
