export function riskColor(score: number): string {
  if (score <= 33) return '#00ff94'
  if (score <= 66) return '#ffb800'
  return '#ff4444'
}

export function riskLabel(score: number): string {
  if (score <= 33) return 'Optimal'
  if (score <= 66) return 'Watch Load'
  return 'High Burnout Risk'
}
