import { Check, ChevronDown, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { ClearSearchButton } from '../search'

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
  /**
   * When set, renders an explicit "All" pseudo-item at the top of the
   * dropdown. Clicking it clears the selection (value becomes []).
   * Use this — together with leaving `emptyMeansAll` off — when an
   * empty selection should mean "no filter" while still giving the
   * user a one-click way to reset from inside the dropdown. Fixes a
   * sharp edge with single-option lists where the emptyMeansAll
   * toggle logic loops back to empty and you can never actually
   * filter to the one option.
   */
  allOptionLabel?: string
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
  allOptionLabel,
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

  // While open, Escape only closes the dropdown: inside a modal <dialog> it
  // would otherwise also close (or step back) the dialog around it.
  useEffect(() => {
    if (!isOpen) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setIsOpen(false)
      setSearch('')
    }
    document.addEventListener('keydown', closeOnEscape, true)
    return () => document.removeEventListener('keydown', closeOnEscape, true)
  }, [isOpen])

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
        className="w-full h-9 flex items-center justify-between gap-2 px-3 text-sm bg-field rounded-[10px] text-left text-fg focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span
          className={
            value.length > 0 || (emptyMeansAll && value.length === 0)
              ? 'truncate'
              : 'text-fg-hint'
          }
        >
          {getDisplayText()}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value.length > 0 && !isAllSelected && (
            <X
              strokeWidth={1.5}
              className="w-4 h-4 text-fg-hint hover:text-fg"
              onClick={handleClear}
            />
          )}
          <ChevronDown
            strokeWidth={1.5}
            className={`w-4 h-4 text-fg-label transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-panel border border-line rounded-[10px] shadow-popover overflow-hidden"
            style={{
              ...(dropdownPosition.openUpward
                ? { bottom: dropdownPosition.bottom }
                : { top: dropdownPosition.top }),
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
          >
            <div className="p-1.5 border-b border-line">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search..."
                  className={`w-full h-8 pl-2.5 bg-field rounded-lg text-sm text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus ${
                    search ? 'pr-7' : 'pr-2'
                  }`}
                />
                {search && (
                  <ClearSearchButton
                    inputRef={inputRef}
                    onClear={() => setSearch('')}
                    size={14}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-hint hover:text-fg"
                  />
                )}
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto scrollbar-thin p-1">
              {allOptionLabel && (
                <button
                  type="button"
                  onClick={() => {
                    if (value.length > 0) onChange([])
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-left ${
                    value.length === 0
                      ? 'bg-selected text-fg font-medium'
                      : 'text-fg-body hover:bg-hover'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      value.length === 0
                        ? 'border-primary'
                        : 'border-line-strong'
                    }`}
                  >
                    {value.length === 0 && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="truncate">{allOptionLabel}</span>
                </button>
              )}
              {filteredOptions.length === 0 ? (
                <div className="px-2.5 py-1.5 text-sm text-fg-hint">
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
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-left hover:bg-hover ${
                        isSelected ? 'text-fg' : 'text-fg-body'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'bg-primary border-primary'
                            : 'border-line-strong'
                        }`}
                      >
                        {isSelected && (
                          <Check
                            strokeWidth={2}
                            className="w-3 h-3 text-white"
                          />
                        )}
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
