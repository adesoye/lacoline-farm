import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatNumber(value: number | undefined | null, digits = 0) {
  return Number(value || 0).toLocaleString('en-NG', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export function formatMoney(value: number | undefined | null) {
  return `₦${formatNumber(value || 0, 2)}`;
}

export function dateLabel(value?: string | null) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function initials(name?: string | null) {
  return (name || 'User')
    .split(' ')
    .filter(Boolean)
    .map(item => item[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function asNumber(value: FormDataEntryValue | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function asString(value: FormDataEntryValue | null | undefined) {
  return String(value ?? '').trim();
}

export function percent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}
