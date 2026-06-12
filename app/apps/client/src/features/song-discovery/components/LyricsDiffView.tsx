import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { type DiffLine, diffLines, hasChanges } from '../utils/lyricsDiff'

interface LyricsDiffViewProps {
  /** Lyric lines of the existing library song (the diff "base"). */
  libraryLines: string[]
  /** Lyric lines of the candidate being imported (the diff "head"). */
  candidateLines: string[]
}

const ROW_STYLES: Record<DiffLine['type'], string> = {
  added: 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300',
  removed: 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  context: 'text-gray-600 dark:text-gray-400',
}

const ROW_SIGN: Record<DiffLine['type'], string> = {
  added: '+',
  removed: '-',
  context: ' ',
}

/**
 * GitHub-style unified diff between an existing library song and the candidate
 * being imported: red lines are dropped from the existing version, green lines
 * are new in the catalog song. Lets the operator see exactly which verses
 * changed before deciding to import.
 */
export function LyricsDiffView({
  libraryLines,
  candidateLines,
}: LyricsDiffViewProps) {
  const { t } = useTranslation('songDiscovery')
  const diff = useMemo(
    () => diffLines(libraryLines, candidateLines),
    [libraryLines, candidateLines],
  )

  if (!hasChanges(diff)) {
    return (
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {t('diff.identical')}
      </p>
    )
  }

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-red-400" />
          {t('diff.inLibrary')}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-green-400" />
          {t('diff.inCatalog')}
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto bg-white font-mono text-xs leading-relaxed dark:bg-gray-900">
        {diff.map((line, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: positional diff rows
            key={index}
            className={`flex gap-2 px-3 py-0.5 ${ROW_STYLES[line.type]}`}
          >
            <span className="select-none opacity-60">
              {ROW_SIGN[line.type]}
            </span>
            <span className="whitespace-pre-wrap break-words">
              {line.text || ' '}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
