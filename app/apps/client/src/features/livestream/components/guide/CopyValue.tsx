import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../../ui/button/Button'

interface CopyValueProps {
  label: string
  value: string
}

/** A value to type into OBS, shown with a button that copies it. */
export function CopyValue({ label, value }: CopyValueProps) {
  const { t } = useTranslation('livestream')
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-full text-xs font-medium uppercase tracking-wide text-gray-500 sm:w-20 dark:text-gray-400">
        {label}
      </span>
      <code className="min-w-0 flex-1 break-all rounded bg-gray-100 px-3 py-1.5 font-mono text-sm text-gray-900 dark:bg-gray-700 dark:text-gray-100">
        {value}
      </code>
      <Button variant="secondary" size="sm" onClick={copy}>
        {copied ? t('guide.copied') : t('guide.copy')}
      </Button>
    </div>
  )
}
