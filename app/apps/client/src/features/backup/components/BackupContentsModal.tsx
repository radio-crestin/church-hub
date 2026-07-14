import { AlertTriangle, ListMusic, Loader2, Music, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useBackupContents } from '../hooks/useBackupContents'
import type { BackupCounts, BackupFile } from '../service'

/** Counts shown as stat tiles, in display order. */
const COUNT_KEYS: (keyof BackupCounts)[] = [
  'songs',
  'songSlides',
  'songCategories',
  'songBookmarks',
  'schedules',
  'scheduleItems',
  'musicPlaylists',
  'musicFiles',
  'bibleTranslations',
  'users',
  'screens',
]

interface BackupContentsModalProps {
  file: BackupFile
  onClose: () => void
}

/**
 * Read-only view of what a Drive backup contains — song titles, schedules,
 * playlists and per-table counts — without restoring it.
 */
export function BackupContentsModal({
  file,
  onClose,
}: BackupContentsModalProps) {
  const { t } = useTranslation('settings')
  const { data: contents, isLoading, error } = useBackupContents(file.id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      />
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('sections.backup.inspectModal.title')}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {new Date(file.createdAtMs).toLocaleString()}
              {file.appVersion ? ` · v${file.appVersion}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={t('sections.backup.inspectModal.close')}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('sections.backup.inspectModal.loading')}
            </div>
          ) : error || !contents ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              {t('sections.backup.inspectModal.failed')}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Counts overview */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {COUNT_KEYS.map((key) => (
                  <div
                    key={key}
                    className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/50"
                  >
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {contents.counts[key]}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t(`sections.backup.inspectModal.counts.${key}`)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Songs */}
              {contents.songs.length > 0 && (
                <section>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                    <Music className="h-4 w-4 text-indigo-500" />
                    {t('sections.backup.inspectModal.songs', {
                      total: contents.songs.length,
                    })}
                  </h4>
                  <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                    {contents.songs.map((song, i) => (
                      <li
                        key={`${song.title}-${i}`}
                        className="flex items-center justify-between gap-3 px-3 py-1.5"
                      >
                        <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                          {song.title}
                        </span>
                        {song.category && (
                          <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                            {song.category}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {contents.counts.songs > contents.songs.length && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {t('sections.backup.inspectModal.more', {
                        total: contents.counts.songs - contents.songs.length,
                      })}
                    </p>
                  )}
                </section>
              )}

              {/* Schedules */}
              {contents.schedules.length > 0 && (
                <section>
                  <h4 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
                    {t('sections.backup.inspectModal.schedules', {
                      total: contents.schedules.length,
                    })}
                  </h4>
                  <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                    {contents.schedules.map((schedule, i) => (
                      <li
                        key={`${schedule.title}-${i}`}
                        className="flex items-center justify-between gap-3 px-3 py-1.5"
                      >
                        <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                          {schedule.title}
                        </span>
                        {schedule.createdAtMs && (
                          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                            {new Date(
                              schedule.createdAtMs,
                            ).toLocaleDateString()}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {contents.counts.schedules > contents.schedules.length && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {t('sections.backup.inspectModal.more', {
                        total:
                          contents.counts.schedules - contents.schedules.length,
                      })}
                    </p>
                  )}
                </section>
              )}

              {/* Playlists */}
              {contents.playlists.length > 0 && (
                <section>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                    <ListMusic className="h-4 w-4 text-indigo-500" />
                    {t('sections.backup.inspectModal.playlists', {
                      total: contents.playlists.length,
                    })}
                  </h4>
                  <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                    {contents.playlists.map((playlist, i) => (
                      <li
                        key={`${playlist.name}-${i}`}
                        className="flex items-center justify-between gap-3 px-3 py-1.5"
                      >
                        <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                          {playlist.name}
                        </span>
                        <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                          {t('sections.backup.inspectModal.playlistItems', {
                            count: playlist.itemCount,
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {contents.counts.musicPlaylists >
                    contents.playlists.length && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {t('sections.backup.inspectModal.more', {
                        total:
                          contents.counts.musicPlaylists -
                          contents.playlists.length,
                      })}
                    </p>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
