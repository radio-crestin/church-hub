import { CheckCircle2, Mail, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { posthog } from '~/posthog'
import { attachFeedbackLogs } from '../services/feedbackService'

interface SendFeedbackModalProps {
  isOpen: boolean
  onClose: () => void
}

type SubmitState = 'idle' | 'sending' | 'success' | 'error'

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

/**
 * Send-only feedback form. We don't use PostHog's built-in conversations
 * widget UI (the floating button reappears no matter how aggressively we
 * call hide()), so we render our own modal and use the JS API
 * (`posthog.conversations.sendMessage`) directly. The user types, hits
 * Send, the message becomes a PostHog support ticket; replies arrive by
 * email (we don't surface them in-app).
 *
 * When the conversations module isn't loaded (ad-blocker, slow first
 * paint, project setting off) we inline an email + WhatsApp fallback so
 * the modal never feels like a dead-end.
 */
export function SendFeedbackModal({ isOpen, onClose }: SendFeedbackModalProps) {
  const { t, i18n } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')

  // Re-checked on every open — posthog may have finished loading since
  // last open. If it's still down, we render the fallback UI.
  const conversationsAvailable = !!posthog?.conversations?.isAvailable?.()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
      setMessage('')
      setEmail('')
      setSubmitState('idle')
      // Mark any pending replies read when the user opens the panel —
      // they've acknowledged the red dot. Guard on getCurrentTicketId
      // because markAsRead throws "No ticket ID provided" otherwise.
      try {
        if (posthog?.conversations?.getCurrentTicketId?.()) {
          void posthog.conversations.markAsRead?.()
        }
      } catch {
        // ignore
      }
      // Defer focus until after showModal lays out the dialog.
      window.setTimeout(() => textareaRef.current?.focus(), 50)
    } else {
      dialog.close()
    }
  }, [isOpen])

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
      onClose()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || submitState === 'sending') return
    if (!posthog?.conversations?.isAvailable?.()) {
      setSubmitState('error')
      return
    }

    setSubmitState('sending')
    // Ship server + Tauri log tails in parallel so the maintainer has
    // them attached under the user's distinct_id by the time they triage.
    void attachFeedbackLogs()

    try {
      const userTraits: Record<string, unknown> = {}
      const trimmedEmail = email.trim()
      if (trimmedEmail) userTraits.email = trimmedEmail
      const hasExistingTicket = !!posthog.conversations.getCurrentTicketId?.()
      await posthog.conversations.sendMessage(
        trimmed,
        userTraits,
        !hasExistingTicket,
      )
      setSubmitState('success')
    } catch {
      setSubmitState('error')
    }
  }

  const getWhatsAppUrl = () => {
    const greeting =
      i18n.language === 'ro' ? 'Buna ziua [ChurchHub],' : 'Hello [ChurchHub],'
    return `https://api.whatsapp.com/send/?phone=40766338046&text=${encodeURIComponent(greeting)}`
  }

  const renderFallback = () => (
    <>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        <strong className="text-gray-900 dark:text-white block mb-1">
          {t('common:feedback.unavailableTitle')}
        </strong>
        {t('common:feedback.unavailableBody')}
      </p>
      <div className="space-y-3">
        <a
          href="mailto:iosif@radiocrestin.ro"
          className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
        >
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Mail size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('common:contact.email')}
            </p>
            <p className="text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              iosif@radiocrestin.ro
            </p>
          </div>
        </a>
        <a
          href={getWhatsAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
        >
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
            <WhatsAppIcon size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('common:contact.whatsapp')}
            </p>
            <p className="text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
              +40 766 338 046
            </p>
          </div>
        </a>
      </div>
    </>
  )

  const renderSuccess = () => (
    <div className="flex flex-col items-center text-center py-4">
      <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 mb-3">
        <CheckCircle2 size={28} />
      </div>
      <p className="text-base font-medium text-gray-900 dark:text-white mb-1">
        {t('common:feedback.success')}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {t('common:feedback.successHint')}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
      >
        {t('common:buttons.ok')}
      </button>
    </div>
  )

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t('common:feedback.placeholder')}
        required
        rows={5}
        disabled={submitState === 'sending'}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y disabled:opacity-60"
      />
      <div>
        <label
          htmlFor="feedback-email"
          className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
        >
          {t('common:feedback.emailLabel')}
        </label>
        <input
          id="feedback-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('common:feedback.emailPlaceholder')}
          disabled={submitState === 'sending'}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60"
        />
      </div>
      {submitState === 'error' && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {t('common:feedback.error')}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={submitState === 'sending'}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium transition-colors disabled:opacity-60"
        >
          {t('common:buttons.cancel')}
        </button>
        <button
          type="submit"
          disabled={!message.trim() || submitState === 'sending'}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:hover:bg-indigo-600"
        >
          {submitState === 'sending'
            ? t('common:feedback.sending')
            : t('common:feedback.send')}
        </button>
      </div>
    </form>
  )

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800 max-w-md w-full"
      onClose={onClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('common:feedback.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg transition-colors"
            aria-label={t('common:buttons.cancel')}
          >
            <X size={20} />
          </button>
        </div>
        {!conversationsAvailable
          ? renderFallback()
          : submitState === 'success'
            ? renderSuccess()
            : renderForm()}
      </div>
    </dialog>
  )
}
