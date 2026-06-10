'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/auth-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { firebaseUser, profile, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && firebaseUser && profile?.active) {
      router.replace(params.get('next') || '/dashboard');
    }
  }, [firebaseUser, loading, params, profile, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      await updateDoc(doc(db, 'users', result.user.uid), { lastLoginAt: serverTimestamp() }).catch(() => undefined);
      router.replace(params.get('next') || '/dashboard');
    } catch (err) {
      console.error(err);
      setError('Unable to sign in. Check the email/password or make sure this user exists in Firebase.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-forest-950 via-forest-800 to-forest-500 px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 shadow-soft backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
          <section className="hidden bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,.25),transparent_28rem)] p-10 lg:block">
            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85">
                  <ShieldCheck size={16} /> Firebase Auth + SaaS Workspaces
                </div>
                <h1 className="max-w-lg text-5xl font-black tracking-tight">Lacoline Farm Manager</h1>
                <p className="mt-5 max-w-xl text-lg leading-8 text-white/75">
                  A multi-tenant pig farm SaaS for livestock, feed, stock, finance, health inputs, reports, and organization-based user privileges.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm text-white/80">
                {['Organization isolation', 'Cloud Firestore data', 'Responsive dashboard'].map(item => (
                  <div key={item} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">{item}</div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-white p-6 text-slate-950 sm:p-10">
            <div className="mx-auto max-w-md">
              <div className="mb-8 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-forest-100 text-3xl">🐷</div>
                <h2 className="mt-5 text-3xl font-black tracking-tight text-forest-950">Welcome back</h2>
                <p className="mt-2 text-sm text-slate-500">Sign in with your Firebase Authentication account.</p>
              </div>

              {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
              {profile?.active === false && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">Your account is inactive. Ask an admin to reactivate it.</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required placeholder="admin@lacolinefarm.com" />
                <div className="relative">
                  <Input label="Password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required placeholder="••••••••" />
                  <button type="button" className="absolute right-3 top-[38px] rounded-xl p-1 text-slate-400 hover:bg-slate-100" onClick={() => setShowPassword(value => !value)} aria-label="Toggle password visibility">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <Button className="w-full" size="lg" loading={submitting} icon={<LockKeyhole size={18} />}>Sign in</Button>
              </form>

              <p className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
                First time setup: run <code className="font-bold text-forest-700">npm run seed:admin</code> after adding Firebase credentials. Demo users must be created in Firebase, not stored locally.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
