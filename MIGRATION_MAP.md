# SaaS Migration Map

The original pasted app used one local browser database. The new SaaS version stores data per organization.

## Old local collections → New SaaS Firestore paths

```txt
users                     -> organizations/{orgId}/members/{uid}
pigs                      -> organizations/{orgId}/pigs/{id}
events                    -> organizations/{orgId}/pigEvents/{id}
feedLogs                  -> organizations/{orgId}/feedLogs/{id}
purchases                 -> organizations/{orgId}/feedPurchases/{id}
feedReorderLevels         -> organizations/{orgId}/feedSettings/reorderLevels
weights                   -> organizations/{orgId}/weightRecords/{id}
transactions              -> organizations/{orgId}/transactions/{id}
monthlyInputs             -> organizations/{orgId}/monthlyInputs/{id}
liabilities               -> organizations/{orgId}/liabilities/{id}
```

## New SaaS-only collections

```txt
users/{uid}
users/{uid}/organizations/{orgId}
organizations/{orgId}
organizations/{orgId}/members/{uid}
```

## Key rule

All operational farm records are read and written only through the active organization ID.
