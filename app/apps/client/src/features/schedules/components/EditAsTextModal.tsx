import { AlertCircle, FileText, Loader2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getSelectedBibleTranslationIds } from '~/service/bible/bible'
import { useToast } from '~/ui/toast'
import { MissingSongResolver } from './MissingSongResolver'
import { getBooks, getTranslationById } from '../../bible/service/bible'
import { parsePassageRange } from '../../bible/utils/parsePassageRange'
import { searchSongs, upsertSong } from '../../songs/service/songs'
import { replaceScheduleItems } from '../service/schedules'
import type { MissingSongItem, ScheduleItem, SlideTemplate } from '../types'
import { generateScheduleText } from '../utils/generateScheduleText'
import type { ParsedScheduleItem } from '../utils/parseScheduleText'
import { parseScheduleText } from '../utils/parseScheduleText'

interface ValidationError {
  lineNumber: number
  type: 'bible_passage' | 'versete_tineri' | 'song' | 'scene'
  content: string
  message: string
}

interface EditAsTextModalProps {
  isOpen: boolean
  onClose: () => void
  scheduleId: number | null
  currentItems: ScheduleItem[]
  onItemsUpdated: () => void
}

type ModalState = 'editing' | 'resolving' | 'processing'

interface VerseteTineriEntryInput {
  personName: string
  translationId: number
  bookCode: string
  bookName: string
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
}

interface ProcessedItem {
  type: 'song' | 'slide'
  songId?: number
  slideType?: SlideTemplate
  slideContent?: string
  // Bible passage fields
  biblePassage?: {
    translationId: number
    translationAbbreviation: string
    bookCode: string
    bookName: string
    startChapter: number
    startVerse: number
    endChapter: number
    endVerse: number
  }
  // Versete Tineri entries
  verseteTineriEntries?: VerseteTineriEntryInput[]
  // Scene fields
  obsSceneName?: string
}

export function EditAsTextModal({
  isOpen,
  onClose,
  scheduleId,
  currentItems,
  onItemsUpdated,
}: EditAsTextModalProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)

  const [text, setText] = useState('')
  const [modalState, setModalState] = useState<ModalState>('editing')
  const [missingSongs, setMissingSongs] = useState<MissingSongItem[]>([])
  const [parsedItems, setParsedItems] = useState<ParsedScheduleItem[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  )

  // Initialize text from current items when modal opens
  useEffect(() => {
    if (isOpen) {
      const formatHelpLines = [
        t('editAsText.formatHelpLines.title'),
        t('editAsText.formatHelpLines.song'),
        t('editAsText.formatHelpLines.announcement'),
        t('editAsText.formatHelpLines.bibleComment'),
        t('editAsText.formatHelpLines.bible'),
        t('editAsText.formatHelpLines.youthVersesComment'),
        t('editAsText.formatHelpLines.youthVerses'),
        t('editAsText.formatHelpLines.sceneComment'),
        t('editAsText.formatHelpLines.scene'),
      ]
      const songSuffix = t('editAsText.formatHelpLines.songSuffix')
      const generatedText = generateScheduleText(currentItems, {
        formatHelpLines,
        songSuffix,
      })
      setText(generatedText)
      setModalState('editing')
      setMissingSongs([])
      setParsedItems([])
      setValidationErrors([])
    }
  }, [isOpen, currentItems, t])

  // Handle dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
      // Focus textarea after modal opens
      setTimeout(() => textareaRef.current?.focus(), 100)
    } else {
      dialog.close()
    }
  }, [isOpen])

  // Parse text as user types
  const parseResult = useMemo(() => {
    return parseScheduleText(text)
  }, [text])

  const handleClose = () => {
    setText('')
    setModalState('editing')
    setMissingSongs([])
    setValidationErrors([])
    onClose()
  }

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    // Only close if both mousedown and click happened on the backdrop
    // This prevents closing when selecting text and dragging outside the dialog
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
      handleClose()
    }
  }

  const handleApply = async () => {
    if (!scheduleId || parseResult.errors.length > 0) return

    setModalState('processing')
    setParsedItems(parseResult.items)

    try {
      // Find missing songs - parallel search
      const songItems = parseResult.items.filter((item) => item.type === 'song')

      // Search all songs in parallel
      const searchResults = await Promise.all(
        songItems.map(async (item) => {
          const results = await searchSongs(item.content)
          const exactMatch = results.find(
            (r) => r.title.toLowerCase() === item.content.toLowerCase(),
          )
          return { item, exactMatch }
        }),
      )

      // Build missing songs list and cache found songs
      const missing: MissingSongItem[] = []
      const songCache = new Map<string, number>()

      for (const { item, exactMatch } of searchResults) {
        if (exactMatch) {
          songCache.set(item.content.toLowerCase(), exactMatch.id)
        } else {
          missing.push({
            title: item.content,
            lineNumber: item.lineNumber,
          })
        }
      }

      if (missing.length > 0) {
        setMissingSongs(missing)
        setModalState('resolving')
      } else {
        // No missing songs, proceed to apply with cached results
        await applyChanges(parseResult.items, [], songCache)
      }
    } catch (_error) {
      showToast(t('editAsText.messages.error'), 'error')
      setModalState('editing')
    }
  }

  const handleResolveMissingSongs = async (
    resolvedSongs: MissingSongItem[],
  ) => {
    setModalState('processing')
    // Build cache from resolved songs that selected existing songs
    const songCache = new Map<string, number>()
    for (const resolved of resolvedSongs) {
      if (resolved.resolved?.type === 'existing') {
        songCache.set(resolved.title.toLowerCase(), resolved.resolved.songId)
      }
    }
    await applyChanges(parsedItems, resolvedSongs, songCache)
  }

  const applyChanges = async (
    items: ParsedScheduleItem[],
    resolvedSongs: MissingSongItem[],
    songCache: Map<string, number> = new Map(),
  ) => {
    if (!scheduleId) return

    try {
      const processedItems: ProcessedItem[] = []
      const errors: ValidationError[] = []

      // Get Bible translation info for verse fetching
      const translationIds = await getSelectedBibleTranslationIds()
      const primaryTranslationId = translationIds[0]
      let books: Awaited<ReturnType<typeof getBooks>> = []
      let translationAbbr = 'VDCC'

      if (primaryTranslationId) {
        // Fetch books and translation in parallel
        const [booksResult, translation] = await Promise.all([
          getBooks(primaryTranslationId),
          getTranslationById(primaryTranslationId),
        ])
        books = booksResult
        translationAbbr = translation.abbreviation || 'VDCC'
      }

      // Collect songs that need to be created
      const songsToCreate: { content: string; index: number }[] = []

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx]
        if (item.type === 'song') {
          // Check cache first
          const cachedId = songCache.get(item.content.toLowerCase())
          if (cachedId) {
            processedItems.push({ type: 'song', songId: cachedId })
            continue
          }

          // Check if it was resolved
          const resolved = resolvedSongs.find(
            (r) => r.title === item.content && r.resolved,
          )

          if (resolved?.resolved) {
            if (resolved.resolved.type === 'existing') {
              processedItems.push({
                type: 'song',
                songId: resolved.resolved.songId,
              })
            } else if (resolved.resolved.type === 'create') {
              // Mark for batch creation
              songsToCreate.push({ content: item.content, index: idx })
              processedItems.push({ type: 'song' }) // Placeholder
            }
          } else {
            // Song should be in cache, skip if not found
            processedItems.push({ type: 'song' }) // Placeholder for skipped
          }
        } else if (item.type === 'announcement') {
          processedItems.push({
            type: 'slide',
            slideType: 'announcement',
            slideContent: `<p>${escapeHtml(item.content)}</p>`,
          })
        } else if (item.type === 'bible_passage') {
          // V: prefix - Bible passage (create proper bible_passage item)
          if (!primaryTranslationId || books.length === 0) {
            errors.push({
              lineNumber: item.lineNumber,
              type: 'bible_passage',
              content: item.content,
              message: t('editAsText.errors.noBibleTranslation'),
            })
            continue
          }

          const parsed = parsePassageRange({
            input: item.content,
            books,
          })

          if (
            parsed.status === 'valid' &&
            parsed.bookCode &&
            parsed.bookName &&
            parsed.startChapter &&
            parsed.startVerse &&
            parsed.endChapter &&
            parsed.endVerse
          ) {
            // Create proper bible_passage item
            processedItems.push({
              type: 'slide', // Will be converted to bible_passage on server
              biblePassage: {
                translationId: primaryTranslationId,
                translationAbbreviation: translationAbbr,
                bookCode: parsed.bookCode,
                bookName: parsed.bookName,
                startChapter: parsed.startChapter,
                startVerse: parsed.startVerse,
                endChapter: parsed.endChapter,
                endVerse: parsed.endVerse,
              },
            })
          } else {
            // Invalid reference - track error
            errors.push({
              lineNumber: item.lineNumber,
              type: 'bible_passage',
              content: item.content,
              message: t('editAsText.errors.invalidBibleReference'),
            })
          }
        } else if (item.type === 'versete_tineri') {
          // VT: prefix - Versete Tineri (supports multiple entries: "Name1 - Ref1, Name2 - Ref2")
          if (!primaryTranslationId || books.length === 0) {
            errors.push({
              lineNumber: item.lineNumber,
              type: 'versete_tineri',
              content: item.content,
              message: t('editAsText.errors.noBibleTranslation'),
            })
            continue
          }

          // Split by comma to get multiple entries
          const entries = item.content.split(',').map((e) => e.trim())
          const vtEntries: VerseteTineriEntryInput[] = []
          const invalidEntries: string[] = []

          for (const entryText of entries) {
            // Parse format: "PersonName - Reference"
            const vtMatch = entryText.match(/^(.+?)\s*[-–—]\s*(.+)$/)

            if (!vtMatch) {
              invalidEntries.push(entryText)
              continue
            }

            const personName = vtMatch[1].trim()
            const reference = vtMatch[2].trim()

            const parsed = parsePassageRange({
              input: reference,
              books,
            })

            if (
              parsed.status === 'valid' &&
              parsed.bookCode &&
              parsed.bookName &&
              parsed.startChapter &&
              parsed.startVerse &&
              parsed.endChapter &&
              parsed.endVerse
            ) {
              vtEntries.push({
                personName,
                translationId: primaryTranslationId,
                bookCode: parsed.bookCode,
                bookName: parsed.bookName,
                startChapter: parsed.startChapter,
                startVerse: parsed.startVerse,
                endChapter: parsed.endChapter,
                endVerse: parsed.endVerse,
              })
            } else {
              invalidEntries.push(entryText)
            }
          }

          if (invalidEntries.length > 0) {
            errors.push({
              lineNumber: item.lineNumber,
              type: 'versete_tineri',
              content: invalidEntries.join(', '),
              message: t('editAsText.errors.invalidVtFormat'),
            })
          }

          if (vtEntries.length > 0) {
            // Create versete_tineri slide with valid structured entries
            processedItems.push({
              type: 'slide',
              slideType: 'versete_tineri',
              verseteTineriEntries: vtEntries,
            })
          }
        } else if (item.type === 'scene') {
          // SC: prefix - OBS Scene switch
          // The content is the scene display name
          processedItems.push({
            type: 'slide',
            slideType: 'scene',
            obsSceneName: item.content,
          })
        }
      }

      // If there are validation errors, show them and return to editing
      if (errors.length > 0) {
        setValidationErrors(errors)
        setModalState('editing')
        return
      }

      // Create songs in parallel if needed
      if (songsToCreate.length > 0) {
        const createResults = await Promise.all(
          songsToCreate.map(async ({ content, index }) => {
            const result = await upsertSong({ title: content, slides: [] })
            return { content, index, result }
          }),
        )

        // Update placeholders with created song IDs
        for (const { content, index, result } of createResults) {
          if (result.success && result.data) {
            processedItems[index] = { type: 'song', songId: result.data.id }
            showToast(
              t('editAsText.messages.songCreated', { title: content }),
              'success',
            )
          }
        }
      }

      // Filter out songs without IDs (skipped items) and track line number mapping
      const validItems: ProcessedItem[] = []
      const indexToLineNumber: Map<number, number> = new Map()

      for (let i = 0; i < processedItems.length; i++) {
        const item = processedItems[i]
        if (item.type !== 'song' || item.songId !== undefined) {
          indexToLineNumber.set(validItems.length, items[i].lineNumber)
          validItems.push(item)
        }
      }

      // Replace schedule items
      const result = await replaceScheduleItems(scheduleId, {
        items: validItems,
      })

      if (result.success) {
        // Check if any items were skipped due to missing verses
        if (result.skippedItems && result.skippedItems.length > 0) {
          const serverErrors: ValidationError[] = result.skippedItems.map(
            (skipped) => ({
              lineNumber: indexToLineNumber.get(skipped.index) ?? 0,
              type:
                skipped.type === 'bible_passage'
                  ? 'bible_passage'
                  : 'versete_tineri',
              content: skipped.reference,
              message: t('editAsText.errors.versesNotFound'),
            }),
          )
          setValidationErrors(serverErrors)
          showToast(
            t('editAsText.messages.partialSuccess', {
              count: result.skippedItems.length,
            }),
            'warning',
          )
          setModalState('editing')
        } else {
          showToast(t('editAsText.messages.applied'), 'success')
          onItemsUpdated()
          handleClose()
        }
      } else {
        showToast(result.error || t('editAsText.messages.error'), 'error')
        setModalState('editing')
      }
    } catch (_error) {
      showToast(t('editAsText.messages.error'), 'error')
      setModalState('editing')
    }
  }

  const handleCancelResolving = () => {
    setModalState('editing')
    setMissingSongs([])
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 p-0 m-auto w-full max-w-2xl bg-transparent backdrop:bg-black/50"
      onClose={handleClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('editAsText.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {modalState === 'editing' && (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('editAsText.description')}
              </p>

              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  // Clear validation errors when user edits
                  if (validationErrors.length > 0) {
                    setValidationErrors([])
                  }
                }}
                placeholder={t('editAsText.formatHelp')}
                rows={15}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono text-sm"
              />

              <div className="flex items-center justify-between text-sm">
                {parseResult.items.length > 0 && (
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {t('editAsText.preview', {
                      count: parseResult.items.length,
                    })}
                  </span>
                )}
                {parseResult.errors.length > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    {t('editAsText.errors', {
                      count: parseResult.errors.length,
                    })}
                  </span>
                )}
              </div>

              {parseResult.errors.length > 0 && (
                <div className="text-sm text-red-600 dark:text-red-400 space-y-1">
                  {parseResult.errors.map((error) => (
                    <div key={error.line}>
                      {t('editAsText.lineError', {
                        line: error.line,
                        message: error.message,
                      })}
                    </div>
                  ))}
                </div>
              )}

              {validationErrors.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
                    <AlertCircle className="w-4 h-4" />
                    <span>{t('editAsText.validationErrors')}</span>
                  </div>
                  <div className="text-sm text-amber-600 dark:text-amber-300 space-y-1">
                    {validationErrors.map((error, idx) => (
                      <div key={`${error.lineNumber}-${idx}`}>
                        {t('editAsText.lineError', {
                          line: error.lineNumber,
                          message: error.message,
                        })}{' '}
                        <span className="font-mono text-amber-800 dark:text-amber-200">
                          "{error.content}"
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {modalState === 'resolving' && (
            <MissingSongResolver
              missingSongs={missingSongs}
              onResolve={handleResolveMissingSongs}
              onCancel={handleCancelResolving}
            />
          )}

          {modalState === 'processing' && (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-gray-600 dark:text-gray-400">
                {t('editAsText.processing')}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        {modalState === 'editing' && (
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('editAsText.cancel')}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={
                parseResult.items.length === 0 ||
                parseResult.errors.length > 0 ||
                !scheduleId
              }
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('editAsText.save')}
            </button>
          </div>
        )}
      </div>
    </dialog>
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
