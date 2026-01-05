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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('editAsText.missingSongs.title')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t('editAsText.missingSongs.description')}
        </p>
      </div>

      <div className="space-y-3">
        {songs.map((song) => (
          <div
            key={song.title}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              {song.resolved ? (
                <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              ) : (
                <X className="w-5 h-5 text-red-500 flex-shrink-0" />
              )}
              <div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {song.title}
                </span>
                {song.resolved && (
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
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
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                >
                  <Search size={14} />
                  {t('editAsText.missingSongs.searchAndSelect')}
                </button>
                <button
                  type="button"
                  onClick={() => handleCreate(song.title)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                >
                  <Plus size={14} />
                  {t('editAsText.missingSongs.createNew')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSkip(song.title)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X size={14} />
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
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Change
              </button>
            )}
          </div>
        ))}
      </div>

      {songs.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
          All songs resolved or skipped
        </p>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          {t('editAsText.cancel')}
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!allResolved && songs.length > 0}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
