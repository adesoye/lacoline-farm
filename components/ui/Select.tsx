import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: Array<{ label: string; value: string }>;
}

export function Select({ label, options, children, className, ...props }: SelectProps) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-bold text-slate-700">{label}</span>}
      <select
        className={cn('h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-forest-400 focus:ring-4 focus:ring-forest-100', className)}
        {...props}
      >
        {options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        {children}
      </select>
    </label>
  );
}
