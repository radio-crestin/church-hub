import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { LANGUAGES, type TranscriptionEntry } from '../hooks/useLiveTranslation'

interface TranscriptionDisplayProps {
  entries: TranscriptionEntry[]
  sourceLanguage: string
}

interface Bucket {
  key: string
  label: string
  fullName: string
  variant: 'source' | 'translation'
  current?: TranscriptionEntry
  previous?: TranscriptionEntry
}

function fullLangName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name || code.toUpperCase()
}

export function TranscriptionDisplay({
  entries,
  sourceLanguage,
}: TranscriptionDisplayProps) {
  const { t } = useTranslation('liveTranslation')

  // Bucket entries by source/target. For each bucket, surface the two most
  // recent entries — newest as "current" (big), prior as "previous" (dim).
  const buckets = useMemo<Bucket[]>(() => {
    const sourceBucket: Bucket = {
      key: 'source',
      label: sourceLanguage.toUpperCase(),
      fullName: fullLangName(sourceLanguage),
      variant: 'source',
    }
    const targetBuckets = new Map<string, Bucket>()

    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i]
      if (!entry) continue
      if (entry.type === 'source') {
        if (!sourceBucket.current) sourceBucket.current = entry
        else if (!sourceBucket.previous && entry.id !== sourceBucket.current.id)
          sourceBucket.previous = entry
      } else {
        const tid = entry.targetId || entry.targetLanguage || 'unknown'
        let bucket = targetBuckets.get(tid)
        if (!bucket) {
          bucket = {
            key: tid,
            label: (entry.targetLanguage || tid).toUpperCase(),
            fullName: fullLangName(entry.targetLanguage || tid),
            variant: 'translation',
          }
          targetBuckets.set(tid, bucket)
        }
        if (!bucket.current) bucket.current = entry
        else if (!bucket.previous && entry.id !== bucket.current.id)
          bucket.previous = entry
      }
    }

    return [sourceBucket, ...Array.from(targetBuckets.values())]
  }, [entries, sourceLanguage])

  const hasAny = buckets.some((b) => b.current)

  if (!hasAny) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-50">🎙️</div>
          <p className="text-lg">{t('transcription.waitingForSpeech')}</p>
          <p className="text-sm mt-1">{t('transcription.startSpeaking')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
      {buckets.map((bucket) => (
        <BucketCard key={bucket.key} bucket={bucket} />
      ))}
    </div>
  )
}

function BucketCard({ bucket }: { bucket: Bucket }) {
  const isSource = bucket.variant === 'source'
  const accent = isSource
    ? 'border-gray-300 dark:border-gray-600'
    : 'border-blue-400 dark:border-blue-500'
  const labelColor = isSource
    ? 'text-gray-500 dark:text-gray-400'
    : 'text-blue-600 dark:text-blue-400'

  return (
    <div
      className={`rounded-xl border-l-4 ${accent} bg-gray-50 dark:bg-gray-900/40 px-4 py-3`}
    >
      <div className="flex items-baseline gap-2 mb-1.5">
        <span
          className={`text-[10px] font-bold uppercase tracking-wider ${labelColor}`}
        >
          {bucket.label}
        </span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          {bucket.fullName}
        </span>
      </div>
      <div className="space-y-1.5 min-h-[3.5rem]">
        <p className="text-xl md:text-2xl font-semibold leading-snug text-gray-900 dark:text-white break-words">
          {bucket.current?.text || (
            <span className="text-gray-400 dark:text-gray-600 font-normal text-base">
              —
            </span>
          )}
        </p>
        {bucket.previous?.text && (
          <p className="text-sm md:text-base leading-snug text-gray-500 dark:text-gray-500 break-words">
            {bucket.previous.text}
          </p>
        )}
      </div>
    </div>
  )
}
