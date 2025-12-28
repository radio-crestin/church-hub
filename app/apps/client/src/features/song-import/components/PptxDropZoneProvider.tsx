import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { readFile } from '@tauri-apps/plugin-fs'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { parseChurchProgram } from '~/features/schedule-import'
import {
  addItemToSchedule,
  upsertSchedule,
} from '~/features/schedules/service/schedules'
import { useUpsertSong } from '~/features/songs/hooks'
import { getSongById, searchSongs, upsertSong } from '~/features/songs/service'
import type { SlideInput } from '~/features/songs/types'
import { parseOpenSongXml } from '../utils/parseOpenSong'
import { type ParsedPptx, parsePptxFile } from '../utils/parsePptx'

interface PptxDropZoneContextValue {
  isDragging: boolean
}

const PptxDropZoneContext = createContext<PptxDropZoneContextValue>({
  isDragging: false,
})

export function usePptxDropZone() {
  return useContext(PptxDropZoneContext)
}

interface Props {
  children: ReactNode
}

export function PptxDropZoneProvider({ children }: Props) {
  const { t } = useTranslation('songs')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)
  const upsertMutation = useUpsertSong()

  // Direct import function
  const importPptxAsSong = useCallback(
    async (parsed: ParsedPptx, sourceFilename: string | null) => {
      const result = await upsertMutation.mutateAsync({
        title: parsed.title,
        sourceFilename,
        slides: parsed.slides.map((slide, idx) => ({
          content: slide.htmlContent,
          sortOrder: idx,
        })),
      })

      if (result.success && result.data) {
        navigate({
          to: '/songs/$songId',
          params: { songId: String(result.data.id) },
        })
      }
    },
    [navigate, upsertMutation],
  )

  // Handle OpenSong file import
  const handleOpenSongFile = useCallback(
    async (content: string, filePath: string) => {
      const parsed = parseOpenSongXml(content, filePath)

      // Check if we have a church_hub_id to match
      if (parsed.metadata?.churchHubId) {
        const existingSong = await getSongById(parsed.metadata.churchHubId)
        if (existingSong && existingSong.title === parsed.title) {
          // Navigate to existing song
          navigate({
            to: '/songs/$songId',
            params: { songId: String(existingSong.id) },
          })
          return
        }
      }

      // Import as new song
      const result = await upsertMutation.mutateAsync({
        title: parsed.title,
        sourceFilename: filePath,
        author: parsed.metadata?.author,
        copyright: parsed.metadata?.copyright,
        ccli: parsed.metadata?.ccli,
        key: parsed.metadata?.key,
        tempo: parsed.metadata?.tempo,
        timeSignature: parsed.metadata?.timeSignature,
        theme: parsed.metadata?.theme,
        altTheme: parsed.metadata?.altTheme,
        hymnNumber: parsed.metadata?.hymnNumber,
        keyLine: parsed.metadata?.keyLine,
        presentationOrder: parsed.metadata?.presentationOrder,
        slides: parsed.slides.map((slide, idx) => ({
          content: slide.htmlContent,
          sortOrder: idx,
          label: slide.label,
        })),
      })

      if (result.success && result.data) {
        navigate({
          to: '/songs/$songId',
          params: { songId: String(result.data.id) },
        })
      }
    },
    [navigate, upsertMutation],
  )

  // Handle Church Program file import
  const handleChurchProgramFile = useCallback(
    async (content: string) => {
      const parseResult = parseChurchProgram(content)
      if (!parseResult.success || !parseResult.data) {
        // biome-ignore lint/suspicious/noConsole: error logging
        console.error(
          '[file-import] Failed to parse church program:',
          parseResult.error,
        )
        return
      }

      const programData = parseResult.data

      // Create the schedule
      const scheduleResult = await upsertSchedule({
        title: programData.schedule.title,
        description: programData.schedule.description,
      })

      if (!scheduleResult.success || !scheduleResult.data) {
        // biome-ignore lint/suspicious/noConsole: error logging
        console.error(
          '[file-import] Failed to create schedule:',
          scheduleResult.error,
        )
        return
      }

      const scheduleId = scheduleResult.data.id

      // Process items in order
      for (const item of programData.items.sort(
        (a, b) => a.sortOrder - b.sortOrder,
      )) {
        if (item.itemType === 'slide') {
          await addItemToSchedule(scheduleId, {
            slideType: item.slideType,
            slideContent: item.slideContent,
          })
        } else if (item.itemType === 'song' && item.song) {
          // Search for existing song by title
          const searchResults = await searchSongs(item.song.title)
          const exactMatch = searchResults.find(
            (s) => s.title.toLowerCase() === item.song!.title.toLowerCase(),
          )

          let songId: number

          if (exactMatch) {
            songId = exactMatch.id
          } else {
            // Create new song
            const slides: SlideInput[] = item.song.slides.map((slide) => ({
              content: slide.content,
              sortOrder: slide.sortOrder,
              label: slide.label,
            }))

            const songResult = await upsertSong({
              title: item.song.title,
              author: item.song.author,
              copyright: item.song.copyright,
              ccli: item.song.ccli,
              key: item.song.key,
              tempo: item.song.tempo,
              slides,
            })

            if (!songResult.success || !songResult.data) {
              // biome-ignore lint/suspicious/noConsole: error logging
              console.error(
                '[file-import] Failed to create song:',
                item.song.title,
              )
              continue
            }

            songId = songResult.data.id
          }

          await addItemToSchedule(scheduleId, { songId })
        }
      }

      // Invalidate queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
      await queryClient.invalidateQueries({ queryKey: ['songs'] })

      // Navigate to the new schedule
      navigate({
        to: '/schedules/$scheduleId',
        params: { scheduleId: String(scheduleId) },
      })
    },
    [navigate, queryClient],
  )

  // Handle file association - check on mount if app was opened with a PPTX file
  // This only works in Tauri desktop mode
  useEffect(() => {
    const isTauri =
      typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
    if (!isTauri) return

    async function checkPendingImport() {
      try {
        const filePath = await invoke<string | null>('get_pending_import')
        if (!filePath) return

        const lowerPath = filePath.toLowerCase()

        if (lowerPath.endsWith('.pptx')) {
          const fileData = await readFile(filePath)
          const parsed = await parsePptxFile(fileData.buffer, filePath)
          await importPptxAsSong(parsed, filePath)
        } else if (lowerPath.endsWith('.opensong')) {
          const fileData = await readFile(filePath)
          const decoder = new TextDecoder()
          const content = decoder.decode(fileData)
          await handleOpenSongFile(content, filePath)
        } else if (lowerPath.endsWith('.churchprogram')) {
          const fileData = await readFile(filePath)
          const decoder = new TextDecoder()
          const content = decoder.decode(fileData)
          await handleChurchProgramFile(content)
        }
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: error logging
        console.error('[file-import] Failed to handle pending import:', error)
      }
    }

    checkPendingImport()
  }, [importPptxAsSong, handleOpenSongFile, handleChurchProgramFile])

  // Listen for file-opened events (when app is already running and file is opened)
  useEffect(() => {
    const isTauri =
      typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
    if (!isTauri) return

    let unlisten: UnlistenFn | undefined

    async function setupListener() {
      unlisten = await listen<string>('file-opened', async (event) => {
        const filePath = event.payload
        // biome-ignore lint/suspicious/noConsole: debug logging
        console.log('[file-import] Received file-opened event:', filePath)

        const lowerPath = filePath.toLowerCase()

        try {
          if (lowerPath.endsWith('.pptx')) {
            const fileData = await readFile(filePath)
            const parsed = await parsePptxFile(fileData.buffer, filePath)
            await importPptxAsSong(parsed, filePath)
          } else if (lowerPath.endsWith('.opensong')) {
            const fileData = await readFile(filePath)
            const decoder = new TextDecoder()
            const content = decoder.decode(fileData)
            await handleOpenSongFile(content, filePath)
          } else if (lowerPath.endsWith('.churchprogram')) {
            const fileData = await readFile(filePath)
            const decoder = new TextDecoder()
            const content = decoder.decode(fileData)
            await handleChurchProgramFile(content)
          }
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: error logging
          console.error(
            '[file-import] Failed to handle file-opened event:',
            error,
          )
        }
      })
    }

    setupListener()

    return () => {
      unlisten?.()
    }
  }, [importPptxAsSong, handleOpenSongFile, handleChurchProgramFile])

  // Use document-level event listeners for reliable drag and drop
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current++

      if (e.dataTransfer?.items) {
        const hasFile = Array.from(e.dataTransfer.items).some(
          (item) => item.kind === 'file',
        )
        if (hasFile) {
          setIsDragging(true)
        }
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      // Required to allow drop
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current--

      // Only hide when all drag events have left (counter reaches 0)
      if (dragCounterRef.current === 0) {
        setIsDragging(false)
      }
    }

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDragging(false)

      if (!e.dataTransfer?.files) return

      const files = Array.from(e.dataTransfer.files)

      // Handle PPTX files
      const pptxFile = files.find((f) => f.name.toLowerCase().endsWith('.pptx'))
      if (pptxFile) {
        try {
          const parsed = await parsePptxFile(pptxFile)
          // @ts-expect-error - path property may be available in Tauri
          const filePath = pptxFile.path as string | undefined
          await importPptxAsSong(parsed, filePath || null)
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: error logging
          console.error('[file-import] Failed to parse PPTX:', error)
        }
        return
      }

      // Handle OpenSong files
      const opensongFile = files.find((f) =>
        f.name.toLowerCase().endsWith('.opensong'),
      )
      if (opensongFile) {
        try {
          const content = await opensongFile.text()
          // @ts-expect-error - path property may be available in Tauri
          const filePath = (opensongFile.path as string) || opensongFile.name
          await handleOpenSongFile(content, filePath)
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: error logging
          console.error('[file-import] Failed to parse OpenSong:', error)
        }
        return
      }

      // Handle Church Program files
      const churchProgramFile = files.find((f) =>
        f.name.toLowerCase().endsWith('.churchprogram'),
      )
      if (churchProgramFile) {
        try {
          const content = await churchProgramFile.text()
          await handleChurchProgramFile(content)
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: error logging
          console.error('[file-import] Failed to parse Church Program:', error)
        }
      }
    }

    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)

    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDrop)
    }
  }, [importPptxAsSong, handleOpenSongFile, handleChurchProgramFile])

  return (
    <PptxDropZoneContext.Provider value={{ isDragging }}>
      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-indigo-500/20 border-4 border-dashed border-indigo-500 pointer-events-none flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-xl">
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('pptxImport.dropHint')}
            </p>
          </div>
        </div>
      )}
    </PptxDropZoneContext.Provider>
  )
}
