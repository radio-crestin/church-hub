import { Check, Plus, Search, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SongPickerModal } from '../../songs/components/SongPickerModal'
import type { MissingSongItem } from '../types'

interface MissingSongResolverProps {
  missingSongs: MissingSongItem[]
  onResolve: (resolvedSongs: MissingSongItem[]) => void
  onCancel: () => void
}

export function MissingSongResolver({
  missingSongs,
  onResolve,
  onCancel,
}: MissingSongResolverProps) {
  const { t } = useTranslation('schedules')
  const [songs, setSongs] = useState<MissingSongItem[]>(missingSongs)
  const [searchingFor, setSearchingFor] = useState<string | null>(null)

  const handleSearchSelect = (title: string, songId: number) => {
    setSongs((prev) =>
      prev.map((song) =>
        song.title === title
          ? { ...song, resolved: { type: 'existing', songId } }
          : song,
      ),
    )
    setSearchingFor(null)
  }

  const handleCreate = (title: string) => {
    setSongs((prev) =>
      prev.map((song) =>
        song.title === title ? { ...song, resolved: { type: 'create' } } : song,
      ),
    )
  }

  const handleSkip = (title: string) => {
    setSongs((prev) => prev.filter((song) => song.title !== title))
  }

  const handleContinue = () => {
    onResolve(songs)
  }

  const allResolved = songs.every((song) => song.resolved !== undefined)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-fg">
          {t('editAsText.missingSongs.title')}
        </h3>
        <p className="text-[13px] text-fg-label mt-1">
          {t('editAsText.missingSongs.description')}
        </p>
      </div>

      <div className="space-y-3">
        {songs.map((song) => (
          <div
            key={song.title}
            className="flex items-center justify-between p-3 bg-app rounded-lg border border-line"
          >
            <div className="flex items-center gap-3">
              {song.resolved ? (
                <Check
                  className="w-5 h-5 text-fg-label flex-shrink-0"
                  strokeWidth={1.5}
                />
              ) : (
                <X
                  className="w-5 h-5 text-red-500 flex-shrink-0"
                  strokeWidth={1.5}
                />
              )}
              <div>
                <span className="font-medium text-fg">{song.title}</span>
                {song.resolved && (
                  <span className="ml-2 text-[13px] text-fg-hint">
                    {song.resolved.type === 'existing'
                      ? '(linked)'
                      : '(will create)'}
                  </span>
                )}
              </div>
            </div>

            {!song.resolved && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSearchingFor(song.title)}
                  className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-fg hover:bg-hover rounded-lg transition-colors"
                >
                  <Search size={14} strokeWidth={1.75} />
                  {t('editAsText.missingSongs.searchAndSelect')}
                </button>
                <button
                  type="button"
                  onClick={() => handleCreate(song.title)}
                  className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-fg-label hover:bg-hover rounded-lg transition-colors"
                >
                  <Plus size={14} strokeWidth={1.75} />
                  {t('editAsText.missingSongs.createNew')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSkip(song.title)}
                  className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-fg-label hover:bg-hover rounded-lg transition-colors"
                >
                  <X size={14} strokeWidth={1.75} />
                  {t('editAsText.missingSongs.skip')}
                </button>
              </div>
            )}

            {song.resolved && (
              <button
                type="button"
                onClick={() =>
                  setSongs((prev) =>
                    prev.map((s) =>
                      s.title === song.title
                        ? { ...s, resolved: undefined }
                        : s,
                    ),
                  )
                }
                className="px-3 py-1.5 text-[13px] text-fg-label hover:bg-hover rounded-lg transition-colors"
              >
                Change
              </button>
            )}
          </div>
        ))}
      </div>

      {songs.length === 0 && (
        <p className="text-center text-fg-hint py-4">
          All songs resolved or skipped
        </p>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-line">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 px-3.5 text-[13px] font-medium text-fg-body hover:bg-hover rounded-lg transition-colors"
        >
          {t('editAsText.cancel')}
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!allResolved && songs.length > 0}
          className="h-9 px-3.5 text-[13px] font-medium bg-primary hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('editAsText.missingSongs.continue')}
        </button>
      </div>

      {/* Song Picker Modal for searching */}
      <SongPickerModal
        isOpen={searchingFor !== null}
        onClose={() => setSearchingFor(null)}
        onSongSelect={(songId) => {
          if (searchingFor) {
            handleSearchSelect(searchingFor, songId)
          }
        }}
      />
    </div>
  )
}
