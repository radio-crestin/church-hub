import { useTranslation } from 'react-i18next'

import type { PickedElement } from '../types'

interface PickedElementInfoProps {
  element: PickedElement | null
}

/** Shows which element the request is about, with its exact path. */
export function PickedElementInfo({ element }: PickedElementInfoProps) {
  const { t } = useTranslation()
  return (
    <div className="text-xs text-gray-600 dark:text-gray-400 min-w-0">
      <span className="font-medium text-gray-700 dark:text-gray-300">
        {t('common:featureRequest.selectedElement')}:{' '}
      </span>
      {element ? (
        <>
          <span data-testid="feature-request-element-label">
            {element.label}
          </span>
          <code
            data-testid="feature-request-element-selector"
            title={element.path}
            className="block mt-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-900 font-mono break-all"
          >
            {element.selector}
          </code>
        </>
      ) : (
        <span data-testid="feature-request-element-label">
          {t('common:featureRequest.wholeScreen')}
        </span>
      )}
    </div>
  )
}
