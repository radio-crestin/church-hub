import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NativeSelect } from '~/ui/select'

/** How another device opens the link. */
export type ScreenLinkWay = 'internet' | 'network'

interface ScreenLinkWaysProps {
  way: ScreenLinkWay
  onWay: (way: ScreenLinkWay) => void
  hasInternet: boolean
  /** The PC's LAN addresses (none on a phone). */
  addresses: string[]
  address: string
  onAddress: (address: string) => void
}

/**
 * The advanced choice of a screen link (T-214): directly on the church
 * network, the default, by one of the PC's addresses, or over the internet
 * (WebRTC), which needs the PC's remote access on. Folded away at first.
 */
export function ScreenLinkWays({
  way,
  onWay,
  hasInternet,
  addresses,
  address,
  onAddress,
}: ScreenLinkWaysProps) {
  const { t } = useTranslation('settings')
  const [open, setOpen] = useState(false)
  const id = useId()
  const options = [
    {
      value: 'network' as const,
      title: t('sections.screens.link.network'),
      hint: t('sections.screens.link.networkHint'),
      disabled: false,
    },
    {
      value: 'internet' as const,
      title: t('sections.screens.link.internet'),
      hint: t(
        hasInternet
          ? 'sections.screens.link.internetHint'
          : 'sections.screens.link.internetOff',
      ),
      disabled: !hasInternet,
    },
  ]

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm text-fg-label hover:text-fg"
      >
        {t('sections.screens.link.advanced')}
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          className={open ? 'rotate-180' : undefined}
        />
      </button>
      {open && (
        <fieldset id={id} className="mt-2 flex flex-col gap-2">
          <legend className="sr-only">
            {t('sections.screens.link.advanced')}
          </legend>
          {options.map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                way === option.value
                  ? 'border-transparent bg-selected'
                  : 'border-line'
              } ${option.disabled ? 'opacity-50' : 'cursor-pointer'}`}
            >
              <input
                type="radio"
                name={`${id}-way`}
                value={option.value}
                checked={way === option.value}
                disabled={option.disabled}
                onChange={() => onWay(option.value)}
                data-testid={`screen-link-way-${option.value}`}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium text-fg">
                  {option.title}
                </span>
                <span
                  className="block text-xs text-fg-hint mt-0.5"
                  data-testid={`screen-link-way-${option.value}-hint`}
                >
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
          {way === 'network' && addresses.length > 1 && (
            <label htmlFor={`${id}-address`} className="sr-only">
              {t('sections.screens.link.address')}
            </label>
          )}
          {way === 'network' && addresses.length > 1 && (
            <NativeSelect
              id={`${id}-address`}
              value={address}
              options={addresses.map((value) => ({ value, label: value }))}
              onChange={onAddress}
              testId="screen-link-address"
            />
          )}
        </fieldset>
      )}
    </div>
  )
}
