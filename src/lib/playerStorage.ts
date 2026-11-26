import { PLAYER_COLORS, type PlayerProfile } from '../types/quiz'

const STORAGE_KEY = 'quizbutton_player'
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export function generateRoomCode(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

export function getPlayerProfile(): PlayerProfile | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>
    if (typeof parsed.name === 'string' && parsed.name.trim() && typeof parsed.color === 'string') {
      return {
        name: parsed.name.trim().slice(0, 20),
        color: parsed.color,
      }
    }
    return null
  } catch {
    return null
  }
}

export function savePlayerProfile(profile: PlayerProfile): void {
  const sanitized: PlayerProfile = {
    name: profile.name.trim().slice(0, 20),
    color: /^#[0-9A-Fa-f]{6}$/.test(profile.color) ? profile.color : PLAYER_COLORS[0].value,
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized))
  } catch {
    // Ignore storage failures in restricted contexts
  }
}
