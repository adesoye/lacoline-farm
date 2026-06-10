'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  CalendarClock,
  FileText,
  Gauge,
  LogOut,
  Menu,
  PiggyBank,
  Scale,
  Users,
  Wallet,
  X,
  ClipboardList,
  Building2
} from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import { useUserOrganizations } from '@/lib/firebase/firestore';
import { canAccess } from '@/lib/rbac';
import { roleLabels } from '@/lib/domain/constants';
import type { RouteKey } from '@/lib/domain/types';
import { cn, initials } from '@/lib/utils';

const navItems: Array<{ key: RouteKey; href: string; label: string; description: string; icon: React.ReactNode }> = [
  { key: 'dashboard', href: '/dashboard', label: 'Dashboard', description: 'Overview and alerts', icon: <Gauge size={18} /> },
  { key: 'pigs', href: '/pigs', label: 'Pig Inventory', description: 'Pigs and herd events', icon: <PiggyBank size={18} /> },
  { key: 'feed', href: '/feed', label: 'Daily Feed Log', description: 'Daily feed consumption', icon: <ClipboardList size={18} /> },
  { key: 'feed-stock', href: '/feed-stock', label: 'Feed Stock', description: 'Stock levels and purchases', icon: <Boxes size={18} /> },
  { key: 'weights', href: '/weights', label: 'Weight Records', description: 'Growth tracking', icon: <Scale size={18} /> },
  { key: 'finance', href: '/finance', label: 'Expenses & Income', description: 'Ledger and liabilities', icon: <Wallet size={18} /> },
  { key: 'monthly-inputs', href: '/monthly-inputs', label: 'Monthly Inputs', description: 'Vaccines and meds', icon: <CalendarClock size={18} /> },
  { key: 'financial-statements', href: '/financial-statements', label: 'Financial Statements', description: 'P&L, cash flow, balance', icon: <FileText size={18} /> },
  { key: 'reports', href: '/reports', label: 'Reports', description: 'Operational reports', icon: <BarChart3 size={18} /> },
  { key: 'users', href: '/users', label: 'User Management', description: 'Roles and access', icon: <Users size={18} /> },
  { key: 'organizations', href: '/organizations', label: 'Organizations', description: 'SaaS workspace', icon: <Building2 size={18} /> }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOutUser, switchOrganization } = useAuth();
  const { items: organizations } = useUserOrganizations();
  const [open, setOpen] = useState(false);
  const role = profile?.role;
  const allowed = navItems.filter(item => canAccess(role, item.key));

  async function logout() {
    await signOutUser();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-farm-glow">
      <button onClick={() => setOpen(true)} className="fixed left-4 top-4 z-40 rounded-2xl bg-forest-950 p-3 text-white shadow-soft lg:hidden" aria-label="Open navigation">
        <Menu size={20} />
      </button>

      <aside className={cn('fixed inset-y-0 left-0 z-50 flex w-[296px] flex-col bg-forest-950 text-white shadow-soft transition-transform lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-2xl">🐷</span>
            <span>
              <span className="block text-lg font-black tracking-tight">Lacoline Farm</span>
              <span className="text-xs text-white/50">SaaS farm workspace</span>
            </span>
          </Link>
          <button className="rounded-xl p-2 text-white/70 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X size={20} />
          </button>
        </div>

        <nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {allowed.map(item => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn('group flex items-center gap-3 rounded-2xl px-3 py-3 transition', active ? 'bg-white text-forest-950 shadow' : 'text-white/75 hover:bg-white/10 hover:text-white')}
              >
                <span className={cn('grid h-10 w-10 place-items-center rounded-xl', active ? 'bg-forest-100 text-forest-800' : 'bg-white/10')}>{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{item.label}</span>
                  <span className={cn('block truncate text-xs', active ? 'text-forest-900/50' : 'text-white/40')}>{item.description}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-white/10 p-4">
          <div className="rounded-3xl bg-white/10 p-3 ring-1 ring-white/10">
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/45">Organization</p>
            {organizations.length > 1 ? (
              <select
                value={profile?.activeOrgId || ''}
                onChange={event => switchOrganization(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-forest-900 px-3 py-2 text-sm font-bold text-white outline-none"
              >
                {organizations.map(org => <option key={org.orgId} value={org.orgId}>{org.orgName}</option>)}
              </select>
            ) : (
              <p className="truncate text-sm font-black">{profile?.activeOrgName || 'No organization'}</p>
            )}
          </div>

          <div className="rounded-3xl bg-white/10 p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-sm font-black text-forest-900">{initials(profile?.fullName)}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{profile?.fullName}</p>
                <p className="text-xs text-white/55">{profile?.email}</p>
                {role && <span className="mt-1 inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white/80">{roleLabels[role]}</span>}
              </div>
              <button onClick={logout} className="rounded-2xl p-2 text-white/60 hover:bg-red-500/20 hover:text-white" title="Sign out">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {open && <button className="fixed inset-0 z-40 bg-black/45 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu" />}

      <main className="lg:pl-[296px]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {role === 'viewer' && (
            <div className="mb-5 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
              Viewer mode: you can inspect records and reports, but write actions are disabled.
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
