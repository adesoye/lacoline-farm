import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const tones = {
  forest: 'bg-forest-700 text-white',
  clay: 'bg-clay-500 text-white',
  slate: 'bg-white text-slate-950',
  red: 'bg-red-600 text-white',
  amber: 'bg-amber-500 text-white'
};

export function StatCard({ label, value, icon, tone = 'slate', hint }: { label: string; value: ReactNode; icon?: ReactNode; tone?: keyof typeof tones; hint?: string }) {
  return (
    <div className={cn('rounded-[1.6rem] border border-white/70 p-5 shadow-card', tones[tone])}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-bold opacity-75">{label}</p>
        {icon && <div className="grid h-10 w-10 place-items-center rounded-2xl bg-black/10">{icon}</div>}
      </div>
      <div className="mt-3 text-3xl font-black tracking-tight">{value}</div>
      {hint && <p className="mt-2 text-xs opacity-70">{hint}</p>}
    </div>
  );
}
