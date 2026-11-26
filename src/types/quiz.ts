export interface PlayerProfile {
  name: string
  color: string
}

export interface BuzzEvent {
  buzzId: string
  roomId: string
  playerName: string
  color: string
  serverTimestamp: number
  lockDurationMs: number
  fadeDurationMs: number
  lockedUntil: number
}

export interface RoomSnapshot {
  roomId: string
  activeBuzz: BuzzEvent | null
  isLocked: boolean
  lockedUntil: number | null
  remainingLockMs: number
  participantCount: number
  history: BuzzEvent[]
}

export type WsServerMessage =
  | { type: 'state'; snapshot: RoomSnapshot }
  | { type: 'buzz'; event: BuzzEvent }
  | { type: 'buzz_rejected'; reason: 'locked' | 'invalid_input'; activeBuzz?: BuzzEvent; message?: string }
  | { type: 'reset'; roomId: string; serverTimestamp: number }
  | { type: 'participants'; roomId: string; participantCount: number }
  | { type: 'pong'; serverTimestamp: number }

export const PLAYER_COLORS = [
  { name: 'Red', value: '#FF6B6B' },
  { name: 'Blue', value: '#4ECDC4' },
  { name: 'Green', value: '#96CEB4' },
  { name: 'Yellow', value: '#FECA57' },
  { name: 'Purple', value: '#6C5CE7' },
  { name: 'Pink', value: '#FF9FF3' },
  { name: 'Orange', value: '#FD79A8' },
  { name: 'Teal', value: '#00D2D3' },
] as const
