import { Loader2, MonitorOff, MonitorPlay } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { SourcePickerDialog } from './SourcePickerDialog'
import { useScreenShare } from '../context/ScreenShareContext'

/** The Control Room's Share / Stop button; any operator can stop a share. */
export function ScreenShareButton() {
  const { t } = useTranslation('presentation')
  const {
    isLive,
    isSharingHere,
    isStarting,
    pickerOpen,
    requestStart,
    closePicker,
    startSource,
    stop,
  } = useScreenShare()

  return (
    <>
      {isLive || isSharingHere ? (
        <Button
          variant="danger"
          onClick={() => void stop()}
          aria-label={t('controlRoom.screenShare.stop')}
          className="gap-2"
        >
          <MonitorOff className="w-4 h-4" />
          <span className="hidden sm:inline">
            {t('controlRoom.screenShare.stop')}
          </span>
        </Button>
      ) : (
        <Button
          variant="secondary"
          onClick={requestStart}
          disabled={isStarting}
          aria-label={t('controlRoom.screenShare.start')}
          className="gap-2"
        >
          {isStarting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MonitorPlay className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">
            {t('controlRoom.screenShare.start')}
          </span>
        </Button>
      )}
      <SourcePickerDialog
        isOpen={pickerOpen}
        onClose={closePicker}
        onPick={(sourceId) => void startSource(sourceId)}
      />
    </>
  )
}
