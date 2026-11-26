const DARK_QUERY = '(prefers-color-scheme: dark)'

function applyTheme(isDark: boolean) {
  const theme = isDark ? 'dark' : 'light'
  for (const element of [document.documentElement, document.body]) {
    element.classList.remove('light', 'dark')
    element.classList.add(theme)
  }
  // index.html paints the first frame of the next visit with it.
  localStorage.setItem('church-hub-theme', theme)
}

/**
 * The public app has no settings: it takes the phone's light or dark
 * appearance, and follows it when it changes.
 */
export function followSystemTheme() {
  const query = window.matchMedia(DARK_QUERY)
  applyTheme(query.matches)
  query.addEventListener('change', (event) => applyTheme(event.matches))
}
