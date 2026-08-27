import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">Not found</h1>
      <p className="text-sm text-zinc-500">That project or page doesn&apos;t exist.</p>
      <Link href="/dashboard" className="mt-2 text-sm text-zinc-700 underline">
        Back to dashboard
      </Link>
    </div>
  );
}
