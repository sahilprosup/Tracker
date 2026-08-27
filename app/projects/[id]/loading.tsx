export default function ProjectLoading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 h-8 w-64 animate-pulse rounded bg-zinc-100" />
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border border-zinc-200 bg-zinc-50" />
        ))}
      </div>
    </div>
  );
}
