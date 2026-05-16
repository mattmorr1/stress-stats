export interface AuthStatus {
  whoop_connected: boolean
  whoop_client_configured: boolean
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await fetch('/api/auth/status')
  if (!res.ok) throw new Error('Failed to fetch auth status')
  return res.json()
}

export function getWhoopConnectUrl(): string {
  return '/api/auth/whoop'
}
