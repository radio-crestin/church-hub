import {
  Bell,
  Bookmark,
  Calendar,
  Clock,
  Compass,
  ExternalLink,
  FileText,
  Folder,
  Globe,
  Grid,
  Heart,
  Home,
  Image,
  Layers,
  Link,
  List,
  type LucideIcon,
  Mail,
  Map,
  MessageSquare,
  Phone,
  Search,
  Star,
  Users,
  Video,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AVAILABLE_ICONS, type AvailableIconName } from '../constants'

interface IconPickerProps {
  value: string
  onChange: (iconName: string) => void
}

/**
 * Map of icon names to Lucide icon components
 */
const ICON_COMPONENTS: Record<AvailableIconName, LucideIcon> = {
  Globe,
  Link,
  ExternalLink,
  FileText,
  Video,
  Image,
  Bookmark,
  Star,
  Heart,
  Home,
  Users,
  Calendar,
  MessageSquare,
  Phone,
  Mail,
  Map,
  Compass,
  Search,
  Clock,
  Bell,
  Layers,
  Grid,
  List,
  Folder,
}

/**
 * Grid-based icon picker component
 */
export function IconPicker({ value, onChange }: IconPickerProps) {
  const { t } = useTranslation('settings')

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-fg">
        {t('sections.sidebar.fields.icon')}
      </label>
      <div className="grid grid-cols-6 gap-2 p-3 bg-field rounded-lg border border-line">
        {AVAILABLE_ICONS.map((iconName) => {
          const IconComponent = ICON_COMPONENTS[iconName]
          const isSelected = value === iconName

          return (
            <button
              key={iconName}
              type="button"
              onClick={() => onChange(iconName)}
              className={`
                p-2.5 rounded-lg transition-all flex items-center justify-center
                ${
                  isSelected
                    ? 'bg-selected text-fg'
                    : 'text-fg-label hover:bg-hover hover:text-fg'
                }
              `}
              title={iconName}
            >
              <IconComponent size={16} strokeWidth={1.5} />
            </button>
          )
        })}
      </div>
      <p className="text-xs text-fg-hint">
        {t('sections.sidebar.fields.selectIcon')}
      </p>
    </div>
  )
}
