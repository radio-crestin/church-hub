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
      <span className="w-full text-xs text-fg-hint sm:w-20">{label}</span>
      <code className="min-w-0 flex-1 break-all rounded-lg bg-field px-3 py-1.5 font-mono text-xs text-fg">
        {value}
      </code>
      <Button variant="secondary" size="sm" onClick={copy}>
        {copied ? t('guide.copied') : t('guide.copy')}
      </Button>
    </div>
  )
}
