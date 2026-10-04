/**
 * What a secret looks like, for keeping secrets out of fixtures.
 *
 * SECRET_NAME matches a setting or field name that holds a secret.
 * SECRET_VALUE matches the shape of a provider key, whatever field holds it.
 */
export const SECRET_NAME = /api_?key|secret|token|password|credential/i

export const SECRET_VALUE = new RegExp(
  [
    'sk-[A-Za-z0-9_-]{20,}', // OpenAI, OpenRouter (sk-or-), Anthropic (sk-ant-)
    'AIza[0-9A-Za-z_-]{35}', // Google / Gemini
    'gsk_[A-Za-z0-9]{20,}', // Groq
    'xai-[A-Za-z0-9]{20,}', // xAI
    'hf_[A-Za-z]{20,}', // Hugging Face
    'GOCSPX-[A-Za-z0-9_-]{20,}', // Google OAuth client secret
    'ya29\\.[A-Za-z0-9_-]{20,}', // Google OAuth access token
  ].join('|'),
)
