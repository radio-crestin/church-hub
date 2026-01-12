import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CategoryPicker } from './CategoryPicker'

export interface SongMetadata {
  author: string | null
  copyright: string | null
  ccli: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
  sourceFilename: string | null
}

export const defaultSongMetadata: SongMetadata = {
  author: null,
  copyright: null,
  ccli: null,
  tempo: null,
  timeSignature: null,
  theme: null,
  altTheme: null,
  hymnNumber: null,
  keyLine: null,
  presentationOrder: null,
  sourceFilename: null,
}

interface SongDetailsSectionProps {
  title: string
  categoryId: number | null
  metadata: SongMetadata
  isLoading?: boolean
  isNew?: boolean
  presentationCount?: number
  lastManualEdit?: number | null
  onTitleChange: (title: string) => void
  onCategoryChange: (categoryId: number | null) => void
  onMetadataChange: (field: keyof SongMetadata, value: string | null) => void
  /** Unique prefix for input IDs to avoid conflicts when used in modals */
  idPrefix?: string
}

export function SongDetailsSection({
  title,
  categoryId,
  metadata,
  isLoading = false,
  isNew = false,
  presentationCount = 0,
  lastManualEdit,
  onTitleChange,
  onCategoryChange,
  onMetadataChange,
  idPrefix = '',
}: SongDetailsSectionProps) {
  const { t } = useTranslation(['songs'])
  const [showDetails, setShowDetails] = useState(false)

  const handleMetadataFieldChange = (
    field: keyof SongMetadata,
    value: string,
  ) => {
    onMetadataChange(field, value || null)
  }

  // Check if there's any metadata to show in the collapsed summary
  const hasMetadata = metadata.author || metadata.hymnNumber

  const inputId = (name: string) => `${idPrefix}${name}`

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label
            htmlFor={inputId('title')}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {t('editor.titlePlaceholder').replace('...', '')}
          </label>
          {isLoading ? (
            <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ) : (
            <input
              id={inputId('title')}
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white"
              placeholder={t('editor.titlePlaceholder')}
            />
          )}
        </div>

        {/* Key Line (always visible) */}
        <div>
          <label
            htmlFor={inputId('keyLine')}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {t('metadata.keyLine')}
          </label>
          {isLoading ? (
            <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ) : (
            <input
              id={inputId('keyLine')}
              type="text"
              value={metadata.keyLine || ''}
              onChange={(e) =>
                handleMetadataFieldChange('keyLine', e.target.value)
              }
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white"
              placeholder={t('metadata.keyLinePlaceholder')}
            />
          )}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('category.name')}
          </label>
          {isLoading ? (
            <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ) : (
            <CategoryPicker value={categoryId} onChange={onCategoryChange} />
          )}
        </div>

        {/* Collapsible Details Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {t('metadata.detailsSection')}
            {!showDetails && hasMetadata && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                {[
                  metadata.author,
                  metadata.hymnNumber && `#${metadata.hymnNumber}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </button>

          {showDetails && !isLoading && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Author */}
              <div>
                <label
                  htmlFor={inputId('author')}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t('metadata.author')}
                </label>
                <input
                  id={inputId('author')}
                  type="text"
                  value={metadata.author || ''}
                  onChange={(e) =>
                    handleMetadataFieldChange('author', e.target.value)
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* Copyright */}
              <div>
                <label
                  htmlFor={inputId('copyright')}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t('metadata.copyright')}
                </label>
                <input
                  id={inputId('copyright')}
                  type="text"
                  value={metadata.copyright || ''}
                  onChange={(e) =>
                    handleMetadataFieldChange('copyright', e.target.value)
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* CCLI */}
              <div>
                <label
                  htmlFor={inputId('ccli')}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t('metadata.ccli')}
                </label>
                <input
                  id={inputId('ccli')}
                  type="text"
                  value={metadata.ccli || ''}
                  onChange={(e) =>
                    handleMetadataFieldChange('ccli', e.target.value)
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* Hymn Number */}
              <div>
                <label
                  htmlFor={inputId('hymnNumber')}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t('metadata.hymnNumber')}
                </label>
                <input
                  id={inputId('hymnNumber')}
                  type="text"
                  value={metadata.hymnNumber || ''}
                  onChange={(e) =>
                    handleMetadataFieldChange('hymnNumber', e.target.value)
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* Tempo */}
              <div>
                <label
                  htmlFor={inputId('tempo')}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t('metadata.tempo')}
                </label>
                <input
                  id={inputId('tempo')}
                  type="text"
                  value={metadata.tempo || ''}
                  onChange={(e) =>
                    handleMetadataFieldChange('tempo', e.target.value)
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* Time Signature */}
              <div>
                <label
                  htmlFor={inputId('timeSignature')}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t('metadata.timeSignature')}
                </label>
                <input
                  id={inputId('timeSignature')}
                  type="text"
                  value={metadata.timeSignature || ''}
                  onChange={(e) =>
                    handleMetadataFieldChange('timeSignature', e.target.value)
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* Theme */}
              <div>
                <label
                  htmlFor={inputId('theme')}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t('metadata.theme')}
                </label>
                <input
                  id={inputId('theme')}
                  type="text"
                  value={metadata.theme || ''}
                  onChange={(e) =>
                    handleMetadataFieldChange('theme', e.target.value)
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* Alternative Theme */}
              <div>
                <label
                  htmlFor={inputId('altTheme')}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t('metadata.altTheme')}
                </label>
                <input
                  id={inputId('altTheme')}
                  type="text"
                  value={metadata.altTheme || ''}
                  onChange={(e) =>
                    handleMetadataFieldChange('altTheme', e.target.value)
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* Source File Path (read-only) */}
              {metadata.sourceFilename && (
                <div className="sm:col-span-2">
                  <label
                    htmlFor={inputId('sourceFilename')}
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    {t('metadata.sourceFilename')}
                  </label>
                  <input
                    id={inputId('sourceFilename')}
                    type="text"
                    value={metadata.sourceFilename || ''}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 text-sm cursor-not-allowed"
                  />
                </div>
              )}

              {/* Presentation Order (read-only) */}
              {metadata.presentationOrder && (
                <div className="sm:col-span-2">
                  <label
                    htmlFor={inputId('presentationOrder')}
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    {t('metadata.presentationOrder')}
                  </label>
                  <input
                    id={inputId('presentationOrder')}
                    type="text"
                    value={metadata.presentationOrder || ''}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 text-sm cursor-not-allowed"
                  />
                </div>
              )}

              {/* Tracking Stats (read-only) */}
              {!isNew && (
                <>
                  <div>
                    <label
                      htmlFor={inputId('presentationCount')}
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      {t('metadata.presentationCount')}
                    </label>
                    <input
                      id={inputId('presentationCount')}
                      type="text"
                      value={presentationCount}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 text-sm cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={inputId('lastManualEdit')}
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      {t('metadata.lastManualEdit')}
                    </label>
                    <input
                      id={inputId('lastManualEdit')}
                      type="text"
                      value={
                        lastManualEdit
                          ? new Date(lastManualEdit).toLocaleString()
                          : t('metadata.neverEdited')
                      }
                      readOnly
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 text-sm cursor-not-allowed"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
