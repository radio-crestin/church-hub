import { Search } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '~/ui/input'
import { ClearSearchButton } from '~/ui/search'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: SearchInputProps) {
  const { t } = useTranslation('music')
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder ?? t('files.search')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-10"
      />
      {value && (
        <ClearSearchButton inputRef={inputRef} onClear={() => onChange('')} />
      )}
    </div>
  )
}
