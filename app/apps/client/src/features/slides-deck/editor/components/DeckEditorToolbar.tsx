import {
  ArrowLeft,
  BringToFront,
  Copy,
  Lock,
  Redo2,
  SendToBack,
  Trash2,
  Undo2,
  Unlock,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { type DeckInsertChoice, InsertMenu } from './InsertMenu'
import type { DeckElement } from '../../types'
import type { DeckSaveStatus } from '../state/useDeckAutosave'

interface DeckEditorToolbarProps {
  title: string
  status: DeckSaveStatus
  selected: DeckElement | undefined
  canUndo: boolean
  canRedo: boolean
  onBack: () => void
  onInsert: (choice: DeckInsertChoice) => void
  onUndo: () => void
  onRedo: () => void
  onOrder: (direction: 'forward' | 'backward') => void
  onToggleLock: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function IconButton({
  label,
  onClick,
  disabled,
  testId,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  testId?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      {children}
    </button>
  )
}

/** The editor's bar: back, Insert, undo/redo, the selected element's order, lock, copy, delete, and whether it is saved. */
export function DeckEditorToolbar({
  title,
  status,
  selected,
  canUndo,
  canRedo,
  onBack,
  onInsert,
  onUndo,
  onRedo,
  onOrder,
  onToggleLock,
  onDuplicate,
  onDelete,
}: DeckEditorToolbarProps) {
  const { t } = useTranslation('schedules')
  const none = !selected
  return (
    <header className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-900">
      <IconButton
        label={t('deckEditor.back')}
        onClick={onBack}
        testId="deck-editor-back"
      >
        <ArrowLeft size={18} />
      </IconButton>
      <h1 className="mr-2 max-w-[12rem] truncate font-semibold text-gray-900 sm:max-w-xs dark:text-white">
        {title}
      </h1>
      <InsertMenu onInsert={onInsert} />
      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
      <IconButton
        label={t('deckEditor.undo')}
        onClick={onUndo}
        disabled={!canUndo}
        testId="deck-editor-undo"
      >
        <Undo2 size={16} />
      </IconButton>
      <IconButton
        label={t('deckEditor.redo')}
        onClick={onRedo}
        disabled={!canRedo}
        testId="deck-editor-redo"
      >
        <Redo2 size={16} />
      </IconButton>
      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
      <IconButton
        label={t('deckEditor.bringForward')}
        onClick={() => onOrder('forward')}
        disabled={none}
      >
        <BringToFront size={16} />
      </IconButton>
      <IconButton
        label={t('deckEditor.sendBackward')}
        onClick={() => onOrder('backward')}
        disabled={none}
      >
        <SendToBack size={16} />
      </IconButton>
      <IconButton
        label={selected?.locked ? t('deckEditor.unlock') : t('deckEditor.lock')}
        onClick={onToggleLock}
        disabled={none}
        testId="deck-editor-lock"
      >
        {selected?.locked ? <Unlock size={16} /> : <Lock size={16} />}
      </IconButton>
      <IconButton
        label={t('deckEditor.duplicate')}
        onClick={onDuplicate}
        disabled={none}
      >
        <Copy size={16} />
      </IconButton>
      <IconButton
        label={t('deckEditor.delete')}
        onClick={onDelete}
        disabled={none || selected?.locked}
        testId="deck-editor-delete"
      >
        <Trash2 size={16} />
      </IconButton>
      <span
        data-testid="deck-editor-status"
        data-status={status}
        className={`ml-auto text-xs ${status === 'error' ? 'text-red-600' : 'text-gray-500'}`}
      >
        {t(`deckEditor.status.${status}`)}
      </span>
    </header>
  )
}
