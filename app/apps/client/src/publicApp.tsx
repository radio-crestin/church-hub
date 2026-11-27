import React from 'react'
import ReactDOM from 'react-dom/client'

import { registerSW } from 'virtual:pwa-register'
import './styles.css'

import {
  openSharedSong,
  SharedSongPage,
  startWebApp,
  WebAppNoticePage,
} from './features/public-app'
import { initPublicI18n } from './features/public-app/i18n'
import { followSystemTheme } from './features/public-app/utils/followSystemTheme'
import { hideLoadingScreen } from './features/startup/loadingScreen'

/**
 * Entry of the web app (`bun run build:public`), for any phone or browser:
 * the full app, on the church PC or on the church's server running in this
 * browser, or as a guest (startWebApp). Its service worker keeps it working
 * offline and updates it in the background. A song's link opens its
 * public page (or the song, on a device of its church).
 */
registerSW({ immediate: true })

/** Shows a page of the web app's own: no church server behind it. */
async function renderPage(page: React.ReactNode) {
  followSystemTheme()
  await initPublicI18n()
  hideLoadingScreen()
  const root = document.getElementById('app')
  if (!root) return
  ReactDOM.createRoot(root).render(<React.StrictMode>{page}</React.StrictMode>)
}

void (async () => {
  // A song's link: its page, or the song in the app on its church's device.
  const shared = await openSharedSong()
  if (shared) return renderPage(<SharedSongPage result={shared} />)
  const notice = await startWebApp()
  if (notice) await renderPage(<WebAppNoticePage notice={notice} />)
})()
