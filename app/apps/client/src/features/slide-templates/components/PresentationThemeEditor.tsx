import { TemplateEditor } from './TemplateEditor'
import { useSlideTemplate } from '../hooks/useSlideTemplates'

interface PresentationThemeEditorProps {
  /** The presentation's own theme. */
  templateId: number
  onClose: () => void
}

/**
 * The theme editor on a presentation's own theme: its colours, fonts,
 * background and every slide, changed for this presentation only.
 */
export function PresentationThemeEditor({
  templateId,
  onClose,
}: PresentationThemeEditorProps) {
  const { data: template } = useSlideTemplate(templateId)
  if (!template) return null
  // Its own copy is never a built-in one: it is saved in place.
  return (
    <TemplateEditor
      template={template}
      onSavedAsCopy={onClose}
      onClose={onClose}
    />
  )
}
