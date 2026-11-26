import React from 'react'
import ReactDOM from 'react-dom/client'

import { registerSW } from 'virtual:pwa-register'
import './styles.css'

import { PublicApp } from './features/public-app'
import { initPublicI18n } from './features/public-app/i18n'
import { followSystemTheme } from './features/public-app/utils/followSystemTheme'
import { hideLoadingScreen } from './features/startup/loadingScreen'

/**
 * Entry of the public web app (`bun run build:public`): the join page and
 * the church's songs, for any phone or browser. Its service worker keeps it
 * working offline and updates it in the background.
 */
followSystemTheme()
registerSW({ immediate: true })
void initPublicI18n().then(() => {
  hideLoadingScreen()
  const root = document.getElementById('app')
  if (!root) return
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <PublicApp />
    </React.StrictMode>,
  )
})
