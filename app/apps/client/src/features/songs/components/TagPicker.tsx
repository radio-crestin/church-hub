import { Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { ClearSearchButton } from '~/ui/search'
import { useTags, useUpsertTag } from '../hooks'

interface TagPickerProps {
  value: number[]
  onChange: (value: number[]) => void
  disabled?: boolean
  portalContainer?: HTMLElement | null
}

export function TagPicker({
  value,
  onChange,
  disabled,
  portalContainer,
}: TagPickerProps) {
  const { t } = useTranslation('songs')
  const { data: tags } = useTags()
  const upsertTag = useUpsertTag()

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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(
    () => (tags ?? []).filter((tag) => value.includes(tag.id)),
    [tags, value],
  )

  const trimmedSearch = search.trim()
  const filtered = useMemo(() => {
    const q = trimmedSearch.toLowerCase()
    return (tags ?? []).filter(
      (tag) => !q || tag.name.toLowerCase().includes(q),
    )
  }, [tags, trimmedSearch])

  const exactMatch = (tags ?? []).find(
    (tag) => tag.name.toLowerCase() === trimmedSearch.toLowerCase(),
  )

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
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const dropdownHeight = 260
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const openUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

      if (openUpward) {
        setDropdownPosition({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left + window.scrollX,
          width: Math.max(rect.width, 220),
          openUpward: true,
        })
      } else {
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: Math.max(rect.width, 220),
          openUpward: false,
        })
      }
    }
  }, [isOpen])

  const toggle = (tagId: number) => {
    if (value.includes(tagId)) {
      onChange(value.filter((id) => id !== tagId))
    } else {
      onChange([...value, tagId])
    }
  }

  const remove = (tagId: number) => {
    onChange(value.filter((id) => id !== tagId))
  }

  const createAndSelect = async () => {
    if (!trimmedSearch || exactMatch) return
    const result = await upsertTag.mutateAsync({ name: trimmedSearch })
    if (result.success && result.tag) {
      onChange([...value, result.tag.id])
      setSearch('')
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium"
          >
            {tag.name}
            <button
              type="button"
              onClick={() => remove(tag.id)}
              disabled={disabled}
              className="p-0.5 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800/60 disabled:opacity-50"
              aria-label={t('tags.removeTag', { name: tag.name })}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => !disabled && setIsOpen((v) => !v)}
          disabled={disabled}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          <Plus className="w-3 h-3" />
          {selected.length === 0 ? t('tags.addFirst') : t('tags.add')}
        </button>
      </div>

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
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsOpen(false)
                      setSearch('')
                    } else if (
                      e.key === 'Enter' &&
                      trimmedSearch &&
                      !exactMatch
                    ) {
                      e.preventDefault()
                      void createAndSelect()
                    }
                  }}
                  placeholder={t('tags.searchPlaceholder')}
                  className={`w-full pl-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    search ? 'pr-7' : 'pr-2'
                  }`}
                />
                {search && (
                  <ClearSearchButton
                    inputRef={inputRef}
                    onClear={() => setSearch('')}
                    size={14}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  />
                )}
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 && !trimmedSearch && (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  {t('tags.empty')}
                </div>
              )}
              {filtered.map((tag) => {
                const isSelected = value.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggle(tag.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    <span className="truncate">{tag.name}</span>
                    {isSelected && (
                      <span className="text-xs text-indigo-500">✓</span>
                    )}
                  </button>
                )
              })}
              {trimmedSearch && !exactMatch && (
                <button
                  type="button"
                  onClick={createAndSelect}
                  disabled={upsertTag.isPending}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50 border-t border-gray-200 dark:border-gray-700"
                >
                  <Plus className="w-4 h-4" />
                  {t('tags.createNamed', { name: trimmedSearch })}
                </button>
              )}
            </div>
          </div>,
          portalContainer ?? document.body,
        )}
    </div>
  )
}
