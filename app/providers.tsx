'use client';

import { AuthProvider } from '@/lib/firebase/auth-context';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
