import { describe, expect, it } from 'bun:test'
import { migrateSettings } from '../migrate-settings'

describe('migrateSettings', () => {
  it('returns defaults when passed null/undefined/empty', () => {
    const a = migrateSettings(undefined)
    const b = migrateSettings(null)
    const c = migrateSettings({})

    for (const out of [a, b, c]) {
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
      geminiApiKey: 'gem-key',
      inputDeviceId: 3,
      outputDeviceId: 4,
      outputMode: 'both' as const,
    }
    const out = migrateSettings(legacy)

    expect(out.targets).toHaveLength(1)
    expect(out.targets[0]!.targetLanguage).toBe('hu')
    expect(out.targets[0]!.id).toMatch(/^tgt-/)
    expect(out.geminiApiKey).toBe('gem-key')
    expect(out.inputDeviceId).toBe(3)
    expect(out.outputDeviceId).toBe(4)
    expect(out.outputMode).toBe('both')
    // primaryTargetId defaults to the only target's id
    expect(out.primaryTargetId).toBe(out.targets[0]!.id)
  })

  it('drops legacy engine/voice/modality/openai fields cleanly', () => {
    const legacy = {
      engine: 'openai',
      outputModality: 'text_only',
      openaiApiKey: 'oai-key',
      geminiApiKey: 'gem-key',
      sourceLanguage: 'ro',
      targets: [{ id: 'tgt-en', targetLanguage: 'en', voiceName: 'alloy' }],
      primaryTargetId: 'tgt-en',
    }
    const out = migrateSettings(legacy)
    const record = out as unknown as Record<string, unknown>

    // Removed feature fields must not survive
    expect(record.engine).toBeUndefined()
    expect(record.outputModality).toBeUndefined()
    expect(record.openaiApiKey).toBeUndefined()
    expect(
      (out.targets[0] as unknown as Record<string, unknown>).voiceName,
    ).toBeUndefined()

    // Everything still relevant is preserved
    expect(out.targets).toHaveLength(1)
    expect(out.targets[0]!.id).toBe('tgt-en')
    expect(out.targets[0]!.targetLanguage).toBe('en')
    expect(out.geminiApiKey).toBe('gem-key')
    expect(out.primaryTargetId).toBe('tgt-en')
  })

  it('preserves existing multi-target shape', () => {
    const persisted = {
      sourceLanguage: 'ro',
      targets: [
        { id: 'tgt-en', targetLanguage: 'en' },
        { id: 'tgt-de', targetLanguage: 'de' },
      ],
      primaryTargetId: 'tgt-de',
      geminiApiKey: 'gem-key',
    }
    const out = migrateSettings(persisted)

    expect(out.targets).toHaveLength(2)
    expect(out.targets[0]!.id).toBe('tgt-en')
    expect(out.targets[1]!.targetLanguage).toBe('de')
    expect(out.primaryTargetId).toBe('tgt-de')
    expect(out.geminiApiKey).toBe('gem-key')
  })

  it('synthesizes target id when missing', () => {
    const out = migrateSettings({
      targets: [{ targetLanguage: 'en' }],
    })
    expect(out.targets[0]!.id).toMatch(/^tgt-/)
    expect(out.primaryTargetId).toBe(out.targets[0]!.id)
  })

  it('coerces unknown outputMode to default device', () => {
    const out = migrateSettings({ outputMode: 'multicast' })
    expect(out.outputMode).toBe('device')
  })
})
