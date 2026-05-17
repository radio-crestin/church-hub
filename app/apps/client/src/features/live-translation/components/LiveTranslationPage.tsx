import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Key,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '~/ui/combobox/Combobox'
import { AudioLevelMeter } from './AudioLevelMeter'
import { TranscriptionDisplay } from './TranscriptionDisplay'
import {
  LANGUAGES,
  type OutputMode,
  type OutputModality,
  type TranslationEngine,
  useLiveTranslation,
  voicesForEngine,
} from '../hooks/useLiveTranslation'

const ENGINE_INFO: Record<
  TranslationEngine,
  { label: string; tagline: string; keyField: 'openaiApiKey' | 'geminiApiKey'; getKeyUrl: string }
> = {
  openai: {
    label: 'OpenAI Realtime',
    tagline: 'GPT-4o Realtime, low-latency speech translation',
    keyField: 'openaiApiKey',
    getKeyUrl: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    label: 'Google Gemini',
    tagline: 'Gemini 2.5 Flash native-audio',
    keyField: 'geminiApiKey',
    getKeyUrl: 'https://aistudio.google.com/apikey',
  },
}

export function LiveTranslationPage() {
  const { t } = useTranslation('liveTranslation')
  const [showSettings, setShowSettings] = useState(false)
  const [copied, setCopied] = useState(false)

  const {
    state,
    settings,
    apiKey,
    audioDevices,
    streamUrl,
    canStart,
    updateSetting,
    setEngine,
    addTarget,
    removeTarget,
    updateTarget,
    setPrimaryTarget,
    startTranslation,
    stopTranslation,
    clearTranscription,
    resetSecret,
  } = useLiveTranslation()

  const engineInfo = ENGINE_INFO[settings.engine]
  const voiceOptions = useMemo(
    () =>
      voicesForEngine(settings.engine).map((v) => ({ value: v, label: v })),
    [settings.engine],
  )

  const languageOptions = useMemo(
    () => LANGUAGES.map((l) => ({ value: l.code, label: l.name })),
    [],
  )

  const availableLanguagesForNewTarget = useMemo(
    () =>
      LANGUAGES.filter(
        (l) => !settings.targets.some((t) => t.targetLanguage === l.code),
      ).map((l) => ({ value: l.code, label: l.name })),
    [settings.targets],
  )

  const inputDeviceOptions = useMemo(
    () =>
      audioDevices
        .filter((d) => d.inputChannels > 0)
        .map((d) => ({
          value: d.id,
          label: d.name,
          description: d.isDefaultInput
            ? t('settings.defaultDevice')
            : undefined,
        })),
    [audioDevices, t],
  )

  const outputDeviceOptions = useMemo(
    () =>
      audioDevices
        .filter((d) => d.outputChannels > 0)
        .map((d) => ({
          value: d.id,
          label: d.name,
          description: d.isDefaultOutput
            ? t('settings.defaultDevice')
            : undefined,
        })),
    [audioDevices, t],
  )

  const apiKeyHandler = (value: string) =>
    updateSetting(engineInfo.keyField, value)

  const copyLink = () => {
    if (!streamUrl) return
    navigator.clipboard.writeText(streamUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          {state.isActive && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              {t('status.live')}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-2 py-1.5 lg:px-3 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">{t('settings.button')}</span>
        </button>
      </div>

      {/* Always-visible listener link bar */}
      {streamUrl && (
        <div className="mb-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-0.5">
              {t('settings.streamUrl')}
            </div>
            <div className="text-[11px] text-blue-700 dark:text-blue-400">
              {t('settings.streamUrlDescription')}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={streamUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 sm:w-80 px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg font-mono select-all"
            />
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? t('settings.copiedUrl') : t('settings.copyUrl')}
            </button>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-hidden overflow-y-auto max-h-[70vh]">
          {/* Engine Selector */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white mb-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              {t('settings.engine')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['openai', 'gemini'] as TranslationEngine[]).map((eng) => (
                <button
                  key={eng}
                  type="button"
                  onClick={() => setEngine(eng)}
                  disabled={state.isActive}
                  className={`p-3 text-left rounded-lg border-2 transition-all ${
                    settings.engine === eng
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="font-semibold text-sm text-gray-900 dark:text-white">
                    {ENGINE_INFO[eng].label}
                    {eng === 'openai' && (
                      <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        {t('settings.engineDefault')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {ENGINE_INFO[eng].tagline}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0 mt-0.5">
                <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  {t(`settings.apiKey.${settings.engine}`)}
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {t(`settings.apiKeyDescription.${settings.engine}`)}
                </p>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => apiKeyHandler(e.target.value)}
                  placeholder={t(`settings.apiKeyPlaceholder.${settings.engine}`)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                {!apiKey && (
                  <div className="mt-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1.5">
                      {t('settings.howToGetKey')}
                    </p>
                    <a
                      href={engineInfo.getKeyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                    >
                      {t('settings.getApiKey')}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {apiKey && (
                  <p className="mt-1.5 text-xs text-green-600 dark:text-green-400">
                    {t('settings.apiKeyConfigured')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Output Modality */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
              {t('settings.outputModality')}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {t('settings.outputModalityDescription')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['audio_text', 'text_only'] as OutputModality[]).map((mod) => (
                <button
                  key={mod}
                  type="button"
                  onClick={() => updateSetting('outputModality', mod)}
                  disabled={state.isActive}
                  className={`p-3 text-left rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    settings.outputModality === mod
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="font-semibold text-sm text-gray-900 dark:text-white">
                    {t(`settings.outputModality_${mod}`)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t(`settings.outputModality_${mod}_description`)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Source Language */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('settings.sourceLanguage')}
            </label>
            <Combobox
              options={languageOptions}
              value={settings.sourceLanguage}
              onChange={(v) =>
                updateSetting('sourceLanguage', (v as string) || 'ro')
              }
              placeholder={t('settings.sourceLanguage')}
              disabled={state.isActive}
              allowClear={false}
            />
          </div>

          {/* Target Languages */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('settings.targetLanguages')}
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('settings.targetLanguagesHint')}
              </span>
            </div>

            <div className="space-y-2">
              {settings.targets.map((target) => (
                <div
                  key={target.id}
                  className="flex flex-col sm:flex-row gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div
                    className={`flex-1 grid grid-cols-1 gap-2 ${settings.outputModality === 'text_only' ? '' : 'sm:grid-cols-2'}`}
                  >
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-400 mb-1">
                        {t('settings.targetLanguage')}
                      </label>
                      <Combobox
                        options={languageOptions}
                        value={target.targetLanguage}
                        onChange={(v) =>
                          updateTarget(target.id, {
                            targetLanguage: (v as string) || 'en',
                          })
                        }
                        disabled={state.isActive}
                        allowClear={false}
                      />
                    </div>
                    {settings.outputModality === 'audio_text' && (
                      <div>
                        <label className="flex items-center gap-1.5 text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-400 mb-1">
                          <Volume2 className="w-3 h-3" />
                          {t('settings.voice')}
                        </label>
                        <Combobox
                          options={voiceOptions}
                          value={target.voiceName}
                          onChange={(v) =>
                            updateTarget(target.id, {
                              voiceName:
                                (v as string) || voiceOptions[0]?.value || '',
                            })
                          }
                          disabled={state.isActive}
                          allowClear={false}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex sm:flex-col gap-2 sm:items-end">
                    <button
                      type="button"
                      onClick={() => setPrimaryTarget(target.id)}
                      disabled={state.isActive}
                      title={t('settings.primaryTargetTooltip')}
                      className={`flex-1 sm:flex-none px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors disabled:opacity-50 ${
                        settings.primaryTargetId === target.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {settings.primaryTargetId === target.id
                        ? t('settings.primary')
                        : t('settings.makePrimary')}
                    </button>
                    {settings.targets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTarget(target.id)}
                        disabled={state.isActive}
                        title={t('settings.removeTarget')}
                        className="px-2.5 py-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {availableLanguagesForNewTarget.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    addTarget(availableLanguagesForNewTarget[0]?.value)
                  }
                  disabled={state.isActive}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {t('settings.addTarget')}
                </button>
              )}
            </div>
          </div>

          {/* Audio Devices */}
          {audioDevices.length > 0 && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <Mic className="w-3.5 h-3.5" />
                  {t('settings.inputDevice')}
                </label>
                <Combobox
                  options={inputDeviceOptions}
                  value={settings.inputDeviceId}
                  onChange={(v) =>
                    updateSetting('inputDeviceId', v as number | null)
                  }
                  placeholder={t('settings.defaultDevice')}
                  disabled={state.isActive}
                  allowClear
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <Volume2 className="w-3.5 h-3.5" />
                  {t('settings.outputDevice')}
                </label>
                <Combobox
                  options={outputDeviceOptions}
                  value={settings.outputDeviceId}
                  onChange={(v) =>
                    updateSetting('outputDeviceId', v as number | null)
                  }
                  placeholder={t('settings.defaultDevice')}
                  disabled={state.isActive}
                  allowClear
                />
              </div>
            </div>
          )}

          {/* Output Mode + Listener Link */}
          <div className="p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('settings.outputMode')}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {t('settings.outputModeDescription')}
            </p>
            <div className="flex gap-2 mb-3">
              {(['device', 'webrtc', 'both'] as OutputMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateSetting('outputMode', mode)}
                  disabled={state.isActive}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                    settings.outputMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {t(
                    `settings.outputMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
                  )}
                </button>
              ))}
            </div>

            {streamUrl && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t('settings.resetSecretConfirm'))) {
                    resetSecret()
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t('settings.resetSecret')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Language Bar + Controls */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider text-[10px]">
              {t('settings.engine')}
            </span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {ENGINE_INFO[settings.engine].label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {LANGUAGES.find((l) => l.code === settings.sourceLanguage)?.name}
            </span>
            <span className="text-gray-400">→</span>
            <div className="flex gap-1">
              {settings.targets.map((tgt) => (
                <span
                  key={tgt.id}
                  className={`px-1.5 py-0.5 text-xs rounded ${
                    settings.primaryTargetId === tgt.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  }`}
                  title={
                    LANGUAGES.find((l) => l.code === tgt.targetLanguage)?.name
                  }
                >
                  {tgt.targetLanguage.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {state.transcription.length > 0 && (
            <button
              type="button"
              onClick={clearTranscription}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
              title={t('controls.clear')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={state.isActive ? stopTranslation : startTranslation}
            disabled={!canStart && !state.isActive}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
              state.isActive
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20'
                : canStart
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            {state.isActive ? (
              <>
                <MicOff className="w-4 h-4" />
                {t('controls.stop')}
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                {t('controls.start')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Audio Level Meters */}
      {state.isActive && (
        <div className="flex items-center gap-6 mb-3 px-4 py-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex-shrink-0">
          <AudioLevelMeter
            level={state.inputAudioLevel}
            label={t('levels.input')}
            color="blue"
          />
          <div className="flex-1" />
          <AudioLevelMeter
            level={state.outputAudioLevel}
            label={t('levels.output')}
            color="green"
          />
        </div>
      )}

      {/* Per-target listener counts */}
      {state.isActive && state.targets.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 flex-shrink-0">
          {state.targets.map((tgt) => (
            <span
              key={tgt.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full"
            >
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {tgt.targetLanguage.toUpperCase()}
              </span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500 dark:text-gray-400">
                {t('settings.listenersCount', { count: tgt.listenerCount })}
              </span>
            </span>
          ))}
        </div>
      )}

      {state.error && (
        <div className="mb-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm flex-shrink-0">
          {state.error}
        </div>
      )}

      {/* Transcription Area */}
      <div className="flex-1 min-h-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <TranscriptionDisplay
          entries={state.transcription}
          sourceLanguage={settings.sourceLanguage}
        />
      </div>
    </div>
  )
}
