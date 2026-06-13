import { Loader2 } from 'lucide-react'

interface DiscoveryProgressProps {
  label: string
  /** 0..1 fill ratio, or null for an indeterminate (animated) bar. */
  ratio: number | null
  /** Right-aligned detail next to the label, e.g. "28%". */
  detail?: string
  /** Secondary line under the bar, e.g. "1,240 / 4,500 analyzed · 32 new found". */
  meta?: string
}

/**
 * Progress band for the download/parse and analyze phases. A highlight sweeps
 * across the indigo fill so it always reads as active — even between the
 * chunked value updates — and a secondary line carries the live counts.
 */
export function DiscoveryProgress({
  label,
  ratio,
  detail,
  meta,
}: DiscoveryProgressProps) {
  const pct =
    ratio == null ? null : Math.max(0, Math.min(100, Math.round(ratio * 100)))

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          {label}
        </span>
        {detail && (
          <span className="text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400">
            {detail}
          </span>
        )}
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        {pct == null ? (
          <div className="discover-indeterminate absolute inset-y-0 left-0 w-2/5 rounded-full bg-indigo-500/70" />
        ) : (
          <div
            className="relative h-full overflow-hidden rounded-full bg-indigo-600 transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          >
            <div className="discover-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </div>
        )}
      </div>
      {meta && (
        <p className="mt-2 text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {meta}
        </p>
      )}
    </div>
  )
}
