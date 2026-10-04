import { sanitizeSettingValue } from './sanitize-setting-value'
import { describe, expect, test } from 'bun:test'

const FAKE_OPENAI_KEY = `sk-proj-${'x'.repeat(40)}`

describe('sanitizeSettingValue', () => {
  test('leaves out a setting whose name looks secret', () => {
    expect(
      sanitizeSettingValue('live_translation_stream_secret', 'abc123'),
    ).toBeNull()
  })

  test('leaves out a setting that is not on the allow-list', () => {
    expect(sanitizeSettingValue('obs_connection', '{"port":4455}')).toBeNull()
    expect(sanitizeSettingValue('youtube_auth', '{"scope":"x"}')).toBeNull()
  })

  test('leaves out a plain value shaped like a key', () => {
    expect(
      sanitizeSettingValue('kiosk_startup_page', FAKE_OPENAI_KEY),
    ).toBeNull()
  })

  test('nulls secret fields at any depth', () => {
    const value = JSON.stringify({
      provider: 'openai',
      apiKey: 'anything',
      engines: { gemini: { geminiApiKey: 'anything', voice: 'Kore' } },
    })

    expect(
      JSON.parse(
        sanitizeSettingValue('live_translation_settings', value) ?? '',
      ),
    ).toEqual({
      provider: 'openai',
      apiKey: null,
      engines: { gemini: { geminiApiKey: null, voice: 'Kore' } },
    })
  })

  test('nulls a key-shaped string under any field name', () => {
    const value = JSON.stringify({ baseUrl: '', note: FAKE_OPENAI_KEY })

    expect(
      JSON.parse(sanitizeSettingValue('ai_search_config', value) ?? ''),
    ).toEqual({
      baseUrl: '',
      note: null,
    })
  })

  test('returns a value without secrets unchanged', () => {
    const value = '{ "theme": "dark" }'
    expect(sanitizeSettingValue('theme', value)).toBe(value)
    expect(sanitizeSettingValue('language', 'ro')).toBe('ro')
  })
})
