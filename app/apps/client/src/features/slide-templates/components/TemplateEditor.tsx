import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ScreenEditor } from '~/features/presentation/components/screen-editor'
import { toTemplateDesign } from '~/features/presentation/components/screen-editor/toTemplateDesign'
import type { ScreenWithConfigs } from '~/features/presentation/types'
import { useToast } from '~/ui/toast/useToast'
import {
  useCreateSlideTemplate,
  useSaveSlideTemplate,
} from '../hooks/useSlideTemplateMutations'
import type { SlideTemplate } from '../types'
import { templateAsScreen } from '../utils/templateAsScreen'
import { templateDisplayName } from '../utils/templateDisplayName'

interface TemplateEditorProps {
  template: SlideTemplate
  /** A bundled template is saved as a copy: the editor goes on with it. */
  onSavedAsCopy: (copy: SlideTemplate) => void
  onClose: () => void
}

/** The slide editor on a template of its own, opened from the Templates page. */
export function TemplateEditor({
  template,
  onSavedAsCopy,
  onClose,
}: TemplateEditorProps) {
  const { t } = useTranslation('presentation')
  const { showToast } = useToast()
  const createTemplate = useCreateSlideTemplate()
  const saveTemplate = useSaveSlideTemplate()
  const screen = useMemo(() => templateAsScreen(template), [template])

  const handleSave = async (edited: ScreenWithConfigs) => {
    const design = toTemplateDesign(edited)
    try {
      if (!template.bundledKey) {
        await saveTemplate.mutateAsync({ id: template.id, input: design })
        showToast(t('templates.toast.saved'), 'success')
        return
      }
      const name = t('templates.copyName', {
        name: templateDisplayName(template, t),
      })
      const copy = await createTemplate.mutateAsync({
        name,
        fromId: template.id,
      })
      const saved = await saveTemplate.mutateAsync({
        id: copy.id,
        input: design,
      })
      showToast(t('templates.toast.savedAsCopy', { name }), 'success')
      onSavedAsCopy(saved)
    } catch (error) {
      showToast(t('templates.toast.error'), 'error')
      throw error
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950">
      <ScreenEditor
        screen={screen}
        title={templateDisplayName(template, t)}
        onSave={handleSave}
        onClose={onClose}
      />
    </div>
  )
}
