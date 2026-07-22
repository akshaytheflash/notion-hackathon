export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="skeleton h-3.5 w-24" />
      <div className="skeleton h-3.5 w-28" />
      <div className="skeleton h-3.5 w-20" />
      <div className="skeleton h-3.5 w-36 ml-auto" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border p-5 space-y-3" style={{ borderColor: "var(--color-hairline)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="skeleton h-3.5 w-24" />
          <div className="skeleton h-5 w-32" />
        </div>
        <div className="skeleton h-3.5 w-20" />
      </div>
      <div className="skeleton h-2.5 w-full" />
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="p-6 space-y-6 animate-enter">
      <div className="flex items-center gap-2">
        <div className="skeleton h-3.5 w-20" />
        <div className="skeleton h-3.5 w-4" />
        <div className="skeleton h-3.5 w-24" />
      </div>
      <div className="skeleton h-6 w-48" />
      <div className="rounded-lg border p-6 space-y-4" style={{ borderColor: "var(--color-hairline)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="skeleton h-5 w-32" />
            <div className="skeleton h-6 w-40" />
          </div>
          <div className="skeleton h-5 w-24" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-md border p-3 space-y-2" style={{ borderColor: "var(--color-hairline)" }}>
              <div className="skeleton h-2.5 w-24" />
              <div className="skeleton h-3.5 w-28" />
            </div>
          ))}
        </div>
        <div className="skeleton h-16 w-full" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-enter">
      {[...Array(rows)].map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function SkeletonCardList({ items = 4 }: { items?: number }) {
  return (
    <div className="space-y-3 animate-enter">
      {[...Array(items)].map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
