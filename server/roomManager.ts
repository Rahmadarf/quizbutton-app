import { randomUUID } from 'node:crypto'
import type { BuzzEvent, BuzzResult, RoomSnapshot, WsServerMessage } from './types.js'

export const LOCK_DURATION_MS = 5000
export const FADE_DURATION_MS = 500
const MAX_HISTORY = 50
const ROOM_IDLE_TTL_MS = 30 * 60 * 1000

type Subscriber = (message: WsServerMessage) => void

interface RoomState {
  roomId: string
  activeBuzz: BuzzEvent | null
  lockedUntil: number | null
  resetTimer: NodeJS.Timeout | null
  history: BuzzEvent[]
  subscribers: Set<Subscriber>
  lastActivityAt: number
}

const VALID_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

export function normalizeRoomId(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cleaned.length < 3 || cleaned.length > 12) {
    return null
  }
  return cleaned
}

export class RoomManager {
  private readonly rooms = new Map<string, RoomState>()
  private readonly cleanupInterval: NodeJS.Timeout

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanupIdleRooms(), 5 * 60 * 1000)
    this.cleanupInterval.unref()
  }

  private getOrCreateRoom(roomId: string): RoomState {
    let room = this.rooms.get(roomId)
    if (!room) {
      room = {
        roomId,
        activeBuzz: null,
        lockedUntil: null,
        resetTimer: null,
        history: [],
        subscribers: new Set(),
        lastActivityAt: Date.now(),
      }
      this.rooms.set(roomId, room)
    }
    return room
  }

  private broadcast(room: RoomState, message: WsServerMessage): void {
    for (const subscriber of room.subscribers) {
      try {
        subscriber(message)
      } catch {
        // Individual subscriber errors are isolated
      }
    }
  }

  public getSnapshot(roomId: string): RoomSnapshot {
    const room = this.rooms.get(roomId)
    const now = Date.now()
    if (!room) {
      return {
        roomId,
        activeBuzz: null,
        isLocked: false,
        lockedUntil: null,
        remainingLockMs: 0,
        participantCount: 0,
        history: [],
      }
    }

    const isLocked = room.activeBuzz !== null && room.lockedUntil !== null && now < room.lockedUntil
    return {
      roomId: room.roomId,
      activeBuzz: isLocked ? room.activeBuzz : null,
      isLocked,
      lockedUntil: isLocked ? room.lockedUntil : null,
      remainingLockMs: isLocked && room.lockedUntil ? Math.max(0, room.lockedUntil - now) : 0,
      participantCount: room.subscribers.size,
      history: room.history,
    }
  }

  public subscribe(roomId: string, subscriber: Subscriber): () => void {
    const room = this.getOrCreateRoom(roomId)
    room.subscribers.add(subscriber)
    room.lastActivityAt = Date.now()

    this.broadcast(room, {
      type: 'participants',
      roomId,
      participantCount: room.subscribers.size,
    })

    return () => {
      room.subscribers.delete(subscriber)
      room.lastActivityAt = Date.now()
      this.broadcast(room, {
        type: 'participants',
        roomId,
        participantCount: room.subscribers.size,
      })
    }
  }

  public pressButton(roomId: string, rawPlayerName: string, rawColor: string): BuzzResult {
    const playerName = rawPlayerName.trim().slice(0, 20)
    const color = VALID_COLOR_REGEX.test(rawColor.trim()) ? rawColor.trim() : '#FF6B6B'

    if (!playerName) {
      return {
        accepted: false,
        reason: 'invalid_input',
        message: 'Player name is required',
      }
    }

    const room = this.getOrCreateRoom(roomId)
    const now = Date.now()
    room.lastActivityAt = now

    if (room.activeBuzz && room.lockedUntil && now < room.lockedUntil) {
      return {
        accepted: false,
        reason: 'locked',
        activeBuzz: room.activeBuzz,
      }
    }

    if (room.resetTimer) {
      clearTimeout(room.resetTimer)
      room.resetTimer = null
    }

    const lockedUntil = now + LOCK_DURATION_MS
    const event: BuzzEvent = {
      buzzId: randomUUID(),
      roomId,
      playerName,
      color,
      serverTimestamp: now,
      lockDurationMs: LOCK_DURATION_MS,
      fadeDurationMs: FADE_DURATION_MS,
      lockedUntil,
    }

    room.activeBuzz = event
    room.lockedUntil = lockedUntil
    room.history = [event, ...room.history].slice(0, MAX_HISTORY)

    this.broadcast(room, { type: 'buzz', event })

    room.resetTimer = setTimeout(() => {
      room.activeBuzz = null
      room.lockedUntil = null
      room.resetTimer = null
      room.lastActivityAt = Date.now()
      this.broadcast(room, {
        type: 'reset',
        roomId,
        serverTimestamp: Date.now(),
      })
    }, LOCK_DURATION_MS)

    return { accepted: true, event }
  }

  private cleanupIdleRooms(): void {
    const now = Date.now()
    for (const [roomId, room] of this.rooms.entries()) {
      const isIdle =
        room.subscribers.size === 0 &&
        room.activeBuzz === null &&
        now - room.lastActivityAt > ROOM_IDLE_TTL_MS
      if (isIdle) {
        if (room.resetTimer) {
          clearTimeout(room.resetTimer)
        }
        this.rooms.delete(roomId)
      }
    }
  }

  public close(): void {
    clearInterval(this.cleanupInterval)
    for (const room of this.rooms.values()) {
      if (room.resetTimer) {
        clearTimeout(room.resetTimer)
      }
    }
  }
}
