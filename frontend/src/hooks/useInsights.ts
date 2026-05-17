import { useQuery } from '@tanstack/react-query'
import { fetchInsights } from '../api/insights'

export function useInsights(source: string, start: string, end: string) {
  return useQuery({
    queryKey: ['insights', source, start, end],
    queryFn: () => fetchInsights(source, start, end),
    staleTime: 1000 * 60 * 60 * 6, // 6 hours — matches backend cache TTL
    retry: 1,
  })
}
