import { Mic } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  text: string
}

const IDLE_CLEAR_MS = 4000

function fullLangName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name || code.toUpperCase()
}

export function TranscriptionDisplay({
  entries,
  sourceLanguage,
}: TranscriptionDisplayProps) {
  const { t } = useTranslation('liveTranslation')

  // Collapse the entries log into the latest text per bucket (source + each
  // target). The rendered card then applies fill-then-clear locally.
  const buckets = useMemo<Bucket[]>(() => {
    const sourceText = (() => {
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i]
        if (e?.type === 'source') return e.text
      }
      return ''
    })()

    const sourceBucket: Bucket = {
      key: 'source',
      label: sourceLanguage.toUpperCase(),
      fullName: fullLangName(sourceLanguage),
      variant: 'source',
      text: sourceText,
    }

    const seenTargets = new Map<string, Bucket>()
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]
      if (!e || e.type !== 'translation') continue
      const tid = e.targetId || e.targetLanguage || 'unknown'
      if (seenTargets.has(tid)) continue
      seenTargets.set(tid, {
        key: tid,
        label: (e.targetLanguage || tid).toUpperCase(),
        fullName: fullLangName(e.targetLanguage || tid),
        variant: 'translation',
        text: e.text,
      })
    }

    return [sourceBucket, ...Array.from(seenTargets.values())]
  }, [entries, sourceLanguage])

  const hasAny = buckets.some((b) => b.text)

  if (!hasAny) {
    return (
      <div className="flex-1 flex items-center justify-center text-fg-hint">
        <div className="text-center">
          <Mic className="mx-auto mb-3 h-8 w-8" strokeWidth={1.25} />
          <p className="text-[15px] font-medium text-fg-label">
            {t('transcription.waitingForSpeech')}
          </p>
          <p className="text-[13px] mt-1">{t('transcription.startSpeaking')}</p>
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
  const labelColor = isSource ? 'text-fg-hint' : 'text-fg-label'

  // Fill-then-clear: keep the latest "window" of the incoming stream that
  // fits within two visual lines. We measure the rendered text height
  // after each update and, if it overflows, reset the window to start
  // from the last delta. A long idle pause also clears.
  const [windowText, setWindowText] = useState('')
  const lastTextRef = useRef('')
  const measureRef = useRef<HTMLParagraphElement>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const prev = lastTextRef.current
    const next = bucket.text
    if (next === prev) return

    // Append-only delta: if next extends prev, take only the suffix; else
    // treat the whole next as the new "delta".
    const delta = next.startsWith(prev) ? next.slice(prev.length) : next
    lastTextRef.current = next
    setWindowText((w) => w + delta)

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      setWindowText('')
    }, IDLE_CLEAR_MS)
  }, [bucket.text])

  useLayoutEffect(() => {
    const el = measureRef.current
    if (!el) return
    // If the rendered text exceeds the 2-line cap, restart with the latest
    // sentence-or-so. Compare scrollHeight to clientHeight (which is clipped
    // to the height: 2 lines).
    if (el.scrollHeight > el.clientHeight + 2) {
      // Reset to the most recent words that fit
      setWindowText((w) => {
        // Drop the first half — likely fits on two lines now
        const half = Math.floor(w.length / 2)
        return w.slice(half).replace(/^\s+/, '')
      })
    }
  }, [windowText])

  return (
    <div className="rounded-lg border border-line bg-app px-4 py-3">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className={`text-xs font-semibold ${labelColor}`}>
          {bucket.label}
        </span>
        <span className="text-xs text-fg-hint">{bucket.fullName}</span>
      </div>
      <p
        ref={measureRef}
        className="text-xl md:text-2xl font-semibold leading-snug text-fg break-words overflow-hidden"
        style={{
          // exactly 2 lines worth, matching leading-snug (≈ 1.375)
          height: 'calc(2 * 1.375 * 1em)',
        }}
      >
        {windowText || (
          <span className="text-fg-hint font-normal text-base">—</span>
        )}
      </p>
    </div>
  )
}
