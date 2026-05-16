import { useQuery } from '@tanstack/react-query'
import { fetchAnalysis } from '../api/analysis'

export function useAnalysis(
  source: 'garmin' | 'whoop',
  start: string,
  end: string,
) {
  return useQuery({
    queryKey: ['analysis', source, start, end],
    queryFn: () => fetchAnalysis(source, start, end),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  })
}
