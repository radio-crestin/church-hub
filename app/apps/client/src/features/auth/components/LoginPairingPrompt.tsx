import { KeyRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface PairingRequest {
  id: string
  userName: string
  code: string
  requesterIp: string
  expiresAt: number
}

type PairingMessage =
  | { type: 'login_pairing_request'; payload: PairingRequest }
  | { type: 'login_pairing_closed'; payload: { id: string } }

/**
 * Shows, on the Church Hub computer, the code another device on the LAN must
 * type to sign in to a passwordless account. The server sends it only to this
 * machine's own sockets (relayed by WebSocketContext as
 * `login-pairing-message`); it closes once used, expired or dismissed.
 */
export function LoginPairingPrompt() {
  const { t } = useTranslation('users')
  const [request, setRequest] = useState<PairingRequest | null>(null)
  const [now, setNow] = useState(Date.now())
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    function onMessage(event: Event) {
      const message = (event as CustomEvent<PairingMessage>).detail
      if (message.type === 'login_pairing_request') {
        setNow(Date.now())
        setRequest(message.payload)
      } else {
        setRequest((current) =>
          current?.id === message.payload.id ? null : current,
        )
      }
    }
    window.addEventListener('login-pairing-message', onMessage)
    return () => window.removeEventListener('login-pairing-message', onMessage)
  }, [])

  useEffect(() => {
    if (!request) return
    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= request.expiresAt) setRequest(null)
    }, 1000)
    return () => clearInterval(timer)
  }, [request])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (request && !dialog.open) dialog.showModal()
    if (!request && dialog.open) dialog.close()
  }, [request])

  const seconds = request
    ? Math.max(0, Math.ceil((request.expiresAt - now) / 1000))
    : 0

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="login-pairing-title"
      onClose={() => setRequest(null)}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-line bg-panel p-0 shadow-popover backdrop:bg-black/50"
    >
      {request ? (
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex items-center justify-center text-fg-label">
            <KeyRound strokeWidth={1.5} className="h-6 w-6" />
          </div>
          <h2
            id="login-pairing-title"
            className="text-base font-semibold text-fg"
          >
            {t('pairing.title')}
          </h2>
          <p className="text-sm text-fg-label">
            {t('pairing.description', {
              name: request.userName,
              ip: request.requesterIp,
            })}
          </p>
          <p
            data-testid="login-pairing-code"
            className="font-mono text-4xl font-semibold tabular-nums tracking-[0.3em] text-fg"
          >
            {request.code}
          </p>
          <p className="text-xs text-fg-hint">
            {t('pairing.expires', { seconds })}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t('pairing.warning')}
          </p>
          <button
            type="button"
            onClick={() => setRequest(null)}
            className="h-9 w-full rounded-lg bg-field px-4 text-sm font-medium text-fg transition-colors hover:bg-hover"
          >
            {t('pairing.dismiss')}
          </button>
        </div>
      ) : null}
    </dialog>
  )
}
