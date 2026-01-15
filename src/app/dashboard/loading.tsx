export default function Loading() {
  return (
    <div className="p-6">
      <div className="mb-4 h-6 w-40 animate-pulse rounded-md bg-zinc-200" />
      <div className="space-y-3">
        <div className="h-4 w-full animate-pulse rounded-md bg-zinc-200" />
        <div className="h-4 w-5/6 animate-pulse rounded-md bg-zinc-200" />
        <div className="h-4 w-2/3 animate-pulse rounded-md bg-zinc-200" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="h-24 animate-pulse rounded-2xl bg-zinc-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-zinc-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-zinc-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-zinc-200" />
      </div>
    </div>
  );
}
