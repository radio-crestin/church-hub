import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { isMobile } from '~/config'
import { useToast } from '~/ui/toast'
import { createLogger } from '~/utils/logger'
import { usePresentationState } from '../../hooks/usePresentationState'
import { isTauri } from '../../utils/openDisplayWindow'
import {
  CAPTURE_ENDED_EVENT,
  startNativeCapture,
  stopNativeCapture,
} from '../service/nativeCapture'
import {
  startScreenShareSession,
  stopScreenShareSession,
} from '../service/screenShareApi'
import { startBrowserCapture } from '../utils/startBrowserCapture'

const logger = createLogger('app:screen-share')

/** How this operator captures: natively (desktop app) or with the browser. */
type CaptureMode = 'native' | 'browser'

interface ScreenShareContextValue {
  /** The share is on the screens (started from any operator). */
  isLive: boolean
  /** This operator is the one capturing. */
  isSharingHere: boolean
  isStarting: boolean
  pickerOpen: boolean
  /** Opens the source picker (desktop app) or the browser's share dialog. */
  requestStart: () => void
  closePicker: () => void
  /** Starts sharing a source from the picker. */
  startSource: (sourceId: string) => Promise<void>
  stop: () => Promise<void>
}

const ScreenShareContext = createContext<ScreenShareContextValue | null>(null)

export function ScreenShareProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('presentation')
  const { showToast } = useToast()
  const { data: presentation } = usePresentationState()
  const isLive = presentation?.temporaryContent?.type === 'screen_share'
  const nativeAvailable = isTauri() && !isMobile()

  const [mode, setMode] = useState<CaptureMode | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const stopBrowserRef = useRef<(() => void) | null>(null)
  // Set once the screens show this operator's share: from then on, the share
  // leaving the screens (other content, another operator) stops the capture.
  const seenLiveRef = useRef(false)

  const stopLocalCapture = useCallback(async () => {
    seenLiveRef.current = false
    stopBrowserRef.current?.()
    stopBrowserRef.current = null
    if (nativeAvailable) {
      await stopNativeCapture().catch((error) =>
        logger.error('Native capture did not stop', error),
      )
    }
    setMode(null)
  }, [nativeAvailable])

  const fail = useCallback(
    async (error: unknown) => {
      logger.error('Screen share failed', error)
      await stopLocalCapture()
      await stopScreenShareSession().catch(() => {})
      const denied =
        error instanceof DOMException && error.name === 'NotAllowedError'
      if (!denied) {
        showToast(t('controlRoom.screenShare.error.failed'), 'error')
      }
    },
    [showToast, stopLocalCapture, t],
  )

  const stop = useCallback(async () => {
    await stopLocalCapture()
    try {
      await stopScreenShareSession()
    } catch (error) {
      logger.error('Screen share stop failed', error)
      showToast(t('controlRoom.screenShare.error.failed'), 'error')
    }
  }, [showToast, stopLocalCapture, t])

  const startBrowser = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      showToast(t('controlRoom.screenShare.error.notSupported'), 'error')
      return
    }
    setIsStarting(true)
    try {
      const token = await startScreenShareSession()
      stopBrowserRef.current = await startBrowserCapture(token, () => {
        void stop()
      })
      setMode('browser')
    } catch (error) {
      await fail(error)
    } finally {
      setIsStarting(false)
    }
  }, [fail, showToast, stop, t])

  const startSource = useCallback(
    async (sourceId: string) => {
      setPickerOpen(false)
      setIsStarting(true)
      try {
        const token = await startScreenShareSession()
        await startNativeCapture(sourceId, token)
        setMode('native')
      } catch (error) {
        await fail(error)
      } finally {
        setIsStarting(false)
      }
    },
    [fail],
  )

  const requestStart = useCallback(() => {
    if (nativeAvailable) setPickerOpen(true)
    else void startBrowser()
  }, [nativeAvailable, startBrowser])

  // Other content replaced the share on the screens: stop capturing.
  useEffect(() => {
    if (!mode) return
    if (isLive) {
      seenLiveRef.current = true
    } else if (seenLiveRef.current) {
      logger.info('The share left the screens: stopping the capture')
      void stopLocalCapture()
    }
  }, [isLive, mode, stopLocalCapture])

  // The shared window was closed or the screen unplugged.
  useEffect(() => {
    if (!nativeAvailable) return
    let unlisten: (() => void) | undefined
    let cancelled = false
    void import('@tauri-apps/api/event').then(({ listen }) =>
      listen<string>(CAPTURE_ENDED_EVENT, (event) => {
        logger.warn(`The shared source went away: ${event.payload}`)
        void stop()
      }).then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      }),
    )
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [nativeAvailable, stop])

  const value = useMemo<ScreenShareContextValue>(
    () => ({
      isLive,
      isSharingHere: mode !== null,
      isStarting,
      pickerOpen,
      requestStart,
      closePicker: () => setPickerOpen(false),
      startSource,
      stop,
    }),
    [isLive, mode, isStarting, pickerOpen, requestStart, startSource, stop],
  )

  return (
    <ScreenShareContext.Provider value={value}>
      {children}
    </ScreenShareContext.Provider>
  )
}

export function useScreenShare() {
  const context = useContext(ScreenShareContext)
  if (!context) {
    throw new Error('useScreenShare must be used within a ScreenShareProvider')
  }
  return context
}
