'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import { canAccess } from '@/lib/rbac';
import type { RouteKey } from '@/lib/domain/types';

const pathToRoute = (pathname: string): RouteKey => {
  const first = pathname.split('/').filter(Boolean)[0] || 'dashboard';
  if (first === 'feed-stock') return 'feed-stock';
  if (first === 'monthly-inputs') return 'monthly-inputs';
  if (first === 'financial-statements') return 'financial-statements';
  if (first === 'organizations') return 'organizations';
  return first as RouteKey;
};

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, profile, loading, profileChecked, profileError, signOutUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !profileChecked) return;
    if (!firebaseUser) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (profile?.active === false) {
      signOutUser().finally(() => router.replace('/login'));
      return;
    }
    const route = pathToRoute(pathname);
    if (profile?.role && !canAccess(profile.role, route)) {
      router.replace('/dashboard');
    }
  }, [firebaseUser, loading, pathname, profile, profileChecked, router, signOutUser]);

  if (loading || !profileChecked) {
    return (
      <div className="grid min-h-screen place-items-center bg-farm-glow">
        <div className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 font-bold text-forest-900 shadow-card">
          <Loader2 className="animate-spin" size={20} /> Loading secure workspace...
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="grid min-h-screen place-items-center bg-farm-glow">
        <div className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 font-bold text-forest-900 shadow-card">
          <Loader2 className="animate-spin" size={20} /> Redirecting to login...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-farm-glow px-4">
        <div className="max-w-xl rounded-3xl bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center gap-3 text-red-700">
            <AlertTriangle size={24} />
            <h1 className="text-xl font-black">No active organization workspace</h1>
          </div>
          <p className="text-sm leading-6 text-slate-600">
            Firebase Auth signed you in, but the app could not find an active organization membership for this account.
            In SaaS mode, every user must belong to an organization before farm data can load.
          </p>
          {profileError ? <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{profileError}</div> : null}
          <div className="mt-4 rounded-2xl bg-slate-100 p-4 text-sm text-slate-700">
            Seed the first admin/organization with <code>npm run seed:admin</code>, or invite/create the user from an organization admin account.
          </div>
          <button
            type="button"
            onClick={() => signOutUser().finally(() => router.replace('/login'))}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-forest-700 px-4 py-3 text-sm font-bold text-white hover:bg-forest-800"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
    );
  }

  const route = pathToRoute(pathname);
  if (!canAccess(profile.role, route)) {
    return (
      <div className="grid min-h-screen place-items-center bg-farm-glow">
        <div className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 font-bold text-forest-900 shadow-card">
          <Loader2 className="animate-spin" size={20} /> Redirecting...
        </div>
      </div>
    );
  }

  return children;
}
