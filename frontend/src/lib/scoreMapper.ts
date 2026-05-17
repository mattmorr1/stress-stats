export function riskColor(score: number): string {
  if (score <= 33) return '#059669'   // emerald — optimal
  if (score <= 66) return '#d97706'   // amber — watch
  return '#dc2626'                    // red — high risk
}

export function riskLabel(score: number): string {
  if (score <= 33) return 'Optimal'
  if (score <= 66) return 'Watch Load'
  return 'High Burnout Risk'
}

export function directionColor(dir: string): string {
  if (dir === 'improving') return '#059669'
  if (dir === 'declining') return '#dc2626'
  return '#64748b'
}

export function directionArrow(dir: string): string {
  if (dir === 'improving') return '↑'
  if (dir === 'declining') return '↓'
  return '→'
}
