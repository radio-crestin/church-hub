/** biome-ignore-all lint/suspicious/noConsole: diagnostic CLI script */
/**
 * Isolated probe for the Gemini live-translate model. Connects with your key
 * and prints the exact open/close result so you can tell a billing/access
 * problem apart from an app bug.
 *
 * Run from apps/server:
 *   GEMINI_API_KEY=your_key bun scripts/probe-live-translate.ts en
 */
import { GoogleGenAI, Modality } from '@google/genai'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('Set GEMINI_API_KEY=...')
  process.exit(1)
}
const target = process.argv[2] || 'en'
const model = 'gemini-3.5-live-translate-preview'

console.log(`Connecting to ${model} (target=${target})…`)

const ai = new GoogleGenAI({ apiKey })
ai.live
  .connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],
      translationConfig: {
        targetLanguageCode: target,
        echoTargetLanguage: false,
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
    callbacks: {
      onopen: () => {
        console.log(
          '✅ OPEN — the model accepted the session. Billing/access OK.',
        )
        setTimeout(() => process.exit(0), 500)
      },
      onmessage: () => {
        // not needed — the probe only cares about open vs close
      },
      onerror: (e: unknown) => {
        const err = e as { message?: string }
        console.log('⚠️  ERROR:', err?.message || String(e))
      },
      onclose: (e: unknown) => {
        const ev = e as { code?: number; reason?: string }
        console.log(`❌ CLOSED code=${ev?.code} reason="${ev?.reason || ''}"`)
        process.exit(0)
      },
    },
  })
  .catch((e) => {
    console.log('CONNECT FAILED:', String(e))
    process.exit(1)
  })

setTimeout(() => {
  console.log('timed out waiting for a response')
  process.exit(0)
}, 10000)
