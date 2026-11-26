import { Search } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '~/ui/input'
import { ClearSearchButton } from '~/ui/search'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Enter: the search is meant, e.g. to remember it. */
  onSubmit?: (value: string) => void
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  onSubmit,
}: SearchInputProps) {
  const { t } = useTranslation('music')
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-hint"
        strokeWidth={1.5}
      />
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder ?? t('files.search')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit?.(value)
        }}
        className="pl-10 pr-10"
      />
      {value && (
        <ClearSearchButton inputRef={inputRef} onClear={() => onChange('')} />
      )}
    </div>
  )
}
