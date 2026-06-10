import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-forest-700 text-white hover:bg-forest-800 shadow-lg shadow-forest-900/10',
  secondary: 'bg-clay-500 text-white hover:bg-clay-600 shadow-lg shadow-clay-900/10',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
  outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
};

const sizes: Record<Size, string> = {
  sm: 'h-9 rounded-xl px-3 text-sm',
  md: 'h-11 rounded-2xl px-4 text-sm',
  lg: 'h-12 rounded-2xl px-5 text-base'
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

export function Button({ className, variant = 'primary', size = 'md', icon, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn('inline-flex items-center justify-center gap-2 font-bold transition disabled:cursor-not-allowed disabled:opacity-60', variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" size={17} /> : icon}
      {children}
    </button>
  );
}
