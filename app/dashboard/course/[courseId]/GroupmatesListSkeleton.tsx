export function GroupmatesListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-9 w-32 animate-pulse rounded-lg bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
