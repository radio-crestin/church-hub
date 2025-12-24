import { useNavigate } from '@tanstack/react-router'
import { invoke } from '@tauri-apps/api/core'
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

import { useUpsertSong } from '~/features/songs/hooks'
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

  // Handle file association - check on mount if app was opened with a PPTX file
  // This only works in Tauri desktop mode
  useEffect(() => {
    const isTauri =
      typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
    if (!isTauri) return

    async function checkPendingImport() {
      try {
        const filePath = await invoke<string | null>('get_pending_import')

        if (filePath && filePath.toLowerCase().endsWith('.pptx')) {
          // Read the file using Tauri FS plugin
          const fileData = await readFile(filePath)
          const parsed = await parsePptxFile(fileData.buffer, filePath)

          await importPptxAsSong(parsed, filePath)
        }
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: error logging
        console.error('[pptx-import] Failed to handle pending import:', error)
      }
    }

    checkPendingImport()
  }, [importPptxAsSong])

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
      const pptxFile = files.find((f) => f.name.toLowerCase().endsWith('.pptx'))

      if (pptxFile) {
        try {
          const parsed = await parsePptxFile(pptxFile)
          // Try to get the file path (available in Tauri)
          // @ts-expect-error - path property may be available in Tauri
          const filePath = pptxFile.path as string | undefined
          await importPptxAsSong(parsed, filePath || null)
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: error logging
          console.error('[pptx-import] Failed to parse PPTX:', error)
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
  }, [importPptxAsSong])

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
