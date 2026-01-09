import { Eye, EyeOff, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '~/ui/combobox'
import { useAISearchSettings } from '../hooks'
import type { AISearchConfig, AISearchConfigKey } from '../types'

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
]

const DEFAULT_CONFIG: AISearchConfig = {
  enabled: false,
  provider: 'openai',
  model: 'gpt-5.2',
  apiKey: '',
  baseUrl: '',
  analyzeResults: false,
}

interface AISearchSettingsProps {
  configKey: AISearchConfigKey
}

export function AISearchSettings({ configKey }: AISearchSettingsProps) {
  const { t } = useTranslation('settings')
  const { config, isLoading, updateConfig, isUpdating } =
    useAISearchSettings(configKey)
  const [showApiKey, setShowApiKey] = useState(false)
  const [localConfig, setLocalConfig] = useState<AISearchConfig>(DEFAULT_CONFIG)
  const [hasChanges, setHasChanges] = useState(false)

  // Determine i18n key prefix based on config key
  const i18nPrefix =
    configKey === 'bible_ai_search_config'
      ? 'sections.bibleAiSearch'
      : 'sections.aiSearch'

  // Sync local state with fetched config
  useEffect(() => {
    if (config) {
      setLocalConfig(config)
    }
  }, [config])

  // Track changes
  useEffect(() => {
    if (!config) {
      setHasChanges(localConfig.apiKey !== '')
      return
    }
    const changed =
      localConfig.enabled !== config.enabled ||
      localConfig.provider !== config.provider ||
      localConfig.model !== config.model ||
      localConfig.apiKey !== config.apiKey ||
      localConfig.baseUrl !== config.baseUrl ||
      localConfig.analyzeResults !== config.analyzeResults
    setHasChanges(changed)
  }, [localConfig, config])

  const handleSave = async () => {
    await updateConfig(localConfig)
    setHasChanges(false)
  }

  const updateField = <K extends keyof AISearchConfig>(
    field: K,
    value: AISearchConfig[K],
  ) => {
    setLocalConfig((prev) => ({ ...prev, [field]: value }))
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800 animate-pulse">
        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t(`${i18nPrefix}.title`)}
          </h3>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
          {t(`${i18nPrefix}.description`)}
        </p>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-white">
              {t(`${i18nPrefix}.enable.label`)}
            </label>
            <p className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">
              {t(`${i18nPrefix}.enable.description`)}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={localConfig.enabled}
            onClick={() => updateField('enabled', !localConfig.enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              localConfig.enabled
                ? 'bg-indigo-600'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localConfig.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Analyze Results Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-white">
              {t(`${i18nPrefix}.analyzeResults.label`)}
            </label>
            <p className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">
              {t(`${i18nPrefix}.analyzeResults.description`)}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={localConfig.analyzeResults ?? false}
            onClick={() =>
              updateField('analyzeResults', !localConfig.analyzeResults)
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              localConfig.analyzeResults
                ? 'bg-indigo-600'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localConfig.analyzeResults ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Provider */}
        <div className="space-y-2 mb-4">
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            {t(`${i18nPrefix}.provider.label`)}
          </label>
          <Combobox
            options={PROVIDERS}
            value={localConfig.provider}
            onChange={(val) =>
              updateField('provider', val as AISearchConfig['provider'])
            }
            allowClear={false}
          />
          <p className="text-gray-600 dark:text-gray-400 text-xs">
            {t(`${i18nPrefix}.provider.description`)}
          </p>
        </div>

        {/* Model */}
        <div className="space-y-2 mb-4">
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            {t(`${i18nPrefix}.model.label`)}
          </label>
          <input
            type="text"
            value={localConfig.model}
            onChange={(e) => updateField('model', e.target.value)}
            placeholder="gpt-5.2"
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
          <p className="text-gray-600 dark:text-gray-400 text-xs">
            {t(`${i18nPrefix}.model.description`)}
          </p>
        </div>

        {/* API Key */}
        <div className="space-y-2 mb-4">
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            {t(`${i18nPrefix}.apiKey.label`)}
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={localConfig.apiKey}
              onChange={(e) => updateField('apiKey', e.target.value)}
              placeholder={t(`${i18nPrefix}.apiKey.placeholder`)}
              className="w-full px-3 py-2 pr-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showApiKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-xs">
            {t(`${i18nPrefix}.apiKey.description`)}
          </p>
        </div>

        {/* Base URL (for custom provider) */}
        {localConfig.provider === 'custom' && (
          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium text-gray-900 dark:text-white">
              {t(`${i18nPrefix}.baseUrl.label`)}
            </label>
            <input
              type="url"
              value={localConfig.baseUrl || ''}
              onChange={(e) => updateField('baseUrl', e.target.value)}
              placeholder={t(`${i18nPrefix}.baseUrl.placeholder`)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
            <p className="text-gray-600 dark:text-gray-400 text-xs">
              {t(`${i18nPrefix}.baseUrl.description`)}
            </p>
          </div>
        )}

        {/* Save Button */}
        {hasChanges && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isUpdating}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? t(`${i18nPrefix}.saving`) : t(`${i18nPrefix}.save`)}
          </button>
        )}
      </div>
    </div>
  )
}
