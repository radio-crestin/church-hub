import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { TranscriptionEntry } from '../hooks/useLiveTranslation'

interface TranscriptionDisplayProps {
  entries: TranscriptionEntry[]
  sourceLanguage: string
  targetLanguage: string
}

export function TranscriptionDisplay({
  entries,
  sourceLanguage,
  targetLanguage,
}: TranscriptionDisplayProps) {
  const { t } = useTranslation('liveTranslation')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new or updated entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries])

  if (entries.length === 0) {
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
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto scrollbar-thin space-y-3 p-4"
    >
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={`flex ${entry.type === 'source' ? 'justify-start' : 'justify-end'}`}
        >
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              entry.type === 'source'
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-md'
                : 'bg-blue-600 dark:bg-blue-500 text-white rounded-br-md'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  entry.type === 'source'
                    ? 'text-gray-400 dark:text-gray-500'
                    : 'text-blue-200'
                }`}
              >
                {entry.type === 'source'
                  ? sourceLanguage.toUpperCase()
                  : targetLanguage.toUpperCase()}
              </span>
              <span
                className={`text-[10px] ${
                  entry.type === 'source'
                    ? 'text-gray-400 dark:text-gray-500'
                    : 'text-blue-200'
                }`}
              >
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-base leading-relaxed">{entry.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
