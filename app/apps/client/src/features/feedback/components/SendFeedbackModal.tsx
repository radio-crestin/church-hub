import { CheckCircle2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { posthog } from '~/posthog'
import { ContactModal } from './ContactModal'
import { attachFeedbackLogs } from '../services/feedbackService'

interface SendFeedbackModalProps {
  isOpen: boolean
  onClose: () => void
}

type SubmitState = 'idle' | 'sending' | 'success' | 'error'

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
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)

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
      setIsContactModalOpen(false)
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

  const renderUnavailableNotice = () => (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-900 dark:text-amber-200">
      <strong className="block mb-0.5">
        {t('common:feedback.unavailableTitle')}
      </strong>
      {t('common:feedback.unavailableBody')}
    </div>
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

  const renderFormFields = () => (
    <>
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
    </>
  )

  return (
    <>
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
          {submitState === 'success' ? (
            renderSuccess()
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {conversationsAvailable
                ? renderFormFields()
                : renderUnavailableNotice()}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(true)}
                  className="px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-lg transition-colors"
                >
                  {t('common:contact.title')}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitState === 'sending'}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium transition-colors disabled:opacity-60"
                  >
                    {t('common:buttons.cancel')}
                  </button>
                  {conversationsAvailable && (
                    <button
                      type="submit"
                      disabled={!message.trim() || submitState === 'sending'}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:hover:bg-indigo-600"
                    >
                      {submitState === 'sending'
                        ? t('common:feedback.sending')
                        : t('common:feedback.send')}
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      </dialog>

      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
    </>
  )
}
