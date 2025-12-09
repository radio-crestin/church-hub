import { invoke } from '@tauri-apps/api/core'
import { readFile } from '@tauri-apps/plugin-fs'
import { useCallback, useEffect } from 'react'

import { type ParsedPptx, parsePptxFile } from '../utils/parsePptx'

interface UseFileAssociationHandlerProps {
  onPptxOpened: (parsedPptx: ParsedPptx, filePath: string) => void
}

/**
 * Hook to handle file association events (when app is opened with a PPTX file)
 */
export function useFileAssociationHandler({
  onPptxOpened,
}: UseFileAssociationHandlerProps) {
  const checkPendingImport = useCallback(async () => {
    try {
      const filePath = await invoke<string | null>('get_pending_import')

      if (filePath && filePath.toLowerCase().endsWith('.pptx')) {
        // Read the file using Tauri FS plugin
        const fileData = await readFile(filePath)
        const parsed = await parsePptxFile(fileData.buffer)

        onPptxOpened(parsed, filePath)
      }
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: error logging
      console.error('[pptx-import] Failed to handle pending import:', error)
    }
  }, [onPptxOpened])

  useEffect(() => {
    checkPendingImport()
  }, [checkPendingImport])
}
