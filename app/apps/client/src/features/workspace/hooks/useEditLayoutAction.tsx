import { LayoutGrid } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ActionMenuItem } from '~/ui/menu'
import { useWorkspaceEditing } from './useWorkspaceEditing'

/**
 * The "Edit layout" row every page with a workspace puts in its menu. Selecting
 * it turns the page's panels into something the operator can drag around; the
 * row stays checked until they leave the mode again.
 */
export function useEditLayoutAction(workspaceId: string): ActionMenuItem {
  const { t } = useTranslation('common')
  const { editing, toggleEditing } = useWorkspaceEditing(workspaceId)

  return {
    id: 'edit-layout',
    label: t('workspace.editLayout'),
    description: t('workspace.editLayoutDescription'),
    icon: <LayoutGrid size={16} strokeWidth={1.5} />,
    active: editing,
    onSelect: toggleEditing,
    testId: 'workspace-edit-layout',
  }
}
