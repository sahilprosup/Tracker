export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 h-8 w-40 animate-pulse rounded bg-zinc-100" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg border border-zinc-200 bg-zinc-50" />
        ))}
      </div>
    </div>
  );
}
