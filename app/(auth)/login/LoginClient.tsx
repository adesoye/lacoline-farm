'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/auth-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const features = [
  'Keep every pig record in one place',
  'Know when feed is running low',
  'Track income, expenses, and profit',
  'Give each staff the right access',
];

const stats = [
  { label: 'Tools for daily farm work', value: '8+' },
  { label: 'Staff access control', value: 'Safe' },
  { label: 'Data available anytime', value: 'Live' },
];

function getFriendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('auth/invalid-credential')) {
    return 'Invalid email or password. Please check your details and try again.';
  }

  if (message.includes('auth/user-not-found')) {
    return 'No account exists with this email address.';
  }

  if (message.includes('auth/wrong-password')) {
    return 'Incorrect password. Please try again.';
  }

  if (message.includes('auth/too-many-requests')) {
    return 'Too many failed attempts. Please wait a moment and try again.';
  }

  if (message.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }

  return 'Unable to sign in right now. Please check your details and try again.';
}

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { firebaseUser, profile, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nextPath = useMemo(() => params.get('next') || '/dashboard', [params]);
  const canSubmit = email.trim().length > 3 && password.length > 0 && !submitting;

  useEffect(() => {
    if (!loading && firebaseUser && profile?.active) {
      router.replace(nextPath);
    }
  }, [firebaseUser, loading, nextPath, profile, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) return;

    setSubmitting(true);
    setError('');

    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);

      await updateDoc(doc(db, 'users', result.user.uid), {
        lastLoginAt: serverTimestamp(),
      }).catch(() => undefined);

      router.replace(nextPath);
    } catch (err) {
      console.error(err);
      setError(getFriendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.34),transparent_32rem),radial-gradient(circle_at_bottom_right,rgba(132,204,22,0.22),transparent_30rem)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.15),rgba(2,6,23,0.85))]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl shadow-black/30 backdrop-blur-2xl lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative hidden p-8 lg:block xl:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_22rem)]" />

            <div className="relative flex h-full min-h-[650px] flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85">
                  <ShieldCheck size={16} />
                  Farm Operations + Farm Team Access
                </div>

                <div className="mt-10 max-w-xl">
                  <div className="mb-5 inline-grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-3xl ring-1 ring-white/15">
                    🐷
                  </div>

                  <h1 className="text-5xl font-black tracking-tight text-white xl:text-6xl">
                    Lacolline Farm Manager
                  </h1>

                  <p className="mt-5 text-lg leading-8 text-white/72">
                    Everything your farm team needs to manage pigs, feed, stock, sales, expenses, health records, and reports — without scattered notebooks or guesswork.
                  </p>
                </div>

                <div className="mt-8 grid max-w-xl grid-cols-2 gap-3">
                  {features.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm font-semibold text-white/85"
                    >
                      <CheckCircle2 size={17} className="text-lime-300" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {stats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-3xl border border-white/10 bg-white/10 p-5"
                  >
                    <p className="text-2xl font-black">{item.value}</p>
                    <p className="mt-1 text-xs font-medium text-white/60">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-white px-5 py-8 text-slate-950 sm:px-8 sm:py-10 lg:px-10">
            <div className="mx-auto flex min-h-[580px] max-w-md flex-col justify-center">
              <div className="mb-8 text-center lg:text-left">
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-forest-100 text-3xl shadow-sm lg:mx-0">
                  🐷
                </div>

                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                  <Sparkles size={14} />
                  Secure admin access
                </div>

                <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Welcome back
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Sign in to manage farm operations, records, users, reports,
                  and financial activity.
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              {profile?.active === false && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                  Your account is inactive. Ask an admin to reactivate it.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="admin@lacolinefarm.com"
                />

                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    placeholder="••••••••"
                  />

                  <button
                    type="button"
                    className="absolute right-3 top-[38px] rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <Button
                  className="w-full justify-center"
                  size="lg"
                  loading={submitting}
                  disabled={!canSubmit}
                  icon={
                    submitting ? (
                      <LockKeyhole size={18} />
                    ) : (
                      <ArrowRight size={18} />
                    )
                  }
                >
                  {submitting ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    Protected
                  </div>
                  <p className="text-xs leading-5 text-slate-500">
                    Firebase Authentication with workspace-level access.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Wifi size={16} className="text-emerald-600" />
                    Synced
                  </div>
                  <p className="text-xs leading-5 text-slate-500">
                    Farm data updates securely through Cloud Firestore.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
                <div className="mb-1 flex items-center gap-2 font-bold text-slate-700">
                  <Leaf size={15} className="text-emerald-600" />
                  New farm setup
                </div>
                Contact us to create your farm workspace, add staff, and get started with Lacolline Farm Manager.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}