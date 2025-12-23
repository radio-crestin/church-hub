import { Hono } from 'hono'
import type { Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Bindings, OAuthState, TokenResult } from '../types'
import { encryptState, decryptState } from '../utils/crypto'
import { generateCodeVerifier, generateCodeChallenge } from '../utils/pkce'
import { buildAuthUrl, exchangeCodeForTokens } from '../utils/oauth'
import { isAllowedOrigin } from '../middleware/security'

const auth = new Hono<{ Bindings: Bindings }>()

/**
 * GET /auth/youtube
 * Initiates OAuth flow by generating PKCE, storing state in encrypted cookie,
 * and redirecting to Google OAuth.
 */
auth.get('/auth/youtube', async (c) => {
  const origin = c.req.header('Origin') || c.req.query('origin')
  const returnMode =
    (c.req.query('mode') as 'postMessage' | 'redirect') || 'postMessage'
  const returnUrl = c.req.query('returnUrl')

  // Validate origin against allowed origins
  if (!origin || !isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS)) {
    return c.json({ error: 'Invalid or missing origin' }, 403)
  }

  // Generate PKCE values
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  // Create state object
  const state: OAuthState = {
    codeVerifier,
    origin,
    returnMode,
    returnUrl,
    createdAt: Date.now(),
  }

  // Encrypt and store in cookie
  const encryptedState = await encryptState(state, c.env.COOKIE_ENCRYPTION_KEY)

  setCookie(c, c.env.COOKIE_NAME, encryptedState, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: c.env.COOKIE_MAX_AGE,
  })

  // Build Google OAuth URL
  const authUrl = buildAuthUrl({
    clientId: c.env.YOUTUBE_CLIENT_ID,
    redirectUri: c.env.YOUTUBE_REDIRECT_URI,
    codeChallenge,
    scope: c.env.YOUTUBE_SCOPE,
  })

  // Redirect to Google
  return c.redirect(authUrl)
})

/**
 * GET /auth/youtube/callback
 * Handles OAuth callback from Google, exchanges code for tokens,
 * and returns tokens via postMessage or redirect.
 */
auth.get('/auth/youtube/callback', async (c) => {
  const code = c.req.query('code')
  const error = c.req.query('error')

  // Read encrypted state from cookie
  const encryptedState = getCookie(c, c.env.COOKIE_NAME)

  // Delete the cookie immediately (one-time use)
  deleteCookie(c, c.env.COOKIE_NAME, { path: '/' })

  if (error) {
    return renderErrorResponse(c, error, null)
  }

  if (!code || !encryptedState) {
    return renderErrorResponse(c, 'Missing authorization code or state', null)
  }

  // Decrypt state
  const state = await decryptState(encryptedState, c.env.COOKIE_ENCRYPTION_KEY)

  if (!state) {
    return renderErrorResponse(c, 'Invalid or expired state', null)
  }

  // Check expiration
  const maxAgeMs = c.env.COOKIE_MAX_AGE * 1000
  if (Date.now() - state.createdAt > maxAgeMs) {
    return renderErrorResponse(c, 'State expired', state)
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForTokens({
      code,
      clientId: c.env.YOUTUBE_CLIENT_ID,
      clientSecret: c.env.YOUTUBE_CLIENT_SECRET,
      redirectUri: c.env.YOUTUBE_REDIRECT_URI,
      codeVerifier: state.codeVerifier,
    })

    const tokens: TokenResult = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || '',
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    }

    // Return tokens based on return mode
    if (state.returnMode === 'postMessage') {
      return renderPostMessageResponse(c, state.origin, tokens)
    } else {
      return renderRedirectResponse(c, state.returnUrl, tokens)
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Token exchange failed'
    return renderErrorResponse(c, errorMessage, state)
  }
})

/**
 * Renders an HTML page that sends tokens via postMessage to the opener window.
 */
function renderPostMessageResponse(
  c: Context<{ Bindings: Bindings }>,
  origin: string,
  tokens: TokenResult
) {
  const html = `<!DOCTYPE html>
<html>
<head><title>Authorization Complete</title></head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: 'youtube-auth-success',
        tokens: ${JSON.stringify(tokens)}
      }, '${origin}');
      window.close();
    } else {
      document.body.innerHTML = '<p>Authorization successful. You can close this window.</p>';
    }
  </script>
  <p>Authorization successful. This window will close automatically.</p>
</body>
</html>`

  return c.html(html)
}

/**
 * Renders a redirect response with tokens in query parameters.
 */
function renderRedirectResponse(
  c: Context<{ Bindings: Bindings }>,
  returnUrl: string | undefined,
  tokens: TokenResult
) {
  if (!returnUrl) {
    return c.html(
      `<!DOCTYPE html>
<html>
<body><p>Authorization successful! You can close this window.</p></body>
</html>`
    )
  }

  const url = new URL(returnUrl)
  url.searchParams.set('accessToken', tokens.accessToken)
  url.searchParams.set('refreshToken', tokens.refreshToken)
  url.searchParams.set('expiresAt', tokens.expiresAt.toString())

  return c.redirect(url.toString())
}

/**
 * Renders an error response via postMessage or HTML.
 */
function renderErrorResponse(
  c: Context<{ Bindings: Bindings }>,
  error: string,
  state: OAuthState | null
) {
  if (state?.returnMode === 'postMessage' && state.origin) {
    const html = `<!DOCTYPE html>
<html>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: 'youtube-auth-error',
        error: '${error.replace(/'/g, "\\'")}'
      }, '${state.origin}');
      window.close();
    }
  </script>
  <p>Authorization failed: ${error}</p>
</body>
</html>`
    return c.html(html)
  }

  return c.html(
    `<!DOCTYPE html>
<html>
<body><p>Authorization failed: ${error}</p></body>
</html>`,
    400
  )
}

export default auth
