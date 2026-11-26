import { useState } from 'react'

const STORAGE_KEY = 'bible:topic-template'

function read(): number | null {
  const stored = Number(window.localStorage.getItem(STORAGE_KEY))
  return Number.isInteger(stored) && stored > 0 ? stored : null
}

/**
 * The slide template a topic's verse loop is drawn with, remembered on this
 * computer; null: each screen's own.
 */
export function useTopicLoopTemplate() {
  const [templateId, setTemplateId] = useState<number | null>(read)
  const choose = (id: number | null) => {
    if (id === null) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, String(id))
    setTemplateId(id)
  }
  return [templateId, choose] as const
}
