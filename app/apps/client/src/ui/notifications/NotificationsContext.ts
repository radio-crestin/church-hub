import { createContext } from 'react'

import type { NotificationsApi } from './types'

export const NotificationsContext = createContext<NotificationsApi | null>(null)
