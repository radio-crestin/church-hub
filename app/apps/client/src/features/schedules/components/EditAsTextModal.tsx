import { FileText, Loader2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getSelectedBibleTranslationIds } from '~/service/bible/bible'
import { useToast } from '~/ui/toast'
import { MissingSongResolver } from './MissingSongResolver'
import { getBooks } from '../../bible/service/bible'
import { parsePassageRange } from '../../bible/utils/parsePassageRange'
import { searchSongs, upsertSong } from '../../songs/service/songs'
import { replaceScheduleItems } from '../service/schedules'
import type { MissingSongItem, ScheduleItem, SlideTemplate } from '../types'
import { generateScheduleText } from '../utils/generateScheduleText'
import type { ParsedScheduleItem } from '../utils/parseScheduleText'
import { parseScheduleText } from '../utils/parseScheduleText'

interface EditAsTextModalProps {
  isOpen: boolean
  onClose: () => void
  scheduleId: number | null
  currentItems: ScheduleItem[]
  onItemsUpdated: () => void
}

type ModalState = 'editing' | 'resolving' | 'processing'

interface ProcessedItem {
  type: 'song' | 'slide'
  songId?: number
  slideType?: SlideTemplate
  slideContent?: string
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

  const [text, setText] = useState('')
  const [modalState, setModalState] = useState<ModalState>('editing')
  const [missingSongs, setMissingSongs] = useState<MissingSongItem[]>([])
  const [parsedItems, setParsedItems] = useState<ParsedScheduleItem[]>([])

  // Initialize text from current items when modal opens
  useEffect(() => {
    if (isOpen) {
      const generatedText = generateScheduleText(currentItems)
      setText(generatedText)
      setModalState('editing')
      setMissingSongs([])
      setParsedItems([])
    }
  }, [isOpen, currentItems])

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
    onClose()
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      handleClose()
    }
  }

  const handleApply = async () => {
    if (!scheduleId || parseResult.errors.length > 0) return

    setModalState('processing')
    setParsedItems(parseResult.items)

    try {
      // Find missing songs
      const songItems = parseResult.items.filter((item) => item.type === 'song')
      const missing: MissingSongItem[] = []

      for (const item of songItems) {
        const results = await searchSongs(item.content)
        // Check if exact match exists (case-insensitive)
        const exactMatch = results.find(
          (r) => r.title.toLowerCase() === item.content.toLowerCase(),
        )

        if (!exactMatch) {
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
        // No missing songs, proceed to apply
        await applyChanges(parseResult.items, [])
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
    await applyChanges(parsedItems, resolvedSongs)
  }

  const applyChanges = async (
    items: ParsedScheduleItem[],
    resolvedSongs: MissingSongItem[],
  ) => {
    if (!scheduleId) return

    try {
      const processedItems: ProcessedItem[] = []

      // Get Bible translation info for verse fetching
      const translationIds = await getSelectedBibleTranslationIds()
      const primaryTranslationId = translationIds[0]
      let books: Awaited<ReturnType<typeof getBooks>> = []

      if (primaryTranslationId) {
        books = await getBooks(primaryTranslationId)
      }

      for (const item of items) {
        if (item.type === 'song') {
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
              // Create new song
              const result = await upsertSong({
                title: item.content,
                slides: [],
              })
              if (result.success && result.data) {
                showToast(
                  t('editAsText.messages.songCreated', {
                    title: item.content,
                  }),
                  'success',
                )
                processedItems.push({
                  type: 'song',
                  songId: result.data.id,
                })
              }
            }
          } else {
            // Search for exact match
            const results = await searchSongs(item.content)
            const exactMatch = results.find(
              (r) => r.title.toLowerCase() === item.content.toLowerCase(),
            )

            if (exactMatch) {
              processedItems.push({
                type: 'song',
                songId: exactMatch.id,
              })
            }
            // If no match and not resolved, skip this item
          }
        } else if (item.type === 'announcement') {
          processedItems.push({
            type: 'slide',
            slideType: 'announcement',
            slideContent: `<p>${escapeHtml(item.content)}</p>`,
          })
        } else if (item.type === 'bible_passage') {
          // V: prefix - Bible passage
          if (primaryTranslationId && books.length > 0) {
            const parsed = parsePassageRange({
              input: item.content,
              books,
            })

            if (parsed.status === 'valid' && parsed.formattedReference) {
              // Create announcement slide with Bible reference
              processedItems.push({
                type: 'slide',
                slideType: 'announcement',
                slideContent: `<p><strong>${escapeHtml(parsed.formattedReference)}</strong></p>`,
              })
            } else {
              // Invalid reference, add as announcement with the raw text
              processedItems.push({
                type: 'slide',
                slideType: 'announcement',
                slideContent: `<p>${escapeHtml(item.content)}</p>`,
              })
            }
          } else {
            // No Bible translation configured, add as announcement
            processedItems.push({
              type: 'slide',
              slideType: 'announcement',
              slideContent: `<p>${escapeHtml(item.content)}</p>`,
            })
          }
        } else if (item.type === 'versete_tineri') {
          // VT: prefix - Versete Tineri (Person Name - Reference)
          // Parse format: "PersonName - Reference"
          const vtMatch = item.content.match(/^(.+?)\s*[-–—]\s*(.+)$/)

          if (vtMatch) {
            const personName = vtMatch[1].trim()
            const reference = vtMatch[2].trim()

            // Validate reference if Bible is configured
            let formattedReference = reference
            if (primaryTranslationId && books.length > 0) {
              const parsed = parsePassageRange({
                input: reference,
                books,
              })
              if (parsed.status === 'valid' && parsed.formattedReference) {
                formattedReference = parsed.formattedReference
              }
            }

            // Create versete_tineri slide with person name and reference
            processedItems.push({
              type: 'slide',
              slideType: 'versete_tineri',
              slideContent: `<p><strong>${escapeHtml(personName)}</strong> - ${escapeHtml(formattedReference)}</p>`,
            })
          } else {
            // Invalid format, add as versete_tineri with just the content
            processedItems.push({
              type: 'slide',
              slideType: 'versete_tineri',
              slideContent: `<p>${escapeHtml(item.content)}</p>`,
            })
          }
        }
      }

      // Replace schedule items
      const result = await replaceScheduleItems(scheduleId, {
        items: processedItems,
      })

      if (result.success) {
        showToast(t('editAsText.messages.applied'), 'success')
        onItemsUpdated()
        handleClose()
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
                onChange={(e) => setText(e.target.value)}
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
                      Line {error.line}: {error.message}
                    </div>
                  ))}
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
