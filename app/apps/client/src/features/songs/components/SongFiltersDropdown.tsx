import { CalendarDays, Check, Eye, Filter, Music } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

export interface SongFiltersState {
  presentedOnly: boolean
  inSchedulesOnly: boolean
  hasKeyLine: boolean
}

interface SongFiltersDropdownProps {
  filters: SongFiltersState
  onChange: (filters: SongFiltersState) => void
}

interface FilterOption {
  key: keyof SongFiltersState
  icon: React.ReactNode
  labelKey: string
}

const FILTER_OPTIONS: FilterOption[] = [
  {
    key: 'presentedOnly',
    icon: <Eye className="w-4 h-4" />,
    labelKey: 'search.presentedOnly',
  },
  {
    key: 'inSchedulesOnly',
    icon: <CalendarDays className="w-4 h-4" />,
    labelKey: 'search.inSchedulesOnly',
  },
  {
    key: 'hasKeyLine',
    icon: <Music className="w-4 h-4" />,
    labelKey: 'search.hasKeyLine',
  },
]

export function SongFiltersDropdown({
  filters,
  onChange,
}: SongFiltersDropdownProps) {
  const { t } = useTranslation('songs')
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
    openUpward: boolean
  }>({
    left: 0,
    width: 0,
    openUpward: false,
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeFiltersCount = Object.values(filters).filter(Boolean).length

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      const isOutsideContainer =
        containerRef.current && !containerRef.current.contains(target)
      const isOutsideDropdown =
        dropdownRef.current && !dropdownRef.current.contains(target)

      if (isOutsideContainer && isOutsideDropdown) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const dropdownHeight = 160
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const openUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

      if (openUpward) {
        setDropdownPosition({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left + window.scrollX,
          width: Math.max(200, rect.width),
          openUpward: true,
        })
      } else {
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: Math.max(200, rect.width),
          openUpward: false,
        })
      }
    }
  }, [isOpen])

  const handleToggle = (key: keyof SongFiltersState) => {
    onChange({
      ...filters,
      [key]: !filters[key],
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`px-3 py-2 rounded-lg border transition-colors flex items-center justify-center gap-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
          activeFiltersCount > 0
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
        }`}
        title={t('search.filters')}
      >
        <Filter className="w-4 h-4" />
        {activeFiltersCount > 0 && (
          <span className="text-xs font-medium min-w-[1rem] text-center">
            {activeFiltersCount}
          </span>
        )}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden"
            style={{
              ...(dropdownPosition.openUpward
                ? { bottom: dropdownPosition.bottom }
                : { top: dropdownPosition.top }),
              left: dropdownPosition.left,
              minWidth: dropdownPosition.width,
            }}
          >
            <div className="p-1">
              {FILTER_OPTIONS.map((option) => {
                const isSelected = filters[option.key]
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleToggle(option.key)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600'
                          : 'border-gray-300 dark:border-gray-500'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="flex items-center gap-2">
                      {option.icon}
                      {t(option.labelKey)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
