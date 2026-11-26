const TOKEN_PREFIX = 'quizbutton_host_token:'

export function getHostToken(roomId: string): string | null {
  try {
    return window.sessionStorage.getItem(`${TOKEN_PREFIX}${roomId.toUpperCase()}`)
  } catch {
    return null
  }
}

export function setHostToken(roomId: string, token: string): void {
  try {
    window.sessionStorage.setItem(`${TOKEN_PREFIX}${roomId.toUpperCase()}`, token)
  } catch {
    // Ignore storage failures
  }
}

export function clearHostToken(roomId: string): void {
  try {
    window.sessionStorage.removeItem(`${TOKEN_PREFIX}${roomId.toUpperCase()}`)
  } catch {
    // Ignore storage failures
  }
}

export function getHostAuthHeaders(token?: string | null): Record<string, string> {
  return token ? { 'X-Host-Token': token } : {}
}

export async function verifyHostPasscode(passcode: string): Promise<string> {
  const res = await fetch('/api/host/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode }),
  })
  const data = (await res.json().catch(() => ({}))) as { hostToken?: string; error?: string }
  if (!res.ok || !data.hostToken) {
    throw new Error(data.error || 'Passcode admin salah.')
  }
  return data.hostToken
}

export async function deleteRoomApi(roomId: string, passcode: string): Promise<void> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode }),
  })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  if (!res.ok) {
    throw new Error(data.error || 'Gagal menghapus room.')
  }
}
