import startupEN from '../../../client/src/i18n/locales/en/startup.json'
import startupRO from '../../../client/src/i18n/locales/ro/startup.json'

function pageTexts(texts: typeof startupEN) {
  return {
    starting: texts.starting,
    steps: texts.steps,
    progress: texts.progress,
    failed: texts.errorBootFailed,
  }
}

/** JSON that is safe inside a <script> element. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

/**
 * The page a browser gets while the server boots (a phone opening Church Hub
 * on the church Wi-Fi, say), instead of the bare `/health` JSON. It shows the
 * current step from `/health`, in the language the app saved (as the client's
 * own loading page does), and reloads once the server is ready.
 */
export function bootLoadingPage(): string {
  const texts = { en: pageTexts(startupEN), ro: pageTexts(startupRO) }
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Church Hub</title>
<style>
  :root { color-scheme: light dark; font-family: Inter, system-ui, sans-serif; }
  body {
    margin: 0; min-height: 100vh; padding: 16px; box-sizing: border-box;
    display: grid; place-content: center; gap: 8px; text-align: center;
    background: Canvas; color: CanvasText;
  }
  h1 { margin: 0; font-size: 17px; font-weight: 600; }
  p { margin: 0; font-size: 14px; color: color-mix(in srgb, CanvasText 70%, Canvas); }
</style>
</head>
<body>
<h1 id="title"></h1>
<p id="step"></p>
<script>
  const all = ${scriptJson(texts)};
  let lang = 'en';
  try { if (localStorage.getItem('church-hub-language') === 'ro') lang = 'ro'; } catch {}
  const text = all[lang];
  document.documentElement.lang = lang;
  const title = document.getElementById('title');
  const step = document.getElementById('step');
  title.textContent = text.starting;

  function stepText(health) {
    const name = text.steps[health.step] || '';
    if (!health.progress) return name;
    const count = text.progress
      .replace('{{done}}', health.progress.done.toLocaleString(lang))
      .replace('{{total}}', health.progress.total.toLocaleString(lang));
    return name + ' · ' + count;
  }

  async function check() {
    try {
      const health = await (await fetch('/health', { cache: 'no-store' })).json();
      if (health.ready) return location.reload();
      if (health.phase === 'failed') {
        title.textContent = text.failed;
        step.textContent = health.error ? health.error.message : '';
        return;
      }
      step.textContent = stepText(health);
    } catch {
      // The real server is taking over the port: ask again.
    }
    setTimeout(check, 1000);
  }
  check();
</script>
</body>
</html>`
}
