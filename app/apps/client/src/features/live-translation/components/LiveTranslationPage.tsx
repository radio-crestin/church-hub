import {
  ArrowRightLeft,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Key,
  Mic,
  MicOff,
  RefreshCw,
  Settings,
  Trash2,
  Volume2,
  Wifi,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '~/ui/combobox/Combobox'
import { AudioLevelMeter } from './AudioLevelMeter'
import { TranscriptionDisplay } from './TranscriptionDisplay'
import {
  LANGUAGES,
  type OutputMode,
  useLiveTranslation,
  VOICES,
} from '../hooks/useLiveTranslation'

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
    setApiKey,
    updateSetting,
    startTranslation,
    stopTranslation,
    clearTranscription,
    resetSecret,
  } = useLiveTranslation()

  const swapLanguages = () => {
    const prev = settings.sourceLanguage
    updateSetting('sourceLanguage', settings.targetLanguage)
    updateSetting('targetLanguage', prev)
  }

  const canStart = apiKey.length > 0 && !state.isActive

  const languageOptions = useMemo(
    () => LANGUAGES.map((l) => ({ value: l.code, label: l.name })),
    [],
  )

  const voiceOptions = useMemo(
    () => VOICES.map((v) => ({ value: v, label: v })),
    [],
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

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-hidden">
          {/* API Key Section */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0 mt-0.5">
                <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  {t('settings.apiKey')}
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {t('settings.apiKeyDescription')}
                </p>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={t('settings.apiKeyPlaceholder')}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                {!apiKey && (
                  <div className="mt-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1.5">
                      {t('settings.howToGetKey')}
                    </p>
                    <ol className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-decimal list-inside">
                      <li>{t('settings.step1')}</li>
                      <li>{t('settings.step2')}</li>
                      <li>{t('settings.step3')}</li>
                    </ol>
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
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

          {/* Translation Settings */}
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Source Language */}
              <div>
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

              {/* Target Language */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('settings.targetLanguage')}
                </label>
                <div className="flex gap-2">
                  <Combobox
                    options={languageOptions}
                    value={settings.targetLanguage}
                    onChange={(v) =>
                      updateSetting('targetLanguage', (v as string) || 'en')
                    }
                    placeholder={t('settings.targetLanguage')}
                    disabled={state.isActive}
                    allowClear={false}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={swapLanguages}
                    disabled={state.isActive}
                    className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                    title={t('settings.swapLanguages')}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Voice */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <Volume2 className="w-3.5 h-3.5" />
                  {t('settings.voice')}
                </label>
                <Combobox
                  options={voiceOptions}
                  value={settings.voiceName}
                  onChange={(v) =>
                    updateSetting('voiceName', (v as string) || 'Kore')
                  }
                  placeholder={t('settings.voice')}
                  disabled={state.isActive}
                  allowClear={false}
                />
              </div>
            </div>

            {/* Audio Device Selection */}
            {audioDevices.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {/* Input Device */}
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

                {/* Output Device */}
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

            {/* Output Mode */}
            <div className="mt-4">
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Wifi className="w-3.5 h-3.5" />
                {t('settings.outputMode')}
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {t('settings.outputModeDescription')}
              </p>
              <div className="flex gap-2">
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
            </div>

            {/* Stream URL (shown when WebRTC output is enabled) */}
            {(settings.outputMode === 'webrtc' ||
              settings.outputMode === 'both') &&
              streamUrl && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('settings.streamUrl')}
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {t('settings.streamUrlDescription')}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={streamUrl}
                      className="flex-1 px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg font-mono select-all"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(streamUrl)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copied ? t('settings.copiedUrl') : t('settings.copyUrl')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(t('settings.resetSecretConfirm'))) {
                          resetSecret()
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {t('settings.resetSecret')}
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Language Bar + Controls */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {LANGUAGES.find((l) => l.code === settings.sourceLanguage)?.name}
            </span>
            <ArrowRightLeft className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {LANGUAGES.find((l) => l.code === settings.targetLanguage)?.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Clear Button */}
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

          {/* Start/Stop Button */}
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

      {/* Error Display */}
      {state.error && (
        <div className="mb-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm flex-shrink-0">
          {state.error}
        </div>
      )}

      {/* Transcription Area - fills remaining space */}
      <div className="flex-1 min-h-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <TranscriptionDisplay
          entries={state.transcription}
          sourceLanguage={settings.sourceLanguage}
          targetLanguage={settings.targetLanguage}
        />
      </div>
    </div>
  )
}
