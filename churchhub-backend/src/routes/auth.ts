import { Hono } from 'hono'
import type { Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Bindings, OAuthState, TokenResult } from '../types'
import { encryptState, decryptState } from '../utils/crypto'
import { generateCodeVerifier, generateCodeChallenge } from '../utils/pkce'
import { buildAuthUrl, exchangeCodeForTokens, refreshTokens } from '../utils/oauth'
import { isAllowedOrigin } from '../middleware/security'

const auth = new Hono<{ Bindings: Bindings }>()

/** OAuth flow this request belongs to — drives the postMessage type. */
type Provider = 'youtube' | 'drive'

/** Separate state cookie for the Drive flow so a concurrent YouTube
 * authorization can't clobber it (COOKIE_NAME stays the YouTube one). */
const DRIVE_COOKIE_NAME = 'drive_oauth_state'

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

    // Fetch channel info using the access token
    try {
      const channelResponse = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        }
      )

      if (channelResponse.ok) {
        const channelData = await channelResponse.json() as {
          items?: Array<{ id: string; snippet?: { title: string } }>
        }
        const channel = channelData.items?.[0]
        if (channel) {
          tokens.channelId = channel.id
          tokens.channelName = channel.snippet?.title
        }
      }
    } catch {
      // Channel fetch failed, continue without channel info
      console.error('Failed to fetch channel info')
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
  tokens: TokenResult,
  provider: Provider = 'youtube'
) {
  const html = `<!DOCTYPE html>
<html>
<head><title>Authorization Complete</title></head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: '${provider}-auth-success',
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
  if (tokens.channelId) {
    url.searchParams.set('channelId', tokens.channelId)
  }
  if (tokens.channelName) {
    url.searchParams.set('channelName', tokens.channelName)
  }
  if (tokens.email) {
    url.searchParams.set('email', tokens.email)
  }

  return c.redirect(url.toString())
}

/**
 * Renders an error response via postMessage or HTML.
 */
function renderErrorResponse(
  c: Context<{ Bindings: Bindings }>,
  error: string,
  state: OAuthState | null,
  provider: Provider = 'youtube'
) {
  if (state?.returnMode === 'postMessage' && state.origin) {
    const html = `<!DOCTYPE html>
<html>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: '${provider}-auth-error',
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

  // Redirect mode: hand the error back to the caller's returnUrl so its own
  // callback page can present (and self-close) instead of stranding the user
  // on the worker.
  if (state?.returnMode === 'redirect' && state.returnUrl) {
    const url = new URL(state.returnUrl)
    url.searchParams.set('error', error)
    return c.redirect(url.toString())
  }

  return c.html(
    `<!DOCTYPE html>
<html>
<body><p>Authorization failed: ${error}</p></body>
</html>`,
    400
  )
}

/**
 * POST /auth/youtube/refresh
 * Refreshes an access token using a refresh token.
 * Used by the server when access tokens expire.
 */
auth.post('/auth/youtube/refresh', async (c) => {
  const origin = c.req.header('Origin')

  // Validate origin for CORS
  if (origin && !isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS)) {
    return c.json({ error: 'Invalid origin' }, 403)
  }

  try {
    const body = await c.req.json<{ refreshToken: string }>()

    if (!body.refreshToken) {
      return c.json({ error: 'Missing refresh token' }, 400)
    }

    const tokenResponse = await refreshTokens({
      refreshToken: body.refreshToken,
      clientId: c.env.YOUTUBE_CLIENT_ID,
      clientSecret: c.env.YOUTUBE_CLIENT_SECRET,
    })

    const result: TokenResult = {
      accessToken: tokenResponse.access_token,
      // Refresh tokens don't return a new refresh token, keep the original
      refreshToken: body.refreshToken,
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    }

    return c.json({ success: true, tokens: result })
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Token refresh failed'

    // Check for invalid_grant which means re-auth is required
    const requiresReauth =
      errorMessage.includes('invalid_grant') ||
      errorMessage.includes('Token has been expired or revoked')

    return c.json(
      {
        error: errorMessage,
        requiresReauth,
      },
      requiresReauth ? 401 : 500
    )
  }
})

/**
 * GET /auth/drive
 * Initiates the Google Drive backup OAuth flow. Same PKCE/state mechanics as
 * /auth/youtube and the SAME Google OAuth client (YOUTUBE_CLIENT_ID/SECRET) —
 * only the scopes (drive.appdata + identity) and callback differ, so no new
 * Google credentials are needed. Uses its own state cookie so a concurrent
 * YouTube authorization can't clobber it.
 */
auth.get('/auth/drive', async (c) => {
  const origin = c.req.header('Origin') || c.req.query('origin')
  const returnMode =
    (c.req.query('mode') as 'postMessage' | 'redirect') || 'postMessage'
  const returnUrl = c.req.query('returnUrl')

  if (!origin || !isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS)) {
    return c.json({ error: 'Invalid or missing origin' }, 403)
  }

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  const state: OAuthState = {
    codeVerifier,
    origin,
    returnMode,
    returnUrl,
    createdAt: Date.now(),
  }

  const encryptedState = await encryptState(state, c.env.COOKIE_ENCRYPTION_KEY)

  setCookie(c, DRIVE_COOKIE_NAME, encryptedState, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: c.env.COOKIE_MAX_AGE,
  })

  const authUrl = buildAuthUrl({
    clientId: c.env.YOUTUBE_CLIENT_ID,
    redirectUri: c.env.DRIVE_REDIRECT_URI,
    codeChallenge,
    scope: c.env.DRIVE_SCOPE,
    // Let the user pick which Google account holds the backups.
    prompt: 'select_account consent',
  })

  return c.redirect(authUrl)
})

/**
 * GET /auth/drive/callback
 * Exchanges the code for tokens and attaches the account email (instead of the
 * YouTube channel lookup), then returns them via postMessage or redirect.
 */
auth.get('/auth/drive/callback', async (c) => {
  const code = c.req.query('code')
  const error = c.req.query('error')

  const encryptedState = getCookie(c, DRIVE_COOKIE_NAME)
  deleteCookie(c, DRIVE_COOKIE_NAME, { path: '/' })

  const state = encryptedState
    ? await decryptState(encryptedState, c.env.COOKIE_ENCRYPTION_KEY)
    : null

  if (error) {
    return renderErrorResponse(c, error, state, 'drive')
  }

  if (!code || !state) {
    return renderErrorResponse(
      c,
      'Missing authorization code or state',
      state,
      'drive'
    )
  }

  const maxAgeMs = c.env.COOKIE_MAX_AGE * 1000
  if (Date.now() - state.createdAt > maxAgeMs) {
    return renderErrorResponse(c, 'State expired', state, 'drive')
  }

  try {
    const tokenResponse = await exchangeCodeForTokens({
      code,
      clientId: c.env.YOUTUBE_CLIENT_ID,
      clientSecret: c.env.YOUTUBE_CLIENT_SECRET,
      redirectUri: c.env.DRIVE_REDIRECT_URI,
      codeVerifier: state.codeVerifier,
    })

    const tokens: TokenResult = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || '',
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    }

    // Attach the connected account's email so the app can label the connection.
    try {
      const userinfoResponse = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } }
      )
      if (userinfoResponse.ok) {
        const userinfo = (await userinfoResponse.json()) as { email?: string }
        if (userinfo.email) tokens.email = userinfo.email
      }
    } catch {
      console.error('Failed to fetch userinfo')
    }

    if (state.returnMode === 'postMessage') {
      return renderPostMessageResponse(c, state.origin, tokens, 'drive')
    }
    return renderRedirectResponse(c, state.returnUrl, tokens)
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Token exchange failed'
    return renderErrorResponse(c, errorMessage, state, 'drive')
  }
})

/**
 * POST /auth/drive/refresh
 * Refreshes a Drive access token. Same Google client as YouTube.
 */
auth.post('/auth/drive/refresh', async (c) => {
  const origin = c.req.header('Origin')

  if (origin && !isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS)) {
    return c.json({ error: 'Invalid origin' }, 403)
  }

  try {
    const body = await c.req.json<{ refreshToken: string }>()

    if (!body.refreshToken) {
      return c.json({ error: 'Missing refresh token' }, 400)
    }

    const tokenResponse = await refreshTokens({
      refreshToken: body.refreshToken,
      clientId: c.env.YOUTUBE_CLIENT_ID,
      clientSecret: c.env.YOUTUBE_CLIENT_SECRET,
    })

    const result: TokenResult = {
      accessToken: tokenResponse.access_token,
      refreshToken: body.refreshToken,
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    }

    return c.json({ success: true, tokens: result })
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Token refresh failed'
    const requiresReauth =
      errorMessage.includes('invalid_grant') ||
      errorMessage.includes('Token has been expired or revoked')

    return c.json(
      { error: errorMessage, requiresReauth },
      requiresReauth ? 401 : 500
    )
  }
})

export default auth
