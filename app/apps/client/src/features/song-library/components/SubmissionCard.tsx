import { Check, GitMerge, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { ConfirmModal } from '~/ui/modal'
import { MergeSongPicker } from './MergeSongPicker'
import { useDecideSubmission } from '../hooks/useDecideSubmission'
import type { LibrarySubmission } from '../types'

/** One submission: its lyrics, likely duplicates and the curator's choices. */
export function SubmissionCard({
  submission,
}: {
  submission: LibrarySubmission
}) {
  const { t, i18n } = useTranslation('songLibrary')
  const decide = useDecideSubmission()
  const [showMerge, setShowMerge] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const busy = decide.isPending
  const merge = (librarySongId: string) =>
    decide.mutate({
      id: submission.id,
      decision: { decision: 'merged', librarySongId },
    })

  return (
    <article
      className="rounded-xl border border-line p-4"
      data-testid="library-submission"
    >
      <header className="mb-2">
        <h3 className="text-sm font-semibold text-fg">{submission.title}</h3>
        <p className="text-xs text-fg-hint">
          {t('curator.submittedAt', {
            date: new Date(submission.submittedAt).toLocaleString(
              i18n.language,
            ),
          })}
          {submission.churchName && ` · ${submission.churchName}`}
        </p>
      </header>
      {submission.note && (
        <p className="mb-2 rounded-lg bg-field px-3 py-2 text-sm text-fg-label">
          {submission.note}
        </p>
      )}
      <div className="mb-3 max-h-60 space-y-2 overflow-y-auto rounded-lg border border-line p-3">
        {submission.slides.map((slide, index) => (
          <div key={`${index}-${slide.label}`}>
            {slide.label && (
              <p className="text-xs font-medium text-fg-hint">{slide.label}</p>
            )}
            <p className="whitespace-pre-line text-sm text-fg">{slide.text}</p>
          </div>
        ))}
      </div>

      {submission.matches.length > 0 && (
        <div className="mb-3" data-testid="library-matches">
          <p className="mb-1 text-xs font-medium text-fg-label">
            {t('curator.matches')}
          </p>
          <ul className="space-y-1">
            {submission.matches.map((match) => (
              <li
                key={match.id}
                className="flex items-center justify-between gap-2 text-sm text-fg"
              >
                <span className="min-w-0 truncate">
                  {match.title}
                  <span className="ml-2 text-xs text-fg-hint">
                    {match.sameLyrics
                      ? t('curator.sameLyrics')
                      : t('curator.sameTitle')}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => merge(match.id)}
                  data-testid="library-merge-match"
                >
                  {t('curator.mergeInto')}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            decide.mutate({
              id: submission.id,
              decision: { decision: 'approved' },
            })
          }
          data-testid="library-approve"
        >
          <Check strokeWidth={1.5} className="h-4 w-4" />
          {t('curator.approve')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setShowMerge(!showMerge)}
          aria-expanded={showMerge}
          data-testid="library-merge"
        >
          <GitMerge strokeWidth={1.5} className="h-4 w-4" />
          {t('curator.merge')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setRejecting(true)}
          data-testid="library-reject"
        >
          <X strokeWidth={1.5} className="h-4 w-4" />
          {t('curator.reject')}
        </Button>
      </div>
      {showMerge && (
        <div className="mt-3">
          <MergeSongPicker disabled={busy} onMerge={merge} />
        </div>
      )}

      <ConfirmModal
        isOpen={rejecting}
        title={t('curator.rejectTitle')}
        message={t('curator.rejectMessage', { title: submission.title })}
        confirmLabel={t('curator.reject')}
        variant="danger"
        onCancel={() => setRejecting(false)}
        onConfirm={() => {
          setRejecting(false)
          decide.mutate({
            id: submission.id,
            decision: { decision: 'rejected', reason: reason.trim() || null },
          })
        }}
        testId="library-reject-dialog"
      >
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={1000}
          rows={2}
          placeholder={t('curator.rejectReason')}
          aria-label={t('curator.rejectReason')}
          className="w-full resize-none rounded-[10px] bg-field px-3 py-2 text-base text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus md:text-sm"
        />
      </ConfirmModal>
    </article>
  )
}
