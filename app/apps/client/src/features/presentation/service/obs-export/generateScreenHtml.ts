import type { ScreenExportConfig } from './types'

/**
 * Generates a standalone HTML file for OBS Browser Source.
 * This is a simple wrapper that embeds the screen via an iframe,
 * ensuring perfect parity with the React app and automatic updates
 * when the server-side rendering changes.
 */
export function generateScreenHtml(config: ScreenExportConfig): string {
  const { screenId, serverUrl, screenName } = config

  const screenUrl = `${serverUrl}/screen/${screenId}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Church Hub - ${escapeHtml(screenName)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
    }

    iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: transparent;
    }
  </style>
</head>
<body>
  <iframe
    id="screen-frame"
    src="${escapeHtml(screenUrl)}"
    allow="autoplay"
    allowtransparency="true"
  ></iframe>

  <script>
    (function() {
      'use strict';

      const CONFIG = {
        serverUrl: '${serverUrl}',
        screenUrl: '${screenUrl}'
      };

      const iframe = document.getElementById('screen-frame');
      let healthCheckInterval = null;
      let healthCheckFailures = 0;
      const HEALTH_CHECK_INTERVAL = 5000;
      const MAX_HEALTH_CHECK_FAILURES = 3;

      // Health check - verify server is reachable
      async function healthCheck() {
        try {
          const response = await fetch(CONFIG.serverUrl + '/api/presentation/state', {
            method: 'GET',
            cache: 'no-store'
          });
          if (response.ok) {
            healthCheckFailures = 0;
            // If iframe was hidden due to previous failures, show it again
            if (iframe.style.visibility === 'hidden') {
              iframe.style.visibility = 'visible';
              iframe.src = CONFIG.screenUrl; // Reload iframe
            }
          } else {
            throw new Error('Server returned non-OK status');
          }
        } catch (error) {
          healthCheckFailures++;
          console.log('Health check failed (' + healthCheckFailures + '/' + MAX_HEALTH_CHECK_FAILURES + ')');

          if (healthCheckFailures >= MAX_HEALTH_CHECK_FAILURES) {
            console.log('Server unreachable - hiding content');
            // Hide iframe to show transparent background
            iframe.style.visibility = 'hidden';
            healthCheckFailures = 0;
          }
        }
      }

      // Start health check interval
      healthCheckInterval = setInterval(healthCheck, HEALTH_CHECK_INTERVAL);

      // Initial health check
      healthCheck();
    })();
  </script>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
