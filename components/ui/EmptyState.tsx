export function EmptyState({ title = 'No records yet', description = 'Add a record to see it here.' }: { title?: string; description?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <p className="font-black text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}
