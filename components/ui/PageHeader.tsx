import type { ReactNode } from 'react';

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 inline-flex rounded-full bg-forest-100 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-forest-700">Lacoline Farm</p>
        <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">{description}</p>
      </div>
      {action}
    </div>
  );
}
