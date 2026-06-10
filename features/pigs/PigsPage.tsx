'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  Baby,
  BadgeDollarSign,
  CalendarDays,
  HeartPulse,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import { useAuth } from '@/lib/firebase/auth-context';
import {
  addRecord,
  collectionNames,
  createPigSaleEvent,
  deleteRecord,
  useFarmData,
} from '@/lib/firebase/firestore';
import {
  canDeleteRecords,
  canManageFinance,
  canWriteFarm,
} from '@/lib/rbac';
import type { PigEventType, PigType } from '@/lib/domain/types';
import {
  asNumber,
  asString,
  dateLabel,
  formatMoney,
  today,
} from '@/lib/utils';

import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';

const pigTypes = [
  { value: 'sow', label: 'Sow' },
  { value: 'boar', label: 'Boar' },
  { value: 'piglet', label: 'Piglet' },
  { value: 'grower', label: 'Grower' },
  { value: 'finisher', label: 'Finisher' },
];

const eventTypes = [
  { value: 'sold', label: 'Sold' },
  { value: 'dead', label: 'Died' },
  { value: 'farrowed', label: 'Farrowed' },
  { value: 'treatment', label: 'Treatment' },
];

const sources = [
  { value: 'born', label: 'Born on farm' },
  { value: 'purchased', label: 'Purchased' },
];

function StatCard({
  title,
  value,
  icon,
  helper,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const active = status === 'active';

  return (
    <span
      className={[
        'inline-flex rounded-full px-3 py-1 text-xs font-black capitalize',
        active
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
          : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
      ].join(' ')}
    >
      {status || 'unknown'}
    </span>
  );
}

export function PigsPage() {
  const { data } = useFarmData();
  const { profile } = useAuth();

  const [tab, setTab] = useState<'list' | 'add' | 'event' | 'litters'>('list');
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEventType, setSelectedEventType] = useState<PigEventType>('sold');

  const [notice, setNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [pigToDelete, setPigToDelete] = useState<{
    id: string;
    tag: string;
  } | null>(null);

  const canWrite = canWriteFarm(profile?.role);
  const canDelete = canDeleteRecords(profile?.role);
  const canSeeFinance = canManageFinance(profile?.role);


  const activePigs = useMemo(
    () => data.pigs.filter((item) => item.status === 'active'),
    [data.pigs],
  );

  const filteredPigs = useMemo(() => {
    const search = query.trim().toLowerCase();

    return data.pigs.filter((pig) => {
      const matchesSearch =
        !search ||
        pig.tag?.toLowerCase().includes(search) ||
        pig.name?.toLowerCase().includes(search) ||
        pig.breed?.toLowerCase().includes(search);

      const matchesType = typeFilter === 'all' || pig.type === typeFilter;
      const matchesStatus =
        statusFilter === 'all' || pig.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [data.pigs, query, typeFilter, statusFilter]);

  const totalPurchaseValue = useMemo(
    () =>
      data.pigs.reduce(
        (total, pig) => total + Number(pig.purchasePrice || 0),
        0,
      ),
    [data.pigs],
  );

  function showNotice(type: 'success' | 'error', message: string) {
    setNotice({ type, message });

    window.setTimeout(() => {
      setNotice(null);
    }, 3500);
  }

  function tagExists(tag: string) {
    return data.pigs.some(
      (pig) => pig.tag?.trim().toLowerCase() === tag.trim().toLowerCase(),
    );
  }

  function generateLitterTag(date: string) {
    const cleanDate = date.replaceAll('-', '');
    const countForDate = data.litters?.filter(
      (litter) => litter.farrowDate === date,
    ).length || 0;

    return `LIT-${cleanDate}-${String(countForDate + 1).padStart(3, '0')}`;
  }

  function generatePigletTag(litterTag: string, index: number) {
    return `${litterTag}-P${String(index + 1).padStart(2, '0')}`;
  }

  async function confirmDeletePig() {
    if (!pigToDelete || !canDelete) return;

    setSubmitting(true);

    try {
      await deleteRecord(
        profile?.activeOrgId,
        collectionNames.pigs,
        pigToDelete.id,
      );

      showNotice('success', `Pig ${pigToDelete.tag} deleted successfully.`);
      setPigToDelete(null);
    } catch {
      showNotice('error', 'Could not delete pig. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function addPig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const tag = asString(form.get('tag')).trim();

    if (!tag) {
      showNotice('error', 'Pig tag is required.');
      return;
    }

    if (tagExists(tag)) {
      showNotice('error', `The tag "${tag}" is already used by another pig.`);
      return;
    }

    setSubmitting(true);

    try {
      const dob = asString(form.get('dob')) || today();

      const newPigRef = await addRecord(
        profile?.activeOrgId,
        collectionNames.pigs,
        {
          tag,
          name: asString(form.get('name')),
          type: asString(form.get('type')) as PigType,
          breed: asString(form.get('breed')),
          dob,
          source: asString(form.get('source')) || 'purchased',
          purchasePrice: asNumber(form.get('purchasePrice')),
          notes: asString(form.get('notes')),
          status: 'active',
        },
        profile?.uid,
      );

      const initialWeight = asNumber(form.get('initialWeight'));

      if (initialWeight > 0) {
        await addRecord(
          profile?.activeOrgId,
          collectionNames.weightRecords,
          {
            pigId: newPigRef.id,
            date: dob,
            weight: initialWeight,
            bcs: '',
            notes: 'Initial weight',
          },
          profile?.uid,
        );
      }

      formElement.reset();
      setTab('list');
      showNotice('success', `Pig ${tag} registered successfully.`);
    } catch {
      showNotice('error', 'Could not register pig. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function recordEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const pigId = asString(form.get('pigId'));
    const eventType = asString(form.get('type')) as PigEventType;
    const eventDate = asString(form.get('date')) || today();

    setSubmitting(true);

    try {
      if (eventType === 'farrowed') {
        const bornAlive = asNumber(form.get('bornAlive'));
        const stillborn = asNumber(form.get('stillborn'));
        const maleCount = asNumber(form.get('maleCount'));
        const femaleCount = asNumber(form.get('femaleCount'));
        const averageBirthWeight = asNumber(form.get('averageBirthWeight'));
        const boarId = asString(form.get('boarId'));
        const notes = asString(form.get('notes'));

        if (bornAlive <= 0) {
          showNotice('error', 'Born alive must be greater than zero.');
          return;
        }

        const litterTag = generateLitterTag(eventDate);

        const farrowEventRef = await addRecord(
          profile?.activeOrgId,
          collectionNames.pigEvents,
          {
            pigId,
            date: eventDate,
            type: 'farrowed',
            notes,
            litterSize: bornAlive,
            bornAlive,
            stillborn,
            maleCount,
            femaleCount,
            averageBirthWeight,
            boarId,
          },
          profile?.uid,
        );

        const litterRef = await addRecord(
          profile?.activeOrgId,
          collectionNames.litters,
          {
            litterTag,
            sowId: pigId,
            boarId: boarId || '',
            farrowEventId: farrowEventRef.id,
            farrowDate: eventDate,
            bornAlive,
            stillborn,
            maleCount,
            femaleCount,
            totalBorn: bornAlive + stillborn,
            aliveCount: bornAlive,
            deadCount: 0,
            weanedCount: 0,
            averageBirthWeight,
            notes,
            status: 'active',
          },
          profile?.uid,
        );

        const pigletCreates = Array.from({ length: bornAlive }).map(
          async (_, index) => {
            const sex =
              index < maleCount
                ? 'male'
                : index < maleCount + femaleCount
                  ? 'female'
                  : 'unknown';

            return addRecord(
              profile?.activeOrgId,
              collectionNames.pigs,
              {
                tag: generatePigletTag(litterTag, index),
                name: '',
                type: 'piglet',
                breed: '',
                dob: eventDate,
                source: 'born',
                purchasePrice: 0,
                notes: `Auto-created from litter ${litterTag}`,
                status: 'active',
                motherId: pigId,
                fatherId: boarId || '',
                litterId: litterRef.id,
                birthEventId: farrowEventRef.id,
                birthWeight: averageBirthWeight || 0,
                sex,
              },
              profile?.uid,
            );
          },
        );

        await Promise.all(pigletCreates);

        formElement.reset();
        setSelectedEventType('sold');
        setTab('litters');
        showNotice(
          'success',
          `${bornAlive} piglets created under litter ${litterTag}.`,
        );

        return;
      }

      await createPigSaleEvent(
        profile?.activeOrgId,
        {
          pigId,
          date: eventDate,
          type: eventType,
          notes: asString(form.get('notes')),
          salePrice: asNumber(form.get('salePrice')),
          saleWeight: asNumber(form.get('saleWeight')),
          litterSize: asNumber(form.get('litterSize')),
        },
        profile?.uid,
        canSeeFinance,
      );

      formElement.reset();
      setTab('list');
      showNotice('success', 'Pig event recorded successfully.');
    } catch (error) {
      console.error(error);
      showNotice('error', 'Could not record pig event. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-5 shadow-sm sm:p-7">
        <PageHeader
          title="Pig Inventory"
          description="Manage livestock records, track active pigs, and record important pig events."
        />

        {!canWrite && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            You currently have view-only access. Ask an admin or manager for
            permission to add or update records.
          </div>
        )}

        {notice && (
          <div
            className={[
              'fixed right-4 top-4 z-50 max-w-sm rounded-2xl px-5 py-4 text-sm font-bold shadow-xl ring-1',
              notice.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                : 'bg-red-50 text-red-800 ring-red-200',
            ].join(' ')}
          >
            {notice.message}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Pigs"
            value={data.pigs.length}
            helper="All registered pigs"
            icon={<Activity size={22} />}
          />
          <StatCard
            title="Active Pigs"
            value={activePigs.length}
            helper="Currently on farm"
            icon={<HeartPulse size={22} />}
          />
          <StatCard
            title="Piglets"
            value={data.pigs.filter((pig) => pig.type === 'piglet').length}
            helper="Young stock"
            icon={<Baby size={22} />}
          />
          <StatCard
            title="Purchase Value"
            value={canSeeFinance ? formatMoney(totalPurchaseValue) : 'Hidden'}
            helper="Based on purchase price"
            icon={<BadgeDollarSign size={22} />}
          />
        </div>
      </div>

      <Tabs
        tabs={[
          { value: 'list', label: 'All Pigs' },
          { value: 'add', label: 'Add Pig' },
          { value: 'event', label: 'Record Event' },
          { value: 'litters', label: 'Litters' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'list' && (
        <Card>
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <CardTitle
              title="All Pigs"
              description="Search, filter, and manage your livestock inventory."
            />

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[720px]">
              <div className="relative sm:col-span-1">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tag, name, breed..."
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
              >
                <option value="all">All types</option>
                {pigTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="sold">Sold</option>
                <option value="dead">Dead</option>
              </select>
            </div>
          </div>

          {filteredPigs.length ? (
            <>
              <div className="hidden overflow-hidden rounded-3xl border border-slate-200 md:block">
                <Table
                  headers={[
                    'Tag',
                    'Name',
                    'Type',
                    'DOB/Acquired',
                    'Status',
                    'Purchase Price',
                    'Actions',
                  ]}
                >
                  {filteredPigs.map((pig) => (
                    <tr key={pig.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-4 font-black text-emerald-800">
                        {pig.tag}
                      </td>
                      <td className="px-4 py-4">{pig.name || '—'}</td>
                      <td className="px-4 py-4 capitalize">{pig.type}</td>
                      <td className="px-4 py-4">{dateLabel(pig.dob)}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={pig.status} />
                      </td>
                      <td className="px-4 py-4 font-semibold">
                        {canSeeFinance
                          ? formatMoney(pig.purchasePrice)
                          : 'Hidden'}
                      </td>
                      <td className="px-4 py-4">
                        {canDelete ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 size={15} />}
                            onClick={() =>
                              setPigToDelete({
                                id: pig.id,
                                tag: pig.tag,
                              })
                            }
                            className="bg-red-50 text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </Button>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">
                            No access
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </Table>
              </div>

              <div className="grid gap-4 md:hidden">
                {filteredPigs.map((pig) => (
                  <div
                    key={pig.id}
                    className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-emerald-800">
                          {pig.tag}
                        </p>
                        <p className="text-sm font-semibold text-slate-500">
                          {pig.name || 'Unnamed pig'}
                        </p>
                      </div>

                      <StatusBadge status={pig.status} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-400">Type</p>
                        <p className="font-black capitalize text-slate-800">
                          {pig.type}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-400">Date</p>
                        <p className="font-black text-slate-800">
                          {dateLabel(pig.dob)}
                        </p>
                      </div>

                      <div className="col-span-2 rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-400">
                          Purchase Price
                        </p>
                        <p className="font-black text-slate-800">
                          {canSeeFinance
                            ? formatMoney(pig.purchasePrice)
                            : 'Hidden'}
                        </p>
                      </div>
                    </div>

                    {canDelete && (
                      <div className="mt-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={15} />}
                          onClick={() =>
                            deleteRecord(
                              profile?.activeOrgId,
                              collectionNames.pigs,
                              pig.id,
                            )
                          }
                        >
                          Delete Pig
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="No pigs found"
              description="Try changing your search or filter settings."
            />
          )}
        </Card>
      )}

      {tab === 'add' && (
        <Card>
          <CardTitle
            title="Register New Pig"
            description="Add a new pig record and optionally save its initial weight."
          />

          <form
            onSubmit={addPig}
            className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            <Input
              label="Tag / ID"
              name="tag"
              required
              placeholder="PIG-001"
              disabled={!canWrite}
            />
            <Input
              label="Name"
              name="name"
              placeholder="Optional"
              disabled={!canWrite}
            />
            <Select
              label="Type"
              name="type"
              disabled={!canWrite}
              options={pigTypes}
            />
            <Input
              label="Breed"
              name="breed"
              placeholder="Large White"
              disabled={!canWrite}
            />
            <Input
              label="DOB / Acquired"
              name="dob"
              type="date"
              defaultValue={today()}
              disabled={!canWrite}
            />
            <Select
              label="Source"
              name="source"
              disabled={!canWrite}
              options={sources}
            />
            <Input
              label="Purchase Price (₦)"
              name="purchasePrice"
              type="number"
              min="0"
              step="0.01"
              disabled={!canWrite}
            />
            <Input
              label="Initial Weight (kg)"
              name="initialWeight"
              type="number"
              min="0"
              step="0.1"
              disabled={!canWrite}
            />

            <div className="md:col-span-2 xl:col-span-3">
              <Textarea label="Notes" name="notes" disabled={!canWrite} />
            </div>

            <div className="md:col-span-2 xl:col-span-3">
              <Button
                loading={submitting}
                disabled={!canWrite || submitting}
                icon={<Plus size={17} />}
              >
                Register Pig
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === 'event' && (
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardTitle
              title="Record Pig Event"
              description="Record sales, deaths, farrowing, or treatment events."
            />

            <form onSubmit={recordEvent} className="mt-5 space-y-4">
              <Select label="Pig" name="pigId" disabled={!canWrite} required>
                <option value="">Select pig</option>
                {activePigs.map((pig) => (
                  <option key={pig.id} value={pig.id}>
                    {pig.tag} {pig.name ? `— ${pig.name}` : ''}
                  </option>
                ))}
              </Select>

              <Select
                label="Event Type"
                name="type"
                disabled={!canWrite}
                value={selectedEventType}
                onChange={(event) =>
                  setSelectedEventType(event.target.value as PigEventType)
                }
                options={eventTypes}
              />

              <Input
                label="Date"
                name="date"
                type="date"
                defaultValue={today()}
                disabled={!canWrite}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Sale Price"
                  name="salePrice"
                  type="number"
                  min="0"
                  disabled={!canWrite}
                />
                <Input
                  label="Sale Weight"
                  name="saleWeight"
                  type="number"
                  min="0"
                  step="0.1"
                  disabled={!canWrite}
                />
                <Input
                  label="Litter Size"
                  name="litterSize"
                  type="number"
                  min="0"
                  disabled={!canWrite}
                />
              </div>

              <Textarea
                label="Notes / Cause"
                name="notes"
                disabled={!canWrite}
              />

              <Button loading={submitting} disabled={!canWrite || submitting}>
                Save Event
              </Button>
            </form>
          </Card>

          <Card>
            <CardTitle
              title="Event History"
              description="Latest recorded pig events."
            />

            {data.pigEvents.length ? (
              <div className="mt-5 space-y-3">
                {data.pigEvents.slice(0, 25).map((item) => {
                  const pig = data.pigs.find((p) => p.id === item.pigId);

                  return (
                    <div
                      key={item.id}
                      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-black text-slate-900">
                            {pig?.tag || 'Unknown pig'}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-500">
                            <CalendarDays size={14} />
                            {dateLabel(item.date)}
                          </p>
                        </div>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black capitalize text-slate-700">
                          {item.type}
                        </span>
                      </div>

                      <p className="mt-3 text-sm font-semibold text-slate-600">
                        {item.salePrice
                          ? formatMoney(item.salePrice)
                          : item.notes || 'No extra details'}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No events recorded"
                description="Pig events will appear here once they are saved."
              />
            )}
          </Card>
        </div>
      )}

      {tab === 'litters' && (
        <Card>
          <CardTitle
            title="Litters"
            description="Track farrowing performance, piglets born, mortality, and weaning outcomes."
          />

          {data.litters?.length ? (
            <div className="mt-5 grid gap-4">
              {data.litters.map((litter) => {
                const sow = data.pigs.find((pig) => pig.id === litter.sowId);
                const boar = data.pigs.find((pig) => pig.id === litter.boarId);
                const piglets = data.pigs.filter(
                  (pig) => pig.litterId === litter.id,
                );

                return (
                  <div
                    key={litter.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-lg font-black text-slate-950">
                          {litter.litterTag}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          Sow: {sow?.tag || 'Unknown'}{' '}
                          {boar ? `• Boar: ${boar.tag}` : ''}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          Farrowed: {dateLabel(litter.farrowDate)}
                        </p>
                      </div>

                      <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-black capitalize text-emerald-700 ring-1 ring-emerald-100">
                        {litter.status}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-bold text-slate-400">
                          Born Alive
                        </p>
                        <p className="text-xl font-black text-slate-900">
                          {litter.bornAlive}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-bold text-slate-400">
                          Stillborn
                        </p>
                        <p className="text-xl font-black text-slate-900">
                          {litter.stillborn}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-bold text-slate-400">
                          Alive Now
                        </p>
                        <p className="text-xl font-black text-slate-900">
                          {piglets.filter((pig) => pig.status === 'active').length}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-bold text-slate-400">
                          Weaned
                        </p>
                        <p className="text-xl font-black text-slate-900">
                          {litter.weanedCount || 0}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-bold text-slate-400">
                          Mortality
                        </p>
                        <p className="text-xl font-black text-slate-900">
                          {litter.bornAlive
                            ? `${Math.round(
                                ((litter.bornAlive -
                                  piglets.filter((pig) => pig.status === 'active')
                                    .length) /
                                  litter.bornAlive) *
                                  100,
                              )}%`
                            : '0%'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="mb-2 text-sm font-black text-slate-700">
                        Piglets
                      </p>

                      {piglets.length ? (
                        <div className="flex flex-wrap gap-2">
                          {piglets.map((piglet) => (
                            <span
                              key={piglet.id}
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700"
                            >
                              {piglet.tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm font-semibold text-slate-400">
                          No piglet records found.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No litters recorded"
              description="Record a Farrowed event to automatically create a litter and piglet records."
            />
          )}
        </Card>
      )}

      {pigToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <Trash2 size={24} />
            </div>

            <h2 className="text-xl font-black text-slate-950">
              Delete pig record?
            </h2>

            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              This will permanently delete pig{' '}
              <span className="font-black text-slate-900">
                {pigToDelete.tag}
              </span>
              . This action cannot be undone.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                disabled={submitting}
                onClick={() => setPigToDelete(null)}
              >
                Cancel
              </Button>

              <button
                type="button"
                disabled={submitting}
                onClick={confirmDeletePig}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-red-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Deleting...' : 'Yes, delete pig'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}