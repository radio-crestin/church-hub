import {
  AlertTriangle,
  CalendarDays,
  ListMusic,
  Loader2,
  Music,
  X,
} from 'lucide-react'
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
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-panel shadow-popover">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line p-4">
          <div>
            <h3 className="text-base font-semibold text-fg">
              {t('sections.backup.inspectModal.title')}
            </h3>
            <p className="mt-0.5 text-xs text-fg-hint">
              {new Date(file.createdAtMs).toLocaleString()}
              {file.appVersion ? ` · v${file.appVersion}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={t('sections.backup.inspectModal.close')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg"
          >
            <X strokeWidth={1.5} className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-fg-hint">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('sections.backup.inspectModal.loading')}
            </div>
          ) : error || !contents ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle strokeWidth={1.5} className="h-4 w-4" />
              {t('sections.backup.inspectModal.failed')}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Counts overview */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {COUNT_KEYS.map((key) => (
                  <div key={key} className="rounded-lg bg-field px-3 py-2">
                    <p className="text-base font-semibold tabular-nums text-fg">
                      {contents.counts[key]}
                    </p>
                    <p className="text-xs text-fg-hint">
                      {t(`sections.backup.inspectModal.counts.${key}`)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Songs */}
              {contents.songs.length > 0 && (
                <section>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-fg">
                    <Music
                      strokeWidth={1.5}
                      className="h-4 w-4 text-fg-label"
                    />
                    {t('sections.backup.inspectModal.songs', {
                      total: contents.songs.length,
                    })}
                  </h4>
                  <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                    {contents.songs.map((song, i) => (
                      <li
                        key={`${song.title}-${i}`}
                        className="flex items-center justify-between gap-3 px-3 py-1.5"
                      >
                        <span className="truncate text-sm text-fg-body">
                          {song.title}
                        </span>
                        {song.category && (
                          <span className="shrink-0 text-xs text-fg-hint">
                            {song.category}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {contents.counts.songs > contents.songs.length && (
                    <p className="mt-1 text-xs text-fg-hint">
                      {t('sections.backup.inspectModal.more', {
                        total: contents.counts.songs - contents.songs.length,
                      })}
                    </p>
                  )}
                </section>
              )}

              {/* Schedules — each program lists the songs it carries, so the
                  backup can be verified to hold the programs as arranged, not
                  just their names. */}
              {contents.schedules.length > 0 && (
                <section>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-fg">
                    <CalendarDays
                      strokeWidth={1.5}
                      className="h-4 w-4 text-fg-label"
                    />
                    {t('sections.backup.inspectModal.schedules', {
                      total: contents.schedules.length,
                    })}
                  </h4>
                  <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                    {contents.schedules.map((schedule, i) => (
                      <li
                        key={`${schedule.title}-${i}`}
                        className="px-3 py-2"
                        data-testid="backup-schedule-row"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm text-fg-body">
                            {schedule.title}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="text-xs text-fg-hint">
                              {t('sections.backup.inspectModal.scheduleSongs', {
                                count: schedule.songCount,
                              })}
                            </span>
                            {schedule.createdAtMs && (
                              <span className="text-xs text-fg-hint">
                                {new Date(
                                  schedule.createdAtMs,
                                ).toLocaleDateString()}
                              </span>
                            )}
                          </span>
                        </div>
                        {schedule.songTitles.length > 0 && (
                          <p className="mt-0.5 truncate text-xs text-fg-hint">
                            {schedule.songTitles.join(' · ')}
                            {schedule.songCount > schedule.songTitles.length
                              ? ' …'
                              : ''}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                  {contents.counts.schedules > contents.schedules.length && (
                    <p className="mt-1 text-xs text-fg-hint">
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
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-fg">
                    <ListMusic
                      strokeWidth={1.5}
                      className="h-4 w-4 text-fg-label"
                    />
                    {t('sections.backup.inspectModal.playlists', {
                      total: contents.playlists.length,
                    })}
                  </h4>
                  <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                    {contents.playlists.map((playlist, i) => (
                      <li
                        key={`${playlist.name}-${i}`}
                        className="flex items-center justify-between gap-3 px-3 py-1.5"
                      >
                        <span className="truncate text-sm text-fg-body">
                          {playlist.name}
                        </span>
                        <span className="shrink-0 text-xs text-fg-hint">
                          {t('sections.backup.inspectModal.playlistItems', {
                            count: playlist.itemCount,
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {contents.counts.musicPlaylists >
                    contents.playlists.length && (
                    <p className="mt-1 text-xs text-fg-hint">
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
