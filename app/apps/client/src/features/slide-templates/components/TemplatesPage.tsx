import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button/Button'
import { AlertModal, ConfirmModal } from '~/ui/modal'
import { PageHeader } from '~/ui/page'
import { useToast } from '~/ui/toast/useToast'
import { RenameTemplateDialog } from './RenameTemplateDialog'
import { TemplateCard } from './TemplateCard'
import { TemplateEditor } from './TemplateEditor'
import {
  useCreateSlideTemplate,
  useDeleteSlideTemplate,
  useSaveSlideTemplate,
} from '../hooks/useSlideTemplateMutations'
import { useSlideTemplates } from '../hooks/useSlideTemplates'
import type { SlideTemplateWithUsage } from '../types'
import { templateDisplayName } from '../utils/templateDisplayName'
import { usageNames } from '../utils/usageNames'

/**
 * Settings → Templates: every slide template drawn as it looks, who uses it,
 * and new, edit, duplicate, rename and delete.
 */
export function TemplatesPage() {
  const { t } = useTranslation('presentation')
  const { showToast } = useToast()
  const { data: templates = [], isLoading } = useSlideTemplates()
  const createTemplate = useCreateSlideTemplate()
  const saveTemplate = useSaveSlideTemplate()
  const deleteTemplate = useDeleteSlideTemplate()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [renaming, setRenaming] = useState<SlideTemplateWithUsage | null>(null)
  const [deleting, setDeleting] = useState<SlideTemplateWithUsage | null>(null)

  const editing = templates.find((template) => template.id === editingId)
  const classic = templates.find(
    (template) => template.bundledKey === 'classic',
  )

  const duplicate = async (source: SlideTemplateWithUsage, name: string) => {
    try {
      const copy = await createTemplate.mutateAsync({ name, fromId: source.id })
      showToast(t('templates.toast.duplicated', { name: copy.name }), 'success')
      return copy
    } catch {
      showToast(t('templates.toast.error'), 'error')
      return null
    }
  }

  const rename = async (name: string) => {
    if (!renaming) return
    try {
      await saveTemplate.mutateAsync({ id: renaming.id, input: { name } })
      showToast(t('templates.toast.renamed'), 'success')
      setRenaming(null)
    } catch {
      showToast(t('templates.toast.error'), 'error')
    }
  }

  const remove = async () => {
    if (!deleting) return
    try {
      await deleteTemplate.mutateAsync(deleting.id)
      showToast(t('templates.toast.deleted'), 'success')
    } catch {
      showToast(t('templates.toast.error'), 'error')
    }
    setDeleting(null)
  }

  if (editing) {
    return (
      <TemplateEditor
        template={editing}
        onSavedAsCopy={(copy) => setEditingId(copy.id)}
        onClose={() => setEditingId(null)}
      />
    )
  }

  const deletingUsers = deleting ? usageNames(deleting.usage) : ''

  return (
    <div className="space-y-6" data-testid="templates-page">
      <PageHeader
        title={t('templates.page.title')}
        description={t('templates.page.description')}
        actions={
          classic && (
            <Button
              variant="primary"
              className="gap-2"
              data-testid="template-new"
              onClick={async () => {
                const copy = await duplicate(
                  classic,
                  t('templates.page.newName'),
                )
                if (copy) setEditingId(copy.id)
              }}
            >
              <Plus size={16} />
              {t('templates.page.new')}
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => setEditingId(template.id)}
              onDuplicate={() =>
                duplicate(
                  template,
                  t('templates.copyName', {
                    name: templateDisplayName(template, t),
                  }),
                )
              }
              onRename={() => setRenaming(template)}
              onDelete={() => setDeleting(template)}
            />
          ))}
        </div>
      )}

      <RenameTemplateDialog
        name={renaming?.name ?? null}
        onSave={rename}
        onCancel={() => setRenaming(null)}
      />
      <AlertModal
        isOpen={!!deleting && !!deletingUsers}
        title={t('templates.delete.title')}
        message={t('templates.delete.inUse', { names: deletingUsers })}
        onClose={() => setDeleting(null)}
        variant="warning"
      />
      <ConfirmModal
        isOpen={!!deleting && !deletingUsers}
        title={t('templates.delete.title')}
        message={t('templates.delete.message', { name: deleting?.name ?? '' })}
        confirmLabel={t('templates.actions.delete')}
        variant="danger"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
        isLoading={deleteTemplate.isPending}
        testId="delete-template-confirm"
      />
    </div>
  )
}
