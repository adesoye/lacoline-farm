import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import LoginClient from './LoginClient';

function LoginFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-farm-glow px-4">
      <div className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 font-bold text-forest-900 shadow-card">
        <Loader2 className="animate-spin" size={20} />
        Loading login...
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  );
}