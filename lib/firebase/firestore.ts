'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type CollectionReference,
  type DocumentData
} from 'firebase/firestore';
import { db } from './client';
import { useAuth } from './auth-context';
import type {
  FeedLog,
  FeedPurchase,
  FeedSettings,
  Liability,
  LitterRecord,
  MonthlyInput,
  OrganizationMembership,
  Pig,
  PigEvent,
  Transaction,
  UserProfile,
  WeightRecord,
  FinanceSettings,
  PoultryBatch,
  EggLog,
  PoultryFeedLog,
  PoultryHealthLog,
  FishPond,
  FishStocking,
  FishFeedLog,
  FishHarvest,
  FishHealthLog,
  Cattle,
  Goat,
  MilkLog,
  AnimalWeight,
  HerdEvent,
  HerdFeedLog,
  KiddingLog,
} from '@/lib/domain/types';

export const collectionNames = {
  pigs: 'pigs',
  pigEvents: 'pigEvents',
  litters: 'litters',
  feedLogs: 'feedLogs',
  feedPurchases: 'feedPurchases',
  feedSettings: 'feedSettings',
  weightRecords: 'weightRecords',
  transactions: 'transactions',
  monthlyInputs: 'monthlyInputs',
  liabilities: 'liabilities',
  members: 'members',
  settings: 'settings',
  poultryBatches: 'poultryBatches',
  eggLogs: 'eggLogs',
  poultryFeedLogs: 'poultryFeedLogs',
  poultryHealth: 'poultryHealth',
  fishPonds: 'fishPonds',
  fishStockings: 'fishStockings',
  fishFeedLogs: 'fishFeedLogs',
  fishHarvests: 'fishHarvests',
  fishHealth: 'fishHealth',
  cattle: 'cattle',
  cattleMilkLogs: 'cattleMilkLogs',
  cattleWeights: 'cattleWeights',
  cattleEvents: 'cattleEvents',
  cattleFeedLogs: 'cattleFeedLogs',
  goats: 'goats',
  goatKidding: 'goatKidding',
  goatMilkLogs: 'goatMilkLogs',
  goatWeights: 'goatWeights',
  goatEvents: 'goatEvents',
  goatFeedLogs: 'goatFeedLogs',
} as const;

type OrderDirection = 'asc' | 'desc';

export function orgCollection(orgId: string, name: string): CollectionReference<DocumentData> {
  return collection(db, 'organizations', orgId, name);
}

export function orgDocument(orgId: string, name: string, id: string) {
  return doc(db, 'organizations', orgId, name, id);
}

export function useOrgCollectionData<T extends { id: string }>(
  orgId: string | undefined | null,
  name: string,
  orderField = 'date',
  direction: OrderDirection = 'desc'
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(Boolean(orgId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) {
      setItems([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);
    const q = query(orgCollection(orgId, name), orderBy(orderField, direction));
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        setItems(snapshot.docs.map(document => ({ id: document.id, ...document.data() } as T)));
        setLoading(false);
      },
      err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [direction, name, orderField, orgId]);

  return { items, loading, error };
}

export function useOrgDocumentData<T>(orgId: string | undefined | null, path: string, id: string) {
  const [item, setItem] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(orgId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) {
      setItem(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);
    const unsubscribe = onSnapshot(
      orgDocument(orgId, path, id),
      snapshot => {
        setItem(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null);
        setLoading(false);
      },
      err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [id, orgId, path]);

  return { item, loading, error };
}

export function useUserOrganizations() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [items, setItems] = useState<OrganizationMembership[]>([]);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const q = query(collection(db, 'users', uid, 'organizations'), orderBy('orgName', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        setItems(snapshot.docs.map(document => ({ id: document.id, orgId: document.id, ...document.data() } as OrganizationMembership)));
        setLoading(false);
      },
      err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [uid]);

  return { items, loading, error };
}

export function useFarmData() {
  const { profile } = useAuth();
  const orgId = profile?.activeOrgId;

  const pigs = useOrgCollectionData<Pig>(orgId, collectionNames.pigs, 'createdAt', 'desc');
  const pigEvents = useOrgCollectionData<PigEvent>(orgId, collectionNames.pigEvents, 'date', 'desc');
  const feedLogs = useOrgCollectionData<FeedLog>(orgId, collectionNames.feedLogs, 'date', 'desc');
  const feedPurchases = useOrgCollectionData<FeedPurchase>(orgId, collectionNames.feedPurchases, 'date', 'desc');
  const weightRecords = useOrgCollectionData<WeightRecord>(orgId, collectionNames.weightRecords, 'date', 'desc');
  const transactions = useOrgCollectionData<Transaction>(orgId, collectionNames.transactions, 'date', 'desc');
  const litters = useOrgCollectionData<LitterRecord>(orgId, collectionNames.litters, 'date', 'desc');
  const monthlyInputs = useOrgCollectionData<MonthlyInput>(orgId, collectionNames.monthlyInputs, 'date', 'desc');
  const liabilities = useOrgCollectionData<Liability>(orgId, collectionNames.liabilities, 'date', 'desc');
  const users = useOrgCollectionData<OrganizationMembership>(orgId, collectionNames.members, 'fullName', 'asc');
  const settings = useOrgDocumentData<FeedSettings>(orgId, collectionNames.feedSettings, 'reorderLevels');
  const financeSettings = useOrgDocumentData<FinanceSettings>(orgId, collectionNames.settings, 'finance');

  return useMemo(() => ({
    organizationId: orgId,
    data: {
      pigs: pigs.items,
      pigEvents: pigEvents.items,
      litters: litters.items,
      feedLogs: feedLogs.items,
      feedPurchases: feedPurchases.items,
      weightRecords: weightRecords.items,
      transactions: transactions.items,
      monthlyInputs: monthlyInputs.items,
      liabilities: liabilities.items,
      users: users.items.map(user => ({
        uid: user.uid || user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        active: user.active,
        activeOrgId: orgId || '',
        activeOrgName: profile?.activeOrgName || ''
      })),
      feedSettings: settings.item,
      financeSettings: financeSettings.item
    },
    loading: [pigs, pigEvents, feedLogs, feedPurchases, weightRecords, transactions, monthlyInputs, liabilities, users, settings, financeSettings].some(item => item.loading),
    errors: [pigs, pigEvents, feedLogs, feedPurchases, weightRecords, transactions, monthlyInputs, liabilities, users, settings, financeSettings].map(item => item.error).filter(Boolean) as string[]
  }), [feedLogs, feedPurchases, liabilities, monthlyInputs, orgId, pigEvents, pigs, profile?.activeOrgName, settings, financeSettings, transactions, users, weightRecords]);
}

function assertOrgId(orgId: string | undefined | null): asserts orgId is string {
  if (!orgId) throw new Error('No active organization selected.');
}

export async function addRecord<T extends DocumentData>(orgId: string | undefined | null, collectionName: string, data: T, userId?: string) {
  assertOrgId(orgId);
  const payload = { ...data, createdAt: serverTimestamp(), ...(userId ? { createdBy: userId } : {}) };
  return addDoc(orgCollection(orgId, collectionName), payload);
}

export async function setRecord<T extends DocumentData>(orgId: string | undefined | null, collectionName: string, id: string, data: T, userId?: string) {
  assertOrgId(orgId);
  return setDoc(orgDocument(orgId, collectionName, id), { ...data, updatedAt: serverTimestamp(), ...(userId ? { updatedBy: userId } : {}) }, { merge: true });
}

export async function updateRecord(orgId: string | undefined | null, collectionName: string, id: string, data: DocumentData, userId?: string) {
  assertOrgId(orgId);
  return updateDoc(orgDocument(orgId, collectionName, id), { ...data, updatedAt: serverTimestamp(), ...(userId ? { updatedBy: userId } : {}) });
}

export async function deleteRecord(orgId: string | undefined | null, collectionName: string, id: string) {
  assertOrgId(orgId);
  return deleteDoc(orgDocument(orgId, collectionName, id));
}

/**
 * Creates a farm record and, optionally, a linked finance transaction in one
 * atomic batch. The transaction is only written when `transaction` is provided
 * (callers pass null when the user cannot manage finance, or there's no amount).
 * Returns the new record id.
 */
export async function addRecordWithTransaction<T extends DocumentData>(
  orgId: string | undefined | null,
  collectionName: string,
  record: T,
  transaction: Omit<Transaction, 'id'> | null,
  userId?: string
) {
  assertOrgId(orgId);
  const batch = writeBatch(db);
  const recordRef = doc(orgCollection(orgId, collectionName));
  const stamp = { createdAt: serverTimestamp(), ...(userId ? { createdBy: userId } : {}) };

  if (transaction) {
    const txnRef = doc(orgCollection(orgId, collectionNames.transactions));
    batch.set(txnRef, { ...transaction, ...stamp });
    batch.set(recordRef, { ...record, transactionId: txnRef.id, ...stamp });
  } else {
    batch.set(recordRef, { ...record, ...stamp });
  }

  await batch.commit();
  return recordRef.id;
}

/**
 * Updates a farm record and keeps its linked finance transaction in sync:
 * updates the existing transaction, creates one if newly needed, or deletes it
 * if no longer applicable. Finance writes only happen when canWriteFinance is
 * true (staff without finance access simply update the record and leave any
 * existing transaction untouched). Returns the resulting linked transaction id.
 */
export async function updateRecordWithTransaction<T extends DocumentData>(
  orgId: string | undefined | null,
  collectionName: string,
  id: string,
  record: T,
  existingTransactionId: string | null | undefined,
  transaction: Omit<Transaction, 'id'> | null,
  canWriteFinance: boolean,
  userId?: string
) {
  assertOrgId(orgId);
  const batch = writeBatch(db);
  const recordRef = orgDocument(orgId, collectionName, id);
  const stamp = { updatedAt: serverTimestamp(), ...(userId ? { updatedBy: userId } : {}) };
  let linkedId: string | null = existingTransactionId ?? null;

  if (canWriteFinance) {
    if (existingTransactionId && transaction) {
      batch.update(orgDocument(orgId, collectionNames.transactions, existingTransactionId), { ...transaction, ...stamp });
    } else if (existingTransactionId && !transaction) {
      batch.delete(orgDocument(orgId, collectionNames.transactions, existingTransactionId));
      linkedId = null;
    } else if (!existingTransactionId && transaction) {
      const txnRef = doc(orgCollection(orgId, collectionNames.transactions));
      batch.set(txnRef, { ...transaction, createdAt: serverTimestamp(), ...(userId ? { createdBy: userId } : {}) });
      linkedId = txnRef.id;
    }
  }

  batch.set(recordRef, { ...record, transactionId: linkedId, ...stamp }, { merge: true });
  await batch.commit();
  return linkedId;
}

export function usePoultryData() {
  const { profile } = useAuth();
  const orgId = profile?.activeOrgId;

  const batches = useOrgCollectionData<PoultryBatch>(orgId, collectionNames.poultryBatches, 'createdAt', 'desc');
  const eggLogs = useOrgCollectionData<EggLog>(orgId, collectionNames.eggLogs, 'date', 'desc');
  const feedLogs = useOrgCollectionData<PoultryFeedLog>(orgId, collectionNames.poultryFeedLogs, 'date', 'desc');
  const healthLogs = useOrgCollectionData<PoultryHealthLog>(orgId, collectionNames.poultryHealth, 'date', 'desc');

  return useMemo(() => ({
    orgId,
    batches: batches.items,
    eggLogs: eggLogs.items,
    feedLogs: feedLogs.items,
    healthLogs: healthLogs.items,
    loading: [batches, eggLogs, feedLogs, healthLogs].some(item => item.loading),
    errors: [batches, eggLogs, feedLogs, healthLogs].map(item => item.error).filter(Boolean) as string[]
  }), [orgId, batches, eggLogs, feedLogs, healthLogs]);
}

export function useFisheryData() {
  const { profile } = useAuth();
  const orgId = profile?.activeOrgId;

  const ponds = useOrgCollectionData<FishPond>(orgId, collectionNames.fishPonds, 'createdAt', 'desc');
  const stockings = useOrgCollectionData<FishStocking>(orgId, collectionNames.fishStockings, 'date', 'desc');
  const feedLogs = useOrgCollectionData<FishFeedLog>(orgId, collectionNames.fishFeedLogs, 'date', 'desc');
  const harvests = useOrgCollectionData<FishHarvest>(orgId, collectionNames.fishHarvests, 'date', 'desc');
  const healthLogs = useOrgCollectionData<FishHealthLog>(orgId, collectionNames.fishHealth, 'date', 'desc');

  return useMemo(() => ({
    orgId,
    ponds: ponds.items,
    stockings: stockings.items,
    feedLogs: feedLogs.items,
    harvests: harvests.items,
    healthLogs: healthLogs.items,
    loading: [ponds, stockings, feedLogs, harvests, healthLogs].some(item => item.loading),
    errors: [ponds, stockings, feedLogs, harvests, healthLogs].map(item => item.error).filter(Boolean) as string[]
  }), [orgId, ponds, stockings, feedLogs, harvests, healthLogs]);
}

export function useCattleData() {
  const { profile } = useAuth();
  const orgId = profile?.activeOrgId;

  const herd = useOrgCollectionData<Cattle>(orgId, collectionNames.cattle, 'createdAt', 'desc');
  const milkLogs = useOrgCollectionData<MilkLog>(orgId, collectionNames.cattleMilkLogs, 'date', 'desc');
  const weights = useOrgCollectionData<AnimalWeight>(orgId, collectionNames.cattleWeights, 'date', 'desc');
  const events = useOrgCollectionData<HerdEvent>(orgId, collectionNames.cattleEvents, 'date', 'desc');
  const feedLogs = useOrgCollectionData<HerdFeedLog>(orgId, collectionNames.cattleFeedLogs, 'date', 'desc');

  return useMemo(() => ({
    orgId,
    herd: herd.items,
    milkLogs: milkLogs.items,
    weights: weights.items,
    events: events.items,
    feedLogs: feedLogs.items,
    loading: [herd, milkLogs, weights, events, feedLogs].some(item => item.loading),
    errors: [herd, milkLogs, weights, events, feedLogs].map(item => item.error).filter(Boolean) as string[]
  }), [orgId, herd, milkLogs, weights, events, feedLogs]);
}

export function useGoatData() {
  const { profile } = useAuth();
  const orgId = profile?.activeOrgId;

  const herd = useOrgCollectionData<Goat>(orgId, collectionNames.goats, 'createdAt', 'desc');
  const kidding = useOrgCollectionData<KiddingLog>(orgId, collectionNames.goatKidding, 'date', 'desc');
  const milkLogs = useOrgCollectionData<MilkLog>(orgId, collectionNames.goatMilkLogs, 'date', 'desc');
  const weights = useOrgCollectionData<AnimalWeight>(orgId, collectionNames.goatWeights, 'date', 'desc');
  const events = useOrgCollectionData<HerdEvent>(orgId, collectionNames.goatEvents, 'date', 'desc');
  const feedLogs = useOrgCollectionData<HerdFeedLog>(orgId, collectionNames.goatFeedLogs, 'date', 'desc');

  return useMemo(() => ({
    orgId,
    herd: herd.items,
    kidding: kidding.items,
    milkLogs: milkLogs.items,
    weights: weights.items,
    events: events.items,
    feedLogs: feedLogs.items,
    loading: [herd, kidding, milkLogs, weights, events, feedLogs].some(item => item.loading),
    errors: [herd, kidding, milkLogs, weights, events, feedLogs].map(item => item.error).filter(Boolean) as string[]
  }), [orgId, herd, kidding, milkLogs, weights, events, feedLogs]);
}

export async function createFeedPurchaseWithExpense(
  orgId: string | undefined | null,
  purchase: Omit<FeedPurchase, 'id'>,
  userId?: string,
  createFinanceEntry = true
) {
  assertOrgId(orgId);
  const batch = writeBatch(db);
  const purchaseRef = doc(orgCollection(orgId, collectionNames.feedPurchases));
  const txnRef = doc(orgCollection(orgId, collectionNames.transactions));

  if (createFinanceEntry) {
    batch.set(txnRef, {
      date: purchase.date,
      type: 'expense',
      category: 'feed',
      description: `Feed purchase — ${purchase.feedType}`,
      amount: purchase.totalCost,
      method: 'transfer',
      ref: purchase.supplier || '',
      createdAt: serverTimestamp(),
      ...(userId ? { createdBy: userId } : {})
    });
  }

  batch.set(purchaseRef, {
    ...purchase,
    ...(createFinanceEntry ? { transactionId: txnRef.id } : {}),
    createdAt: serverTimestamp(),
    ...(userId ? { createdBy: userId } : {})
  });

  await batch.commit();
  return purchaseRef.id;
}

export async function createPigSaleEvent(
  orgId: string | undefined | null,
  event: Omit<PigEvent, 'id'>,
  userId?: string,
  createFinanceEntry = true
) {
  assertOrgId(orgId);
  const batch = writeBatch(db);
  const eventRef = doc(orgCollection(orgId, collectionNames.pigEvents));
  const pigRef = orgDocument(orgId, collectionNames.pigs, event.pigId);

  batch.set(eventRef, { ...event, createdAt: serverTimestamp(), ...(userId ? { createdBy: userId } : {}) });
  if (event.type === 'sold') {
    batch.update(pigRef, { status: 'sold', updatedAt: serverTimestamp(), ...(userId ? { updatedBy: userId } : {}) });
    if (createFinanceEntry && event.salePrice && event.salePrice > 0) {
      const txnRef = doc(orgCollection(orgId, collectionNames.transactions));
      batch.set(txnRef, {
        date: event.date,
        type: 'income',
        category: 'pig-sales',
        description: `Sale of pig, ID: ${event.pigId}`,
        amount: event.salePrice,
        method: 'transfer',
        ref: event.pigId,
        pigId: event.pigId,
        createdAt: serverTimestamp(),
        ...(userId ? { createdBy: userId } : {})
      });
    }
  }
  if (event.type === 'dead') {
    batch.update(pigRef, { status: 'dead', updatedAt: serverTimestamp(), ...(userId ? { updatedBy: userId } : {}) });
  }
  await batch.commit();
}
