import { cn } from '@/lib/utils';

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: Array<{ value: T; label: string }>; active: T; onChange: (value: T) => void }) {
  return (
    <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto rounded-2xl bg-white/70 p-1 ring-1 ring-slate-200">
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn('whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black transition', active === tab.value ? 'bg-forest-700 text-white shadow' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900')}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
