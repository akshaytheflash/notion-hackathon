interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, total, pageSize, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: "var(--color-hairline)" }}>
      <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="text-xs font-mono px-2.5 py-1.5 rounded transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: "var(--color-muted)", border: "1px solid var(--color-hairline)" }}
        >
          Prev
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 7) {
            pageNum = i + 1;
          } else if (page <= 4) {
            pageNum = i + 1;
          } else if (page >= totalPages - 3) {
            pageNum = totalPages - 6 + i;
          } else {
            pageNum = page - 3 + i;
          }
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className="text-xs font-mono w-7 h-7 rounded transition-all duration-200"
              style={{
                color: pageNum === page ? "var(--color-ink)" : "var(--color-muted)",
                backgroundColor: pageNum === page ? "var(--color-signal-cyan)" : "transparent",
                border: pageNum === page ? "none" : "1px solid var(--color-hairline)",
              }}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="text-xs font-mono px-2.5 py-1.5 rounded transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: "var(--color-muted)", border: "1px solid var(--color-hairline)" }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
