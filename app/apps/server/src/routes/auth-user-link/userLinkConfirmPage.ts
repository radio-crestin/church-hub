import { escapeHtml } from '../../service/text-search/text/escapeHtml'

/**
 * The page a user sign-in link shows when another site's page opened it:
 * the user confirms with a button, which posts the link back from this
 * server's own page. In both app languages, in the app's colours.
 */
export function userLinkConfirmPage(
  userName: string,
  action: string,
): Response {
  const name = escapeHtml(userName)
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Church Hub</title>
<style>
  :root { color-scheme: light dark; --app: #f1f1f1; --panel: #ffffff; --line: #e3e3e3; --fg: #111111; --hint: #5e5e5e; --primary: #0070dd; }
  @media (prefers-color-scheme: dark) { :root { --app: #111111; --panel: #161616; --line: #262626; --fg: #ffffff; --hint: #999999; } }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--app); color: var(--fg); font: 15px/1.5 Inter, system-ui, sans-serif; }
  main { box-sizing: border-box; width: min(100% - 32px, 400px); padding: 24px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; }
  h1 { margin: 0 0 12px; font-size: 18px; font-weight: 600; }
  p { margin: 0 0 8px; }
  .hint { color: var(--hint); font-size: 13px; }
  button { margin-top: 16px; width: 100%; min-height: 44px; border: 0; border-radius: 8px; background: var(--primary); color: #ffffff; font: inherit; font-weight: 600; cursor: pointer; }
  button:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
</style>
</head>
<body>
<main>
  <h1>Sign in to Church Hub</h1>
  <p>Sign in on this device as ${name}?</p>
  <p class="hint">Continue only if you opened this sign-in link yourself.</p>
  <p lang="ro">Te conectezi pe acest dispozitiv ca ${name}?</p>
  <p lang="ro" class="hint">Continuă doar dacă tu ai deschis acest link de conectare.</p>
  <form method="post" action="${escapeHtml(action)}">
    <button type="submit">Sign in · <span lang="ro">Conectează-te</span></button>
  </form>
</main>
</body>
</html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        // Keeps the link (it holds the token) from other sites, and still
        // lets the form send this page's origin (`no-referrer` would not).
        'Referrer-Policy': 'same-origin',
      },
    },
  )
}
