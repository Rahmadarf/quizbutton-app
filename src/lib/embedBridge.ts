import type { BuzzEvent, PlayerProfile, RoomSnapshot } from '../types/quiz'

export type QuizButtonBridgeEvent =
  | {
      source: 'quizbutton'
      type: 'quizbutton:ready'
      payload: { roomId?: string; embedded: boolean }
    }
  | {
      source: 'quizbutton'
      type: 'quizbutton:room_joined'
      payload: { roomId: string; player: PlayerProfile }
    }
  | {
      source: 'quizbutton'
      type: 'quizbutton:state'
      payload: { roomId: string; snapshot: RoomSnapshot }
    }
  | {
      source: 'quizbutton'
      type: 'quizbutton:buzz'
      payload: {
        roomId: string
        buzzId: string
        winner: { name: string; color: string }
        serverTimestamp: number
        lockDurationMs: number | null
        lockedUntil: number | null
        manualLock: boolean
      }
    }
  | {
      source: 'quizbutton'
      type: 'quizbutton:reset'
      payload: { roomId: string; serverTimestamp: number }
    }

export function isInIframe(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

export function isEmbedLayout(search: string): boolean {
  const params = new URLSearchParams(search)
  const embed = params.get('embed')
  return embed === '1' || embed === 'true'
}

export function emitBridgeEvent(event: QuizButtonBridgeEvent): void {
  try {
    window.dispatchEvent(new CustomEvent(event.type, { detail: event.payload }))
  } catch {
    // Ignore custom event errors
  }

  if (isInIframe() && window.parent && window.parent !== window) {
    try {
      window.parent.postMessage(event, '*')
    } catch {
      // Ignore cross-origin postMessage errors
    }
  }
}

export function emitBuzzBridgeEvent(event: BuzzEvent): void {
  emitBridgeEvent({
    source: 'quizbutton',
    type: 'quizbutton:buzz',
    payload: {
      roomId: event.roomId,
      buzzId: event.buzzId,
      winner: {
        name: event.playerName,
        color: event.color,
      },
      serverTimestamp: event.serverTimestamp,
      lockDurationMs: event.lockDurationMs,
      lockedUntil: event.lockedUntil,
      manualLock: event.manualLock,
    },
  })
}
