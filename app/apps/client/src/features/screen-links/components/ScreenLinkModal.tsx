import { Copy, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useQRCode } from '~/features/users/hooks'
import { Button } from '~/ui/button/Button'
import { useToast } from '~/ui/toast'
import { createLogger } from '~/utils/logger'
import { type ScreenLinkWay, ScreenLinkWays } from './ScreenLinkWays'
import { canHostScreens } from '../service/screenHost'
import {
  type MadeScreenLink,
  makeScreenLink,
  revokeScreenLink,
} from '../service/screenLinkApi'

const logger = createLogger('screen-links')

interface ScreenLinkModalProps {
  screenId: number
  screenName: string
  onClose: () => void
}

/**
 * "Show on another device" (T-214): a new link to this screen, as a QR code
 * and text, that a TV or laptop opens; it is shown from this phone while
 * the church PC is off. Revoking it cuts that device off.
 */
export function ScreenLinkModal({
  screenId,
  screenName,
  onClose,
}: ScreenLinkModalProps) {
  const { t, i18n } = useTranslation('settings')
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [link, setLink] = useState<MadeScreenLink | null>(null)
  const [failed, setFailed] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [way, setWay] = useState<ScreenLinkWay>('network')
  const [address, setAddress] = useState('')
  const url =
    way === 'internet'
      ? (link?.internet ?? null)
      : (link?.network.find((choice) => choice.address === address)?.url ??
        null)
  const { qrDataUrl } = useQRCode(url)
  const onPhone = canHostScreens()

  useEffect(() => {
    dialogRef.current?.showModal()
    makeScreenLink(screenId).then(
      (made) => {
        setLink(made)
        // Directly on the church network, unless there is none (a phone).
        setWay(made.network.length > 0 ? 'network' : 'internet')
        setAddress(made.network[0]?.address ?? '')
      },
      (error) => {
        logger.error('Screen link not made', error)
        setFailed(true)
      },
    )
  }, [screenId])

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      showToast(t('sections.screens.link.copied'), 'success')
    } catch (error) {
      logger.warn('Screen link not copied', error)
      showToast(t('sections.screens.toast.copyError'), 'error')
    }
  }

  const revoke = async () => {
    if (!link) return
    setRevoking(true)
    try {
      await revokeScreenLink(link.id)
      showToast(t('sections.screens.link.revoked'), 'success')
      onClose()
    } catch (error) {
      logger.error('Screen link not revoked', error)
      showToast(t('sections.screens.link.revokeError'), 'error')
      setRevoking(false)
    }
  }

  const until = link
    ? new Date(link.expiresAt).toLocaleString(i18n.language, {
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <dialog
      ref={dialogRef}
      data-testid="screen-link-modal"
      aria-labelledby="screen-link-title"
      className="fixed inset-0 m-auto p-0 rounded-xl border border-line shadow-popover backdrop:bg-black/50 bg-panel w-[calc(100%-2rem)] max-w-sm"
      onClose={onClose}
    >
      <div className="p-5 flex flex-col gap-4">
        <div>
          <h2
            id="screen-link-title"
            className="text-base font-semibold text-fg"
          >
            {t('sections.screens.link.title', { name: screenName })}
          </h2>
          <p className="mt-1 text-sm text-fg-label">
            {t('sections.screens.link.description')}
            {onPhone && ` ${t('sections.screens.link.phoneNote')}`}
          </p>
        </div>

        {failed ? (
          <p className="text-sm text-fg" role="alert">
            {t('sections.screens.link.error')}
          </p>
        ) : !link ? (
          <div className="flex items-center gap-2 text-sm text-fg-label">
            <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
            {t('sections.screens.link.making')}
          </div>
        ) : (
          <>
            {!link.internet && link.network.length === 0 && (
              <p
                className="text-sm text-fg"
                data-testid="screen-link-internet-off"
              >
                {t('sections.screens.link.internetOff')}
              </p>
            )}
            {url && qrDataUrl && (
              <img
                src={qrDataUrl}
                alt={t('sections.screens.link.qrAlt')}
                className="self-center w-48 h-48 rounded-lg bg-white"
              />
            )}
            {url && (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url}
                  aria-label={t('sections.screens.link.urlLabel')}
                  data-testid="screen-link-url"
                  onFocus={(event) => event.currentTarget.select()}
                  className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-field text-sm text-fg border border-line"
                />
                <Button variant="secondary" onClick={copy}>
                  <Copy size={16} strokeWidth={1.5} />
                  {t('sections.screens.link.copy')}
                </Button>
              </div>
            )}
            <p className="text-xs text-fg-hint">
              {t('sections.screens.link.until', { time: until })}
            </p>
            {link.network.length > 0 && (
              <ScreenLinkWays
                way={way}
                onWay={setWay}
                hasInternet={link.internet !== null}
                addresses={link.network.map((choice) => choice.address)}
                address={address}
                onAddress={setAddress}
              />
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-line">
          {link && (
            <Button variant="outline" onClick={revoke} disabled={revoking}>
              {t('sections.screens.link.revoke')}
            </Button>
          )}
          <Button onClick={onClose}>{t('common:buttons.done')}</Button>
        </div>
      </div>
    </dialog>
  )
}
