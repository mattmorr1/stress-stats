import type { InsightsResponse } from '../types/analysis'

export async function fetchInsights(
  source: string,
  start: string,
  end: string,
): Promise<InsightsResponse> {
  const params = new URLSearchParams({ source, start, end })
  const res = await fetch(`/api/insights?${params}`)
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(detail.detail ?? `Insights request failed: ${res.status}`)
  }
  return res.json()
}
