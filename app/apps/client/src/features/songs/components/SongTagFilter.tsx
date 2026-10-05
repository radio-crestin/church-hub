import { useTranslation } from 'react-i18next'

import { MultiSelectCombobox } from '~/ui/combobox'
import { useTags } from '../hooks'

interface SongTagFilterProps {
  value: number[]
  onChange: (tagIds: number[]) => void
  /** Needed inside a modal `<dialog>`, whose top layer hides body portals. */
  portalContainer?: HTMLElement | null
  className?: string
}

/**
 * Tag multi-select shared by the Songs page and the song picker. Renders
 * nothing while the library has no tags. Songs with ANY chosen tag match.
 */
export function SongTagFilter({
  value,
  onChange,
  portalContainer,
  className,
}: SongTagFilterProps) {
  const { t } = useTranslation('songs')
  const { data: tags } = useTags()
  if (!tags?.length) return null

  return (
    <MultiSelectCombobox
      options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
      value={value}
      onChange={(ids) => onChange(ids.filter((id) => typeof id === 'number'))}
      placeholder={t('tags.filterAll')}
      allOptionLabel={t('tags.filterAll')}
      portalContainer={portalContainer}
      className={className}
    />
  )
}
