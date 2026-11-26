import React from 'react'
import ReactDOM from 'react-dom/client'

import { registerSW } from 'virtual:pwa-register'
import './styles.css'

import { startWebApp, WebAppNoticePage } from './features/public-app'
import { initPublicI18n } from './features/public-app/i18n'
import { followSystemTheme } from './features/public-app/utils/followSystemTheme'
import { hideLoadingScreen } from './features/startup/loadingScreen'

/**
 * Entry of the web app (`bun run build:public`), for any phone or browser:
 * the full app, on the church PC or on the church's server running in this
 * browser, or as a guest (startWebApp). Its service worker keeps it working
 * offline and updates it in the background.
 */
registerSW({ immediate: true })
void startWebApp().then(async (notice) => {
  if (!notice) return
  followSystemTheme()
  await initPublicI18n()
  hideLoadingScreen()
  const root = document.getElementById('app')
  if (!root) return
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <WebAppNoticePage notice={notice} />
    </React.StrictMode>,
  )
})
