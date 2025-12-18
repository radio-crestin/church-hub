import { AlertCircle, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isTauri } from '~/features/presentation/utils/openDisplayWindow'

import { useSidebarConfig } from '../hooks/useSidebarConfig'
import { hideCurrentWebview, showCustomPageWebview } from '../service/webviewManager'
import type { CustomPageMenuItem } from '../types'
import { transformToEmbedUrl } from '../utils/transformEmbedUrl'

interface CustomPageViewProps {
  pageId: string
}

/**
 * Component that renders a custom page embedded full-screen
 * In Tauri (default): Uses a WebviewWindow that appears over the main window
 * With useIframeEmbedding: Uses iframe (works for YouTube embed URLs, may fail for sites with X-Frame-Options)
 * In browser: Always uses iframe
 */
export function CustomPageView({ pageId }: CustomPageViewProps) {
  const { t } = useTranslation('settings')
  const { config, isLoading } = useSidebarConfig()
  const [isWebviewLoading, setIsWebviewLoading] = useState(true)
  const [webviewError, setWebviewError] = useState<string | null>(null)
  const [isInTauri] = useState(() => isTauri())

  // Find the custom page
  const page = config?.items.find(
    (item) => item.id === pageId && item.type === 'custom',
  ) as CustomPageMenuItem | undefined

  // Transform URL if needed (e.g., YouTube watch URL → embed URL)
  const embedUrl = useMemo(
    () => (page?.url ? transformToEmbedUrl(page.url) : null),
    [page?.url],
  )

  // Determine if we should use iframe (either not in Tauri, or user opted for iframe embedding)
  const shouldUseIframe = !isInTauri || page?.useIframeEmbedding

  // Reset loading state when pageId changes
  useEffect(() => {
    setIsWebviewLoading(true)
    setWebviewError(null)
  }, [pageId])

  // Hide webview when switching to iframe mode or when component unmounts
  useEffect(() => {
    if (shouldUseIframe && isInTauri) {
      // If we're using iframe in Tauri, make sure any webview is hidden
      hideCurrentWebview()
    }
  }, [shouldUseIframe, isInTauri, pageId])

  // Create/show webview in Tauri (only if not using iframe)
  useEffect(() => {
    if (!page || !isInTauri || shouldUseIframe) {
      if (!shouldUseIframe) {
        setIsWebviewLoading(false)
      }
      return
    }

    const initWebview = async () => {
      try {
        console.log('[CustomPageView] Showing webview for:', page.id, page.url)
        await showCustomPageWebview(page.id, page.url)
        setIsWebviewLoading(false)
        setWebviewError(null)
      } catch (error) {
        console.error('[CustomPageView] Error showing webview:', error)
        setWebviewError(String(error))
        setIsWebviewLoading(false)
      }
    }

    // Small delay to ensure component is mounted and any previous webview is hidden
    const timeoutId = setTimeout(initWebview, 150)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [page?.id, page?.url, isInTauri, shouldUseIframe])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="w-12 h-12 text-gray-400" />
        <p className="text-gray-600 dark:text-gray-400">
          {t('sections.sidebar.pageNotFound', {
            defaultValue: 'Page not found',
          })}
        </p>
      </div>
    )
  }

  // Use iframe when:
  // - Not in Tauri (browser)
  // - Or user opted for iframe embedding
  if (shouldUseIframe) {
    return (
      <div className="-m-4 md:-m-6 h-[calc(100%+2rem)] md:h-[calc(100%+3rem)] flex flex-col">
        <iframe
          key={`iframe-${page.id}`} // Force re-render when page changes
          src={embedUrl ?? page.url}
          title={page.title}
          className="flex-1 w-full border-0"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
          allow="clipboard-write; clipboard-read; fullscreen"
        />
      </div>
    )
  }

  // In Tauri with webview mode - show loading/error state
  // Once loaded, we render nothing - the webview covers the window
  if (!isWebviewLoading && !webviewError) {
    return null
  }

  return (
    <div className="-m-4 md:-m-6 h-[calc(100%+2rem)] md:h-[calc(100%+3rem)] flex flex-col">
      <div className="flex-1 relative bg-white dark:bg-gray-900">
        {/* Loading overlay */}
        {isWebviewLoading && !webviewError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('sections.sidebar.loadingPage', {
                  defaultValue: 'Loading page...',
                })}
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {webviewError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 gap-4 p-8">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <div className="text-center max-w-md">
              <p className="text-gray-900 dark:text-white font-medium mb-2">
                {t('sections.sidebar.loadError', {
                  defaultValue: 'Failed to load page',
                })}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {webviewError}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
