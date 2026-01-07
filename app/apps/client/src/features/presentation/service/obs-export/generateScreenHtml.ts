import type { ScreenExportConfig } from './types'

/**
 * Generates a standalone HTML file for OBS Browser Source
 * The HTML connects to Church Hub server via WebSocket for real-time content updates
 */
export function generateScreenHtml(config: ScreenExportConfig): string {
  const { screenId, serverUrl, screenName } = config

  // Derive WebSocket URL from server URL
  const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws'

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
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    #root {
      width: 100%;
      height: 100%;
      position: relative;
    }

    .screen-container {
      width: 100%;
      height: 100%;
      position: relative;
    }

    .text-element {
      position: absolute;
      display: flex;
      overflow: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .text-element.align-left { text-align: left; }
    .text-element.align-center { text-align: center; }
    .text-element.align-right { text-align: right; }
    .text-element.align-justify { text-align: justify; }

    .text-element.valign-top { align-items: flex-start; }
    .text-element.valign-middle { align-items: center; }
    .text-element.valign-bottom { align-items: flex-end; }

    .text-content {
      width: 100%;
    }

    /* Animation classes */
    .fade-in { animation: fadeIn var(--anim-duration, 300ms) var(--anim-easing, ease) forwards; }
    .fade-out { animation: fadeOut var(--anim-duration, 300ms) var(--anim-easing, ease) forwards; }
    .slide-up-in { animation: slideUpIn var(--anim-duration, 300ms) var(--anim-easing, ease) forwards; }
    .slide-up-out { animation: slideUpOut var(--anim-duration, 300ms) var(--anim-easing, ease) forwards; }
    .slide-down-in { animation: slideDownIn var(--anim-duration, 300ms) var(--anim-easing, ease) forwards; }
    .slide-down-out { animation: slideDownOut var(--anim-duration, 300ms) var(--anim-easing, ease) forwards; }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes slideUpIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideUpOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-20px); } }
    @keyframes slideDownIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideDownOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(20px); } }

    .hidden { display: none !important; }

  </style>
</head>
<body>
  <div id="root">
    <div id="screen-container" class="screen-container"></div>
  </div>

  <script>
    (function() {
      'use strict';

      // Configuration
      const CONFIG = {
        serverUrl: '${serverUrl}',
        wsUrl: '${wsUrl}',
        screenId: ${screenId}
      };

      // State
      let screenConfig = null;
      let presentationState = null;
      let ws = null;
      let reconnectTimeout = null;
      let missedPongs = 0;
      let pingInterval = null;
      let pongTimeout = null;

      const PING_INTERVAL = 3000;
      const PONG_TIMEOUT = 2000;
      const MAX_MISSED_PONGS = 3;

      // DOM elements
      const container = document.getElementById('screen-container');

      // Fetch screen configuration
      async function fetchScreenConfig() {
        try {
          const response = await fetch(CONFIG.serverUrl + '/api/screens/' + CONFIG.screenId);
          if (!response.ok) throw new Error('Failed to fetch screen config');
          const data = await response.json();
          screenConfig = data.data;
          render();
        } catch (error) {
          console.error('Failed to fetch screen config:', error);
          setTimeout(fetchScreenConfig, 5000);
        }
      }

      // Connect to WebSocket
      function connect() {
        if (ws && ws.readyState === WebSocket.OPEN) return;

        try {
          ws = new WebSocket(CONFIG.wsUrl);

          ws.onopen = () => {
            missedPongs = 0;

            // Fetch latest presentation state
            fetchPresentationState();

            // Start ping interval
            pingInterval = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));

                pongTimeout = setTimeout(() => {
                  missedPongs++;
                  if (missedPongs >= MAX_MISSED_PONGS) {
                    console.log('Connection lost - 3 pongs missed');
                    ws.close();
                  }
                }, PONG_TIMEOUT);
              }
            }, PING_INTERVAL);
          };

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);

              if (data.type === 'pong') {
                missedPongs = 0;
                clearTimeout(pongTimeout);
                return;
              }

              if (data.type === 'presentation_state') {
                // Only update if newer
                if (!presentationState || data.payload.updatedAt > presentationState.updatedAt) {
                  presentationState = data.payload;
                  render();
                }
              }

              if (data.type === 'screen_config_updated' && data.payload.screenId === CONFIG.screenId) {
                fetchScreenConfig();
              }

              if (data.type === 'screen_config_preview' && data.payload.screenId === CONFIG.screenId) {
                screenConfig = data.payload.config;
                render();
              }
            } catch (e) {
              console.error('Failed to parse message:', e);
            }
          };

          ws.onerror = () => {
            // Silent error handling - will reconnect
          };

          ws.onclose = () => {
            clearInterval(pingInterval);
            clearTimeout(pongTimeout);

            // Silent reconnect in background
            reconnectTimeout = setTimeout(connect, 3000);
          };
        } catch (error) {
          // Silent reconnect in background
          reconnectTimeout = setTimeout(connect, 5000);
        }
      }

      // Fetch presentation state via HTTP
      async function fetchPresentationState() {
        try {
          const response = await fetch(CONFIG.serverUrl + '/api/presentation/state');
          if (!response.ok) throw new Error('Failed to fetch presentation state');
          const data = await response.json();
          if (data.data) {
            presentationState = data.data;
            render();
          }
        } catch (error) {
          console.error('Failed to fetch presentation state:', error);
        }
      }

      // Calculate pixel bounds from constraints
      function calculateBounds(constraints, size, canvasWidth, canvasHeight) {
        let x = 0, y = 0, width = 0, height = 0;

        // Calculate width
        if (size.widthUnit === '%') {
          width = (size.width / 100) * canvasWidth;
        } else {
          width = size.width;
        }

        // Calculate height
        if (size.heightUnit === '%') {
          height = (size.height / 100) * canvasHeight;
        } else {
          height = size.height;
        }

        // Calculate X position
        if (constraints.left.enabled) {
          x = constraints.left.unit === '%'
            ? (constraints.left.value / 100) * canvasWidth
            : constraints.left.value;
        } else if (constraints.right.enabled) {
          const rightOffset = constraints.right.unit === '%'
            ? (constraints.right.value / 100) * canvasWidth
            : constraints.right.value;
          x = canvasWidth - rightOffset - width;
        }

        // Calculate Y position
        if (constraints.top.enabled) {
          y = constraints.top.unit === '%'
            ? (constraints.top.value / 100) * canvasHeight
            : constraints.top.value;
        } else if (constraints.bottom.enabled) {
          const bottomOffset = constraints.bottom.unit === '%'
            ? (constraints.bottom.value / 100) * canvasHeight
            : constraints.bottom.value;
          y = canvasHeight - bottomOffset - height;
        }

        return { x, y, width, height };
      }

      // Get background CSS
      function getBackgroundCSS(bg) {
        if (!bg) return 'transparent';
        if (bg.type === 'transparent') return 'transparent';
        if (bg.type === 'color') return bg.color || 'transparent';
        if (bg.type === 'image' && bg.imageUrl) {
          return 'url(' + bg.imageUrl + ') center/cover no-repeat';
        }
        return 'transparent';
      }

      // Get text style CSS
      function getTextStyleCSS(style, fontScale) {
        const css = {};
        css.fontFamily = style.fontFamily || 'system-ui';
        css.fontSize = (style.maxFontSize * fontScale) + 'px';
        css.color = style.color || '#ffffff';
        css.fontWeight = style.bold ? 'bold' : 'normal';
        css.fontStyle = style.italic ? 'italic' : 'normal';
        css.textDecoration = style.underline ? 'underline' : 'none';
        css.lineHeight = style.lineHeight || 1.2;

        if (style.shadow) {
          css.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        }

        return css;
      }

      // Main render function
      function render() {
        if (!screenConfig || !container) return;

        const canvasWidth = screenConfig.width || 1920;
        const canvasHeight = screenConfig.height || 1080;
        const containerWidth = window.innerWidth;
        const containerHeight = window.innerHeight;

        const scaleX = containerWidth / canvasWidth;
        const scaleY = containerHeight / canvasHeight;
        const fontScale = Math.min(scaleX, scaleY);

        // Determine content type and data
        let contentType = 'empty';
        let contentData = null;

        if (presentationState && !presentationState.isHidden) {
          const temp = presentationState.temporaryContent;

          if (temp) {
            if (temp.type === 'bible') {
              contentType = 'bible';
              const reference = temp.data.reference.replace(/\\s*-\\s*[A-Z]+\\s*$/, '');
              contentData = {
                referenceText: reference,
                contentText: temp.data.text
              };
            } else if (temp.type === 'song') {
              contentType = 'song';
              const slide = temp.data.slides[temp.data.currentSlideIndex];
              if (slide) {
                contentData = { mainText: slide.content };
              }
            } else if (temp.type === 'announcement') {
              contentType = 'announcement';
              contentData = { mainText: temp.data.content };
            } else if (temp.type === 'bible_passage') {
              contentType = 'bible_passage';
              const verse = temp.data.verses[temp.data.currentVerseIndex];
              if (verse) {
                const reference = temp.data.bookName + ' ' + temp.data.startChapter + ':' + verse.verse;
                contentData = {
                  referenceText: reference,
                  contentText: verse.text
                };
              }
            } else if (temp.type === 'versete_tineri') {
              contentType = 'versete_tineri';
              const entry = temp.data.entries[temp.data.currentEntryIndex];
              if (entry) {
                contentData = {
                  personLabel: entry.personName,
                  referenceText: entry.reference,
                  contentText: entry.text
                };
              }
            }
          }
        }

        // Get config for current content type
        const config = screenConfig.contentConfigs[contentType] || screenConfig.contentConfigs.empty;
        const bg = config?.background || screenConfig.contentConfigs.empty?.background;

        // Apply background
        container.style.background = getBackgroundCSS(bg);

        // Clear and rebuild content
        container.innerHTML = '';

        if (contentType === 'empty' || !contentData) {
          return;
        }

        // Render text elements based on content type
        if (contentType === 'song' || contentType === 'announcement') {
          if (config.mainText && contentData.mainText) {
            renderTextElement(config.mainText, contentData.mainText, canvasWidth, canvasHeight, scaleX, scaleY, fontScale, true);
          }
        } else if (contentType === 'bible' || contentType === 'bible_passage') {
          if (config.referenceText && contentData.referenceText && !config.includeReferenceInContent) {
            renderTextElement(config.referenceText, contentData.referenceText, canvasWidth, canvasHeight, scaleX, scaleY, fontScale, false);
          }
          if (config.contentText && contentData.contentText) {
            let displayContent = contentData.contentText;
            if (config.includeReferenceInContent && contentData.referenceText) {
              displayContent = contentData.referenceText + ' ' + displayContent;
            }
            renderTextElement(config.contentText, displayContent, canvasWidth, canvasHeight, scaleX, scaleY, fontScale, false);
          }
        } else if (contentType === 'versete_tineri') {
          if (config.personLabel && contentData.personLabel) {
            renderTextElement(config.personLabel, contentData.personLabel, canvasWidth, canvasHeight, scaleX, scaleY, fontScale, false);
          }
          if (config.referenceText && contentData.referenceText) {
            renderTextElement(config.referenceText, contentData.referenceText, canvasWidth, canvasHeight, scaleX, scaleY, fontScale, false);
          }
          if (config.contentText && contentData.contentText) {
            renderTextElement(config.contentText, contentData.contentText, canvasWidth, canvasHeight, scaleX, scaleY, fontScale, false);
          }
        }
      }

      // Render a text element
      function renderTextElement(elementConfig, text, canvasWidth, canvasHeight, scaleX, scaleY, fontScale, isHtml) {
        if (elementConfig.hidden) return;

        const bounds = calculateBounds(elementConfig.constraints, elementConfig.size, canvasWidth, canvasHeight);
        const scaledBounds = {
          x: bounds.x * scaleX,
          y: bounds.y * scaleY,
          width: bounds.width * scaleX,
          height: bounds.height * scaleY
        };

        const el = document.createElement('div');
        el.className = 'text-element';
        el.className += ' align-' + (elementConfig.style.alignment || 'center');
        el.className += ' valign-' + (elementConfig.style.verticalAlignment || 'middle');

        el.style.left = scaledBounds.x + 'px';
        el.style.top = scaledBounds.y + 'px';
        el.style.width = scaledBounds.width + 'px';
        el.style.height = scaledBounds.height + 'px';

        const textStyle = getTextStyleCSS(elementConfig.style, fontScale);
        Object.assign(el.style, textStyle);

        const contentEl = document.createElement('div');
        contentEl.className = 'text-content';

        if (isHtml) {
          // Convert HTML to display (basic support for line breaks)
          contentEl.innerHTML = text.replace(/\\n/g, '<br>');
        } else {
          contentEl.textContent = text;
        }

        el.appendChild(contentEl);
        container.appendChild(el);

        // Apply animation
        if (elementConfig.animationIn && elementConfig.animationIn.type !== 'none') {
          const anim = elementConfig.animationIn;
          el.style.setProperty('--anim-duration', anim.duration + 'ms');
          el.style.setProperty('--anim-easing', anim.easing || 'ease');

          if (anim.type === 'fade') el.classList.add('fade-in');
          else if (anim.type === 'slide-up') el.classList.add('slide-up-in');
          else if (anim.type === 'slide-down') el.classList.add('slide-down-in');
        }
      }

      // Handle window resize
      window.addEventListener('resize', () => {
        render();
      });

      // Initialize
      fetchScreenConfig();
      connect();
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
