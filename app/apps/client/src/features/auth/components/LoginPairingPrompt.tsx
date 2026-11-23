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
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-0 shadow-xl backdrop:bg-black/50 dark:bg-gray-800"
    >
      {request ? (
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
            <KeyRound className="h-6 w-6" />
          </div>
          <h2
            id="login-pairing-title"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            {t('pairing.title')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('pairing.description', {
              name: request.userName,
              ip: request.requesterIp,
            })}
          </p>
          <p
            data-testid="login-pairing-code"
            className="font-mono text-4xl font-bold tracking-[0.3em] text-gray-900 dark:text-white"
          >
            {request.code}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('pairing.expires', { seconds })}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t('pairing.warning')}
          </p>
          <button
            type="button"
            onClick={() => setRequest(null)}
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {t('pairing.dismiss')}
          </button>
        </div>
      ) : null}
    </dialog>
  )
}
