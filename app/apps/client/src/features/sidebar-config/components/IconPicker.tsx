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
      <label className="text-sm font-medium text-gray-900 dark:text-white">
        {t('sections.sidebar.fields.icon')}
      </label>
      <div className="grid grid-cols-6 gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
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
                    ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                }
              `}
              title={iconName}
            >
              <IconComponent size={20} />
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('sections.sidebar.fields.selectIcon')}
      </p>
    </div>
  )
}
