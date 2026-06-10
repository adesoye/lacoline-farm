import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className, ...props }: TextareaProps) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-bold text-slate-700">{label}</span>}
      <textarea
        className={cn('min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-forest-400 focus:ring-4 focus:ring-forest-100', className)}
        {...props}
      />
    </label>
  );
}
