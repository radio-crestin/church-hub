# YouTube OAuth Worker

A Cloudflare Worker that handles YouTube OAuth authentication for the ChurchHub app.

## Overview

This worker provides a stateless OAuth flow for YouTube authentication using:
- **PKCE** (Proof Key for Code Exchange) for enhanced security
- **Encrypted cookies** for state management (no database required)
- **AES-256-GCM** encryption for cookie security

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/youtube` | GET | Initiates OAuth flow, redirects to Google |
| `/auth/youtube/callback` | GET | Handles Google callback, returns tokens |
| `/health` | GET | Health check endpoint |

## Google Cloud Console Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **YouTube Data API v3**:
   - Navigate to **APIs & Services** > **Library**
   - Search for "YouTube Data API v3"
   - Click **Enable**

### 2. Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type (or Internal if using Google Workspace)
3. Fill in the required fields:
   - **App name**: ChurchHub
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Click **Save and Continue**
5. Add scopes:
   - Click **Add or Remove Scopes**
   - Search for and select: `https://www.googleapis.com/auth/youtube.force-ssl`
   - Click **Update**
6. Add test users (if in testing mode):
   - Add the Google accounts that will test the integration
7. Complete the wizard

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Desktop app** as the application type
   - Note: Desktop app type is recommended because it requires PKCE and allows the client secret to be embedded (per Google's guidelines)
4. Name it (e.g., "ChurchHub Desktop")
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

### 4. Add Redirect URIs

1. In the OAuth client settings, add these **Authorized redirect URIs**:

   **Development:**
   ```
   http://localhost:8787/auth/youtube/callback
   ```

   **Production:**
   ```
   https://churchub-youtube-oauth-worker.bringes.io/auth/youtube/callback
   ```

2. Click **Save**

## Local Development

### 1. Install Dependencies

```bash
cd youtube-oauth-worker
npm install
```

### 2. Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```env
YOUTUBE_CLIENT_ID=your-client-id-from-google
YOUTUBE_CLIENT_SECRET=your-client-secret-from-google
YOUTUBE_REDIRECT_URI=http://localhost:8787/auth/youtube/callback
COOKIE_ENCRYPTION_KEY=your-32-byte-hex-key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8086
```

Generate an encryption key:

```bash
openssl rand -hex 32
```

### 3. Run Development Server

```bash
npm run dev
```

The worker will be available at `http://localhost:8787`

### 4. Test the Flow

1. Start your ChurchHub app (should be running on `http://localhost:3000`)
2. Navigate to the livestream settings
3. Click "Connect YouTube"
4. Complete the OAuth flow in the popup

## Production Deployment

### 1. Deploy to Cloudflare

```bash
npm run deploy
```

### 2. Configure Production Environment

Create `.prod.vars` with your production values:

```env
YOUTUBE_CLIENT_ID=your-client-id
YOUTUBE_CLIENT_SECRET=your-client-secret
YOUTUBE_REDIRECT_URI=https://churchub-youtube-oauth-worker.bringes.io/auth/youtube/callback
COOKIE_ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
ALLOWED_ORIGINS=https://churchub-youtube-oauth-worker.bringes.io,http://localhost:3000
```

Then deploy with production vars:

```bash
npm run deploy:prod
```

### 3. Configure Custom Domain (Optional)

The `wrangler.toml` is configured to use `churchub-youtube-oauth-worker.bringes.io`.

To set up the custom domain:
1. Go to Cloudflare Dashboard > Workers & Pages
2. Select the worker
3. Go to **Settings** > **Triggers** > **Custom Domains**
4. Add `churchub-youtube-oauth-worker.bringes.io`
5. Cloudflare will automatically configure DNS and SSL

### 4. Update Client Configuration

In your ChurchHub app, update the environment variable:

```env
VITE_YOUTUBE_OAUTH_SERVER=https://churchub-youtube-oauth-worker.bringes.io
```

## Security Considerations

| Feature | Implementation |
|---------|---------------|
| PKCE Code Verifier | Encrypted with AES-256-GCM in HTTP-only cookie |
| State Management | Encrypted cookie with origin validation |
| XSS Protection | Strict postMessage origin validation |
| Token Security | Server-side exchange, client secret not exposed to browser |
| Replay Prevention | One-time cookie consumption, 10-minute TTL |
| Transport Security | HTTPS enforced, HSTS headers |

## Troubleshooting

### "Invalid or missing origin" error

- Ensure the app's origin is in the `ALLOWED_ORIGINS` list
- Check that the origin is being sent correctly (via header or query param)

### "State expired" error

- The OAuth flow took longer than 10 minutes
- Try again with a faster network connection

### "Token exchange failed" error

- Verify the Google OAuth credentials are correct
- Check that the redirect URI matches exactly in Google Console
- Ensure the YouTube Data API is enabled

### Cookies not being set

- Ensure `SameSite=Lax` is compatible with your setup
- Check browser dev tools for cookie warnings
- Verify HTTPS is being used in production

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   ChurchHub     │────>│  YouTube OAuth       │────>│   Google OAuth  │
│   Client App    │     │  Worker (CF)         │     │   Server        │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
        │                        │                           │
        │  1. Open popup         │                           │
        │  ─────────────>        │                           │
        │                        │  2. Generate PKCE         │
        │                        │  3. Set encrypted cookie  │
        │                        │  4. Redirect to Google    │
        │                        │  ─────────────────────>   │
        │                        │                           │
        │                        │  5. User authorizes       │
        │                        │  <─────────────────────   │
        │                        │                           │
        │                        │  6. Exchange code         │
        │                        │  ─────────────────────>   │
        │                        │                           │
        │                        │  7. Receive tokens        │
        │                        │  <─────────────────────   │
        │                        │                           │
        │  8. postMessage        │                           │
        │  <─────────────        │                           │
        │                        │                           │
        │  9. Store tokens       │                           │
        │  (in main app server)  │                           │
        │                        │                           │
```

## License

MIT
