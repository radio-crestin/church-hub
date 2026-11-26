import { Check, ChevronDown, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { ClearSearchButton } from '../search'

export interface ComboboxOptionDetail {
  label: string
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
}

export interface ComboboxOption {
  value: number | string
  label: string
  description?: string
  details?: ComboboxOptionDetail[]
}

export interface ComboboxProps {
  options: ComboboxOption[]
  value: number | string | null
  onChange: (value: number | string | null) => void
  onCreateNew?: (name: string) => Promise<ComboboxOption | null>
  onDelete?: (value: number | string) => void
  placeholder?: string
  createNewLabel?: string
  disabled?: boolean
  allowClear?: boolean
  allowDelete?: boolean
  className?: string
  portalContainer?: HTMLElement | null
  /** Roots the test ids of the trigger (`<testId>`), the dropdown
   * (`<testId>-dropdown`) and each option (`<testId>-option`, carrying its
   * value in `data-value`). */
  testId?: string
}

export function Combobox({
  options,
  value,
  onChange,
  onCreateNew,
  onDelete,
  placeholder = 'Select...',
  createNewLabel = 'Create',
  disabled = false,
  allowClear = true,
  allowDelete = false,
  className = '',
  portalContainer,
  testId,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)
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

  const selectedOption = options.find((o) => o.value === value)

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase()),
  )

  const showCreateOption =
    onCreateNew &&
    search.trim().length > 0 &&
    !options.some((o) => o.label.toLowerCase() === search.toLowerCase())

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
      const dropdownHeight = 250 // Approximate max height (max-h-48 + search input + padding)
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

  const handleSelect = (option: ComboboxOption) => {
    onChange(option.value)
    setIsOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  const handleCreateNew = async () => {
    if (!onCreateNew || !search.trim()) return

    setIsCreating(true)
    try {
      const newOption = await onCreateNew(search.trim())
      if (newOption) {
        onChange(newOption.value)
        setIsOpen(false)
        setSearch('')
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = (e: React.MouseEvent, optionValue: number | string) => {
    e.stopPropagation()
    if (onDelete) {
      onDelete(optionValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Inside a native <dialog> an unhandled Escape cancels the dialog, so
      // dismissing this dropdown would throw away the whole edit. Escape
      // closes the dropdown only.
      e.preventDefault()
      e.stopPropagation()
      setIsOpen(false)
      setSearch('')
    } else if (e.key === 'Enter' && showCreateOption) {
      e.preventDefault()
      handleCreateNew()
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        data-testid={testId}
        className="w-full h-9 flex items-center justify-between gap-2 px-3 bg-field rounded-[10px] text-left text-[13px] text-fg focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span
          className={`truncate min-w-0 ${selectedOption ? '' : 'text-fg-hint'}`}
        >
          {selectedOption?.label || placeholder}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {allowClear && selectedOption && (
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
            data-testid={testId ? `${testId}-dropdown` : undefined}
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
                  className={`w-full h-8 pl-2.5 bg-field rounded-lg text-[13px] text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus ${
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
              {showCreateOption && (
                <button
                  type="button"
                  onClick={handleCreateNew}
                  disabled={isCreating}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-fg hover:bg-hover disabled:opacity-50"
                >
                  <Plus strokeWidth={1.5} className="w-4 h-4 text-fg-label" />
                  {createNewLabel} "{search}"
                </button>
              )}

              {filteredOptions.length === 0 && !showCreateOption ? (
                <div className="px-2.5 py-1.5 text-[13px] text-fg-hint">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    data-testid={testId ? `${testId}-option` : undefined}
                    data-value={option.value}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] text-left group ${
                      option.value === value
                        ? 'bg-selected text-fg'
                        : 'text-fg-body hover:bg-hover'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(option)}
                      className="flex-1 text-left min-w-0"
                    >
                      <span className="block truncate">{option.label}</span>
                      {(option.description || option.details) && (
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {option.description && (
                            <span className="text-xs text-fg-hint">
                              {option.description}
                            </span>
                          )}
                          {option.details?.map((detail, idx) => (
                            <span
                              key={idx}
                              className={`text-xs ${
                                detail.variant === 'success'
                                  ? 'text-ok'
                                  : detail.variant === 'warning'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : detail.variant === 'error'
                                      ? 'text-red-600 dark:text-red-400'
                                      : 'text-fg-hint'
                              }`}
                            >
                              {detail.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {option.value === value && (
                        <Check strokeWidth={1.5} className="w-4 h-4" />
                      )}
                      {allowDelete && onDelete && (
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, option.value)}
                          className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-hover text-fg-hint hover:text-red-600 dark:hover:text-red-400 transition-opacity"
                          title="Delete"
                        >
                          <Trash2 strokeWidth={1.75} className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>,
          portalContainer ?? document.body,
        )}
    </div>
  )
}
