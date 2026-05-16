import type { AnalysisResponse } from '../types/analysis'

export async function fetchAnalysis(
  source: 'garmin' | 'whoop',
  start: string,
  end: string,
): Promise<AnalysisResponse> {
  const params = new URLSearchParams({ source, start, end })
  const res = await fetch(`/api/analysis?${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Unknown error')
  }
  return res.json()
}
