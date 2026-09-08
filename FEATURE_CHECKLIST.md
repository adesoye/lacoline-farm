# Feature Checklist

## SaaS / Multi-Tenant Core
- [x] Organization workspace model
- [x] User-to-organization memberships
- [x] Organization-specific roles
- [x] Active organization switching
- [x] Organization-scoped Firestore collections
- [x] Firestore rules that isolate organization data
- [x] Cloud Function to create organizations
- [x] Cloud Functions to create/manage users inside an organization
- [x] Seed script creates first organization + first admin

## Firebase
- [x] Firebase Authentication login
- [x] Firestore user profile loading
- [x] Firestore organization membership loading
- [x] No localStorage data layer for app records
- [x] No client-side password storage
- [x] Clear no-organization error instead of infinite loading

## Modules
- [x] Dashboard
- [x] Pig Inventory
- [x] Poultry (batches, eggs, feed, mortality & health)
- [x] Fishery (ponds, stocking, feed, harvests, health)
- [x] Cattle (herd, milk, weights, health/events, feed)
- [x] Goats (herd, kidding, milk, weights, health/events, feed)
- [x] Daily Feed Log
- [x] Feed Stock & Purchases
- [x] Weight Records
- [x] Expenses & Income
- [x] Monthly Inputs
- [x] Financial Statements
- [x] Reports
- [x] User Management
- [x] Organization Management
