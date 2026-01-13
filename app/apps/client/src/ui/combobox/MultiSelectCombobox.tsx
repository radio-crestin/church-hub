import { Check, ChevronDown, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface MultiSelectOption {
  value: number | string
  label: string
}

export interface MultiSelectComboboxProps {
  options: MultiSelectOption[]
  value: Array<number | string>
  onChange: (value: Array<number | string>) => void
  placeholder?: string
  allSelectedLabel?: string
  disabled?: boolean
  className?: string
  portalContainer?: HTMLElement | null
  emptyMeansAll?: boolean
}

export function MultiSelectCombobox({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  allSelectedLabel,
  disabled = false,
  className = '',
  portalContainer,
  emptyMeansAll = false,
}: MultiSelectComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
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
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedOptions = options.filter((o) => value.includes(o.value))

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase()),
  )

  const isAllSelected =
    emptyMeansAll && value.length === 0
      ? true
      : options.length > 0 && value.length === options.length

  const getDisplayText = () => {
    if (emptyMeansAll && value.length === 0) {
      return allSelectedLabel ?? placeholder
    }
    if (value.length === 0) {
      return placeholder
    }
    if (allSelectedLabel && isAllSelected) {
      return allSelectedLabel
    }
    if (selectedOptions.length === 1) {
      return selectedOptions[0].label
    }
    return `${selectedOptions.length} selected`
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      const isOutsideContainer =
        containerRef.current && !containerRef.current.contains(target)
      const isOutsideDropdown =
        dropdownRef.current && !dropdownRef.current.contains(target)

      if (isOutsideContainer && isOutsideDropdown) {
        setIsOpen(false)
        setSearch('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const dropdownHeight = 250
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const openUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

      if (openUpward) {
        setDropdownPosition({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
          openUpward: true,
        })
      } else {
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
          openUpward: false,
        })
      }
    }
  }, [isOpen])

  const handleToggle = (optionValue: number | string) => {
    // When emptyMeansAll is true and value is empty, clicking an item deselects it
    // (selects all others)
    if (emptyMeansAll && value.length === 0) {
      onChange(
        options.filter((o) => o.value !== optionValue).map((o) => o.value),
      )
      return
    }

    const isSelected = value.includes(optionValue)
    if (isSelected) {
      onChange(value.filter((v) => v !== optionValue))
    } else {
      // If adding this item would select all, reset to empty (all selected)
      const newValue = [...value, optionValue]
      if (emptyMeansAll && newValue.length === options.length) {
        onChange([])
      } else {
        onChange(newValue)
      }
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearch('')
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-left text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span
          className={
            value.length > 0 || (emptyMeansAll && value.length === 0)
              ? 'truncate'
              : 'text-gray-400 dark:text-gray-500'
          }
        >
          {getDisplayText()}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value.length > 0 && !isAllSelected && (
            <X
              className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={handleClear}
            />
          )}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
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
              width: dropdownPosition.width,
            }}
          >
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="w-full px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected =
                    emptyMeansAll && value.length === 0
                      ? true
                      : value.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleToggle(option.value)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
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
                      <span className="truncate">{option.label}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>,
          portalContainer ?? document.body,
        )}
    </div>
  )
}
