/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0 authentication.
 */

/**
 * Generates a cryptographically random string for PKCE code_verifier.
 * Must be between 43-128 characters using unreserved characters.
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

/**
 * Creates the code_challenge from the code_verifier using SHA-256.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

/**
 * Base64 URL encoding (RFC 4648 Section 5).
 * Removes padding and replaces + with - and / with _.
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
