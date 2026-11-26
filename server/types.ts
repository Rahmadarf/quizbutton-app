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

export type BuzzResult =
  | { accepted: true; event: BuzzEvent }
  | { accepted: false; reason: 'locked'; activeBuzz: BuzzEvent }
  | { accepted: false; reason: 'invalid_input'; message: string }

export type WsClientMessage =
  | { type: 'buzz'; playerName: string; color: string }
  | { type: 'ping' }

export type WsServerMessage =
  | { type: 'state'; snapshot: RoomSnapshot }
  | { type: 'buzz'; event: BuzzEvent }
  | { type: 'buzz_rejected'; reason: 'locked' | 'invalid_input'; activeBuzz?: BuzzEvent; message?: string }
  | { type: 'reset'; roomId: string; serverTimestamp: number }
  | { type: 'participants'; roomId: string; participantCount: number }
  | { type: 'pong'; serverTimestamp: number }
