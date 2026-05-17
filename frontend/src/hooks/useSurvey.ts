import { useState } from 'react'
import type { SurveyEntry } from '../types/analysis'

const STORAGE_KEY = 'reds_screener_history'
const MAX_HISTORY = 30

function loadFromStorage(): SurveyEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SurveyEntry[]) : []
  } catch {
    return []
  }
}

export function useSurvey() {
  const [history, setHistory] = useState<SurveyEntry[]>(loadFromStorage)

  function save(entry: SurveyEntry) {
    const updated = [entry, ...history].slice(0, MAX_HISTORY)
    setHistory(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  function clear() {
    setHistory([])
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    history,
    latest: history[0] ?? null,
    save,
    clear,
  }
}
