import { describe, expect, it } from 'bun:test'
import { migrateSettings } from '../migrate-settings'

describe('migrateSettings', () => {
  it('returns defaults when passed null/undefined/empty', () => {
    const a = migrateSettings(undefined)
    const b = migrateSettings(null)
    const c = migrateSettings({})

    for (const out of [a, b, c]) {
      expect(out.engine).toBe('openai')
      expect(out.outputModality).toBe('audio_text')
      expect(out.sourceLanguage).toBe('ro')
      expect(out.targets).toHaveLength(1)
      expect(out.targets[0]!.targetLanguage).toBe('en')
      expect(out.outputMode).toBe('device')
      expect(out.primaryTargetId).toBe(out.targets[0]!.id)
    }
  })

  it('migrates legacy single-target shape into targets[]', () => {
    const legacy = {
      sourceLanguage: 'ro',
      targetLanguage: 'hu',
      voiceName: 'Kore',
      geminiApiKey: 'gem-key',
      inputDeviceId: 3,
      outputDeviceId: 4,
      outputMode: 'both' as const,
    }
    const out = migrateSettings(legacy)

    expect(out.targets).toHaveLength(1)
    expect(out.targets[0]!.targetLanguage).toBe('hu')
    expect(out.targets[0]!.voiceName).toBe('Kore')
    expect(out.targets[0]!.id).toMatch(/^tgt-/)
    expect(out.geminiApiKey).toBe('gem-key')
    expect(out.openaiApiKey).toBeUndefined()
    expect(out.inputDeviceId).toBe(3)
    expect(out.outputDeviceId).toBe(4)
    expect(out.outputMode).toBe('both')
    // primaryTargetId defaults to the only target's id
    expect(out.primaryTargetId).toBe(out.targets[0]!.id)
  })

  it('preserves existing multi-target shape', () => {
    const persisted = {
      engine: 'gemini' as const,
      outputModality: 'text_only' as const,
      sourceLanguage: 'ro',
      targets: [
        { id: 'tgt-en', targetLanguage: 'en', voiceName: 'alloy' },
        { id: 'tgt-de', targetLanguage: 'de', voiceName: 'echo' },
      ],
      primaryTargetId: 'tgt-de',
      openaiApiKey: 'oai-key',
    }
    const out = migrateSettings(persisted)

    expect(out.engine).toBe('gemini')
    expect(out.outputModality).toBe('text_only')
    expect(out.targets).toHaveLength(2)
    expect(out.targets[0]!.id).toBe('tgt-en')
    expect(out.targets[1]!.targetLanguage).toBe('de')
    expect(out.primaryTargetId).toBe('tgt-de')
    expect(out.openaiApiKey).toBe('oai-key')
  })

  it('coerces unknown engine to default openai', () => {
    const out = migrateSettings({ engine: 'mistral' })
    expect(out.engine).toBe('openai')
  })

  it('coerces unknown outputModality to default audio_text', () => {
    const out = migrateSettings({ outputModality: 'bananas' })
    expect(out.outputModality).toBe('audio_text')
  })

  it('synthesizes target id when missing', () => {
    const out = migrateSettings({
      targets: [{ targetLanguage: 'en', voiceName: 'alloy' }],
    })
    expect(out.targets[0]!.id).toMatch(/^tgt-/)
    expect(out.primaryTargetId).toBe(out.targets[0]!.id)
  })

  it('coerces unknown outputMode to default device', () => {
    const out = migrateSettings({ outputMode: 'multicast' })
    expect(out.outputMode).toBe('device')
  })
})
