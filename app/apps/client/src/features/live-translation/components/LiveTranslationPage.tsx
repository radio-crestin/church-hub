import {
  Check,
  Copy,
  ExternalLink,
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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { Combobox } from '~/ui/combobox/Combobox'
import { PageHeader } from '~/ui/page'
import { AudioLevelMeter } from './AudioLevelMeter'
import { TranscriptionDisplay } from './TranscriptionDisplay'
import {
  LANGUAGES,
  type OutputModality,
  type OutputMode,
  type TranslationEngine,
  useLiveTranslation,
  voicesForEngine,
} from '../hooks/useLiveTranslation'

const ENGINE_INFO: Record<
  TranslationEngine,
  {
    label: string
    tagline: string
    keyField: 'openaiApiKey' | 'geminiApiKey'
    getKeyUrl: string
  }
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
  const settingsDialogRef = useRef<HTMLDialogElement>(null)
  const settingsMouseDownTargetRef = useRef<EventTarget | null>(null)

  useEffect(() => {
    const dialog = settingsDialogRef.current
    if (!dialog) return
    if (showSettings) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [showSettings])

  const handleSettingsBackdropMouseDown = (
    e: React.MouseEvent<HTMLDialogElement>,
  ) => {
    settingsMouseDownTargetRef.current = e.target
  }

  const handleSettingsBackdropClick = (
    e: React.MouseEvent<HTMLDialogElement>,
  ) => {
    if (
      e.target === settingsDialogRef.current &&
      settingsMouseDownTargetRef.current === settingsDialogRef.current
    ) {
      setShowSettings(false)
    }
  }

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
    () => voicesForEngine(settings.engine).map((v) => ({ value: v, label: v })),
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
    <div className="flex flex-col gap-3 h-full overflow-hidden">
      <PageHeader
        title={t('title')}
        actions={
          <>
            {state.isActive && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium text-fg-label">
                <span className="w-1.5 h-1.5 bg-ok rounded-full" />
                {t('status.live')}
              </span>
            )}
            <Button
              variant="secondary"
              onClick={() => setShowSettings(!showSettings)}
              aria-label={t('settings.button')}
              className="gap-2"
            >
              <Settings className="w-4 h-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">{t('settings.button')}</span>
            </Button>
          </>
        }
      />

      {/* Always-visible listener link bar */}
      {streamUrl && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-panel border border-line rounded-xl flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-fg mb-0.5">
              {t('settings.streamUrl')}
            </div>
            <div className="text-xs text-fg-hint">
              {t('settings.streamUrlDescription')}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={streamUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 sm:w-80 px-3 py-2 text-xs bg-field text-fg-body border border-line rounded-lg font-mono select-all outline-none focus:border-focus"
            />
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" strokeWidth={1.75} />
              ) : (
                <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
              )}
              {copied ? t('settings.copiedUrl') : t('settings.copyUrl')}
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <dialog
        ref={settingsDialogRef}
        onClose={() => setShowSettings(false)}
        onMouseDown={handleSettingsBackdropMouseDown}
        onClick={handleSettingsBackdropClick}
        className="m-auto p-0 rounded-xl border border-line shadow-popover backdrop:bg-black/60 bg-panel text-fg w-full max-w-3xl overflow-hidden"
      >
        <div className="flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between px-5 py-3 border-b border-line flex-shrink-0">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-fg-label" strokeWidth={1.5} />
              <h2 className="text-base font-semibold text-fg">
                {t('settings.button')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="p-1.5 text-fg-label hover:text-fg hover:bg-hover rounded-lg transition-colors"
              aria-label={t('settings.close')}
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            <div className="bg-panel">
              {/* Engine Selector */}
              <div className="p-4 border-b border-line">
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-fg mb-2">
                  <Sparkles
                    className="w-4 h-4 text-fg-label"
                    strokeWidth={1.5}
                  />
                  {t('settings.engine')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['openai', 'gemini'] as TranslationEngine[]).map((eng) => (
                    <button
                      key={eng}
                      type="button"
                      onClick={() => setEngine(eng)}
                      disabled={state.isActive}
                      className={`p-3 text-left rounded-lg border transition-colors ${
                        settings.engine === eng
                          ? 'border-line-strong bg-selected'
                          : 'border-line hover:bg-hover'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className="font-semibold text-[13px] text-fg">
                        {ENGINE_INFO[eng].label}
                        {eng === 'openai' && (
                          <span className="ml-1.5 text-xs font-medium text-fg-hint">
                            {t('settings.engineDefault')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-fg-hint mt-0.5">
                        {ENGINE_INFO[eng].tagline}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key */}
              <div className="p-4 border-b border-line">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 pt-0.5">
                    <Key className="w-4 h-4 text-fg-label" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[13px] font-semibold text-fg mb-1">
                      {t(`settings.apiKey.${settings.engine}`)}
                    </label>
                    <p className="text-xs text-fg-hint mb-2">
                      {t(`settings.apiKeyDescription.${settings.engine}`)}
                    </p>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => apiKeyHandler(e.target.value)}
                      placeholder={t(
                        `settings.apiKeyPlaceholder.${settings.engine}`,
                      )}
                      className="w-full px-3 py-2 text-[13px] bg-field text-fg border border-line rounded-[10px] focus:border-focus outline-none placeholder:text-fg-hint"
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
                          className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 text-xs font-medium bg-primary hover:bg-indigo-700 text-white rounded-lg transition-colors"
                        >
                          {t('settings.getApiKey')}
                          <ExternalLink className="w-3 h-3" strokeWidth={2} />
                        </a>
                      </div>
                    )}
                    {apiKey && (
                      <p className="mt-1.5 text-xs text-ok">
                        {t('settings.apiKeyConfigured')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Output Modality */}
              <div className="p-4 border-b border-line">
                <label className="block text-[13px] font-semibold text-fg mb-1.5">
                  {t('settings.outputModality')}
                </label>
                <p className="text-xs text-fg-hint mb-2">
                  {t('settings.outputModalityDescription')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(['audio_text', 'text_only'] as OutputModality[]).map(
                    (mod) => (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => updateSetting('outputModality', mod)}
                        disabled={state.isActive}
                        className={`p-3 text-left rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          settings.outputModality === mod
                            ? 'border-line-strong bg-selected'
                            : 'border-line hover:bg-hover'
                        }`}
                      >
                        <div className="font-semibold text-[13px] text-fg">
                          {t(`settings.outputModality_${mod}`)}
                        </div>
                        <div className="text-xs text-fg-hint mt-0.5">
                          {t(`settings.outputModality_${mod}_description`)}
                        </div>
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Source Language */}
              <div className="p-4 border-b border-line">
                <label className="block text-[13px] font-medium text-fg-body mb-1.5">
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
              <div className="p-4 border-b border-line">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[13px] font-semibold text-fg">
                    {t('settings.targetLanguages')}
                  </label>
                  <span className="text-xs text-fg-hint">
                    {t('settings.targetLanguagesHint')}
                  </span>
                </div>

                <div className="space-y-2">
                  {settings.targets.map((target) => (
                    <div
                      key={target.id}
                      className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg border border-line"
                    >
                      <div
                        className={`flex-1 grid grid-cols-1 gap-2 ${settings.outputModality === 'text_only' ? '' : 'sm:grid-cols-2'}`}
                      >
                        <div>
                          <label className="block text-xs font-medium text-fg-label mb-1">
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
                            <label className="flex items-center gap-1.5 text-xs font-medium text-fg-label mb-1">
                              <Volume2 className="w-3 h-3" strokeWidth={2} />
                              {t('settings.voice')}
                            </label>
                            <Combobox
                              options={voiceOptions}
                              value={target.voiceName}
                              onChange={(v) =>
                                updateTarget(target.id, {
                                  voiceName:
                                    (v as string) ||
                                    voiceOptions[0]?.value ||
                                    '',
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
                          className={`flex-1 sm:flex-none px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                            settings.primaryTargetId === target.id
                              ? 'bg-selected text-fg'
                              : 'bg-field text-fg-label hover:bg-hover hover:text-fg'
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
                            className="px-2.5 py-1.5 text-fg-label hover:bg-hover hover:text-red-600 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <X className="w-4 h-4" strokeWidth={1.5} />
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
                      className="flex items-center justify-center gap-2 w-full px-3 py-2 text-[13px] font-medium border border-dashed border-line-strong text-fg-label hover:bg-hover hover:text-fg rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" strokeWidth={1.5} />
                      {t('settings.addTarget')}
                    </button>
                  )}
                </div>
              </div>

              {/* Audio Devices */}
              {audioDevices.length > 0 && (
                <div className="p-4 border-b border-line grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-[13px] font-medium text-fg-body mb-1.5">
                      <Mic
                        className="w-3.5 h-3.5 text-fg-label"
                        strokeWidth={1.75}
                      />
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
                    <label className="flex items-center gap-1.5 text-[13px] font-medium text-fg-body mb-1.5">
                      <Volume2
                        className="w-3.5 h-3.5 text-fg-label"
                        strokeWidth={1.75}
                      />
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
                <label className="block text-[13px] font-medium text-fg-body mb-1.5">
                  {t('settings.outputMode')}
                </label>
                <p className="text-xs text-fg-hint mb-2">
                  {t('settings.outputModeDescription')}
                </p>
                <div className="flex gap-2 mb-3">
                  {(['device', 'webrtc', 'both'] as OutputMode[]).map(
                    (mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => updateSetting('outputMode', mode)}
                        disabled={state.isActive}
                        className={`flex-1 px-3 py-2 text-[13px] font-medium rounded-lg transition-colors disabled:opacity-50 ${
                          settings.outputMode === mode
                            ? 'bg-selected text-fg'
                            : 'bg-field text-fg-label hover:bg-hover hover:text-fg'
                        }`}
                      >
                        {t(
                          `settings.outputMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
                        )}
                      </button>
                    ),
                  )}
                </div>

                {streamUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t('settings.resetSecretConfirm'))) {
                        resetSecret()
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-field hover:bg-hover text-fg-body rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
                    {t('settings.resetSecret')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </dialog>

      {/* Language Bar + Controls */}
      <div className="flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-field rounded-lg text-xs">
            <span className="text-fg-hint font-medium text-xs">
              {t('settings.engine')}
            </span>
            <span className="font-semibold text-fg-body">
              {ENGINE_INFO[settings.engine].label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-field rounded-lg text-[13px]">
            <span className="font-medium text-fg-body">
              {LANGUAGES.find((l) => l.code === settings.sourceLanguage)?.name}
            </span>
            <span className="text-fg-hint">→</span>
            <div className="flex gap-1">
              {settings.targets.map((tgt) => (
                <span
                  key={tgt.id}
                  className={`px-1.5 py-0.5 text-xs rounded-md ${
                    settings.primaryTargetId === tgt.id
                      ? 'bg-selected font-semibold text-fg'
                      : 'text-fg-hint'
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
              className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg transition-colors"
              title={t('controls.clear')}
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}

          <button
            type="button"
            onClick={state.isActive ? stopTranslation : startTranslation}
            disabled={!canStart && !state.isActive}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              state.isActive
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : canStart
                  ? 'bg-primary hover:bg-indigo-700 text-white'
                  : 'bg-field text-fg-hint cursor-not-allowed'
            }`}
          >
            {state.isActive ? (
              <>
                <MicOff className="w-4 h-4" strokeWidth={1.5} />
                {t('controls.stop')}
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" strokeWidth={1.5} />
                {t('controls.start')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Audio Level Meters */}
      {state.isActive && (
        <div className="flex items-center gap-6 px-4 py-3 bg-panel rounded-xl border border-line flex-shrink-0">
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
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          {state.targets.map((tgt) => (
            <span
              key={tgt.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-panel border border-line rounded-full"
            >
              <span className="font-semibold text-fg-body">
                {tgt.targetLanguage.toUpperCase()}
              </span>
              <span className="text-fg-hint">·</span>
              <span className="tabular-nums text-fg-hint">
                {t('settings.listenersCount', { count: tgt.listenerCount })}
              </span>
            </span>
          ))}
        </div>
      )}

      {state.error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm flex-shrink-0">
          {state.error}
        </div>
      )}

      {/* Transcription Area */}
      <div className="flex-1 min-h-0 bg-panel rounded-xl border border-line flex flex-col overflow-hidden">
        <TranscriptionDisplay
          entries={state.transcription}
          sourceLanguage={settings.sourceLanguage}
        />
      </div>
    </div>
  )
}
