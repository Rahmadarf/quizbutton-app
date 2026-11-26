import { randomUUID } from 'node:crypto'
import type { QuestionBankStore } from './questionBank.js'
import type {
  ActiveRoomSummary,
  AnswerAttempt,
  BankQuestion,
  BuzzEvent,
  BuzzResult,
  BuzzerMode,
  HostRoomSnapshot,
  OptionKey,
  PublicQuizQuestion,
  QuizSessionHostState,
  QuizSessionPublicState,
  RoomSnapshot,
  ScoreEntry,
  SessionStatus,
  WsServerMessage,
} from './types.js'

export const LOCK_DURATION_MS = 5000
export const FADE_DURATION_MS = 500
const MAX_HISTORY = 50
const ROOM_IDLE_TTL_MS = 60 * 60 * 1000

export type SubscriberRole = 'player' | 'display' | 'host'

interface SubscriberEntry {
  role: SubscriberRole
  send: (message: WsServerMessage) => void
}

interface RoomState {
  roomId: string
  activeBuzz: BuzzEvent | null
  lockedUntil: number | null
  resetTimer: NodeJS.Timeout | null
  history: BuzzEvent[]
  subscribers: Set<SubscriberEntry>
  lastActivityAt: number

  // Quiz session state
  sessionStatus: SessionStatus
  sessionNumber: number
  sessionQuestions: BankQuestion[]
  currentQuestionIndex: number
  eliminatedOptions: OptionKey[]
  revealedCorrectOption: OptionKey | null
  answeredBy: AnswerAttempt | null
  lastWrongAttempt: AnswerAttempt | null
  questionResolved: boolean
  buzzerGateOpen: boolean
  buzzerMode: BuzzerMode
  scoreboard: Map<string, ScoreEntry>
}

const VALID_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateUniqueRoomCode(existing: Map<string, RoomState>): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = ''
    for (let i = 0; i < 6; i += 1) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
    }
    if (!existing.has(code)) return code
  }
  return randomUUID().replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6)
}

export function normalizeRoomId(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cleaned.length < 3 || cleaned.length > 12) {
    return null
  }
  return cleaned
}

function toPublicQuestion(q: BankQuestion | null): PublicQuizQuestion | null {
  if (!q) return null
  return {
    id: q.id,
    category: q.category,
    prompt: q.prompt,
    options: q.options,
    imageUrl: q.imageUrl,
  }
}

function sortScoreboard(map: Map<string, ScoreEntry>): ScoreEntry[] {
  return Array.from(map.values()).sort((a, b) => {
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount
    if (a.lastScoredAt !== null && b.lastScoredAt !== null && a.lastScoredAt !== b.lastScoredAt) {
      return a.lastScoredAt - b.lastScoredAt
    }
    if (a.lastScoredAt !== null && b.lastScoredAt === null) return -1
    if (a.lastScoredAt === null && b.lastScoredAt !== null) return 1
    return a.playerName.localeCompare(b.playerName, 'id')
  })
}

export class RoomManager {
  private readonly rooms = new Map<string, RoomState>()
  private readonly cleanupInterval: NodeJS.Timeout
  private readonly questionBank: QuestionBankStore

  constructor(questionBank: QuestionBankStore) {
    this.questionBank = questionBank
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

        sessionStatus: 'standby',
        sessionNumber: 0,
        sessionQuestions: [],
        currentQuestionIndex: -1,
        eliminatedOptions: [],
        revealedCorrectOption: null,
        answeredBy: null,
        lastWrongAttempt: null,
        questionResolved: false,
        buzzerGateOpen: true,
        buzzerMode: 'auto5s',
        scoreboard: new Map(),
      }
      this.rooms.set(roomId, room)
    }
    return room
  }

  private getPlayerCount(room: RoomState): number {
    let players = 0
    for (const sub of room.subscribers) {
      if (sub.role === 'player') players += 1
    }
    return players
  }

  private buildPublicSession(room: RoomState): QuizSessionPublicState {
    const current =
      room.sessionStatus === 'active' &&
      room.currentQuestionIndex >= 0 &&
      room.currentQuestionIndex < room.sessionQuestions.length
        ? room.sessionQuestions[room.currentQuestionIndex]
        : null

    return {
      status: room.sessionStatus,
      sessionNumber: room.sessionNumber,
      totalQuestions: room.sessionQuestions.length,
      currentQuestionIndex: room.currentQuestionIndex,
      currentQuestion: toPublicQuestion(current),
      eliminatedOptions: [...room.eliminatedOptions],
      revealedCorrectOption: room.revealedCorrectOption,
      answeredBy: room.answeredBy,
      lastWrongAttempt: room.lastWrongAttempt,
      questionResolved: room.questionResolved,
      buzzerGateOpen: room.buzzerGateOpen,
      buzzerMode: room.buzzerMode,
      scoreboard: sortScoreboard(room.scoreboard),
    }
  }

  private buildHostSession(room: RoomState): QuizSessionHostState {
    const base = this.buildPublicSession(room)
    const current =
      room.sessionStatus === 'active' &&
      room.currentQuestionIndex >= 0 &&
      room.currentQuestionIndex < room.sessionQuestions.length
        ? room.sessionQuestions[room.currentQuestionIndex]
        : null

    return {
      ...base,
      currentCorrectOption: current ? current.correctOption : null,
    }
  }

  private broadcast(room: RoomState, message: WsServerMessage): void {
    for (const subscriber of room.subscribers) {
      try {
        subscriber.send(message)
      } catch {
        // Isolate subscriber errors
      }
    }
  }

  private broadcastSession(room: RoomState): void {
    const publicSession = this.buildPublicSession(room)
    const hostSession = this.buildHostSession(room)
    for (const subscriber of room.subscribers) {
      try {
        if (subscriber.role === 'host') {
          subscriber.send({
            type: 'host_session_state',
            roomId: room.roomId,
            session: hostSession,
          })
        } else {
          subscriber.send({
            type: 'session_state',
            roomId: room.roomId,
            session: publicSession,
          })
        }
      } catch {
        // Isolate subscriber errors
      }
    }
  }

  private clearActiveBuzzInternal(room: RoomState, emitReset: boolean): void {
    if (room.resetTimer) {
      clearTimeout(room.resetTimer)
      room.resetTimer = null
    }
    const hadBuzz = room.activeBuzz !== null
    room.activeBuzz = null
    room.lockedUntil = null
    if (emitReset && hadBuzz) {
      this.broadcast(room, {
        type: 'reset',
        roomId: room.roomId,
        serverTimestamp: Date.now(),
      })
    }
  }

  public listRooms(): ActiveRoomSummary[] {
    return Array.from(this.rooms.values())
      .map((room) => ({
        roomId: room.roomId,
        status: room.sessionStatus,
        sessionNumber: room.sessionNumber,
        totalQuestions: room.sessionQuestions.length,
        currentQuestionIndex: room.currentQuestionIndex,
        participantCount: this.getPlayerCount(room),
        lastActivityAt: room.lastActivityAt,
      }))
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
  }

  public createRoom(customRoomId?: string): { roomId: string; snapshot: HostRoomSnapshot } {
    const normalized = customRoomId ? normalizeRoomId(customRoomId) : null
    const roomId = normalized || generateUniqueRoomCode(this.rooms)
    const room = this.getOrCreateRoom(roomId)
    room.buzzerMode = 'manual'
    room.lastActivityAt = Date.now()
    return {
      roomId,
      snapshot: this.getHostSnapshot(roomId),
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
        session: {
          status: 'standby',
          sessionNumber: 0,
          totalQuestions: 0,
          currentQuestionIndex: -1,
          currentQuestion: null,
          eliminatedOptions: [],
          revealedCorrectOption: null,
          answeredBy: null,
          lastWrongAttempt: null,
          questionResolved: false,
          buzzerGateOpen: true,
          buzzerMode: 'auto5s',
          scoreboard: [],
        },
      }
    }

    const isLocked =
      room.activeBuzz !== null &&
      (room.activeBuzz.manualLock || (room.lockedUntil !== null && now < room.lockedUntil))

    return {
      roomId: room.roomId,
      activeBuzz: isLocked ? room.activeBuzz : null,
      isLocked,
      lockedUntil: isLocked ? room.lockedUntil : null,
      remainingLockMs:
        isLocked && room.lockedUntil !== null ? Math.max(0, room.lockedUntil - now) : null,
      participantCount: this.getPlayerCount(room),
      history: room.history,
      session: this.buildPublicSession(room),
    }
  }

  public getHostSnapshot(roomId: string): HostRoomSnapshot {
    const base = this.getSnapshot(roomId)
    const room = this.rooms.get(roomId)
    return {
      ...base,
      session: room
        ? this.buildHostSession(room)
        : {
            ...base.session,
            currentCorrectOption: null,
          },
    }
  }

  public subscribe(
    roomId: string,
    role: SubscriberRole,
    send: (message: WsServerMessage) => void,
  ): () => void {
    const room = this.getOrCreateRoom(roomId)
    const entry: SubscriberEntry = { role, send }
    room.subscribers.add(entry)
    room.lastActivityAt = Date.now()

    if (role === 'player') {
      this.broadcast(room, {
        type: 'participants',
        roomId,
        participantCount: this.getPlayerCount(room),
      })
    }

    return () => {
      room.subscribers.delete(entry)
      room.lastActivityAt = Date.now()
      if (role === 'player') {
        this.broadcast(room, {
          type: 'participants',
          roomId,
          participantCount: this.getPlayerCount(room),
        })
      }
    }
  }

  public registerPlayer(roomId: string, rawName: string, rawColor: string): void {
    const playerName = rawName.trim().slice(0, 20)
    if (!playerName) return
    const color = VALID_COLOR_REGEX.test(rawColor.trim()) ? rawColor.trim() : '#FF6B6B'

    const room = this.getOrCreateRoom(roomId)
    const key = playerName.toLowerCase()
    const existing = room.scoreboard.get(key)
    if (existing) {
      existing.playerName = playerName
      existing.color = color
    } else {
      room.scoreboard.set(key, {
        playerName,
        color,
        correctCount: 0,
        lastScoredAt: null,
      })
    }
    room.lastActivityAt = Date.now()
    this.broadcastSession(room)
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

    if (!room.buzzerGateOpen) {
      return {
        accepted: false,
        reason: 'gate_closed',
        message: 'Buzzer sedang dikunci oleh Host',
      }
    }

    if (room.sessionStatus === 'active' && room.questionResolved) {
      return {
        accepted: false,
        reason: 'question_resolved',
        message: 'Soal sudah terjawab, menunggu soal berikutnya',
      }
    }

    const currentlyLocked =
      room.activeBuzz !== null &&
      (room.activeBuzz.manualLock || (room.lockedUntil !== null && now < room.lockedUntil))

    if (currentlyLocked && room.activeBuzz) {
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

    // Ensure buzzing player is present on the scoreboard
    const key = playerName.toLowerCase()
    const existingScore = room.scoreboard.get(key)
    if (!existingScore) {
      room.scoreboard.set(key, {
        playerName,
        color,
        correctCount: 0,
        lastScoredAt: null,
      })
    } else {
      existingScore.color = color
    }

    const manualLock = room.buzzerMode === 'manual' || room.sessionStatus === 'active'
    const lockedUntil = manualLock ? null : now + LOCK_DURATION_MS

    const event: BuzzEvent = {
      buzzId: randomUUID(),
      roomId,
      playerName,
      color,
      serverTimestamp: now,
      lockDurationMs: manualLock ? null : LOCK_DURATION_MS,
      fadeDurationMs: FADE_DURATION_MS,
      lockedUntil,
      manualLock,
    }

    room.activeBuzz = event
    room.lockedUntil = lockedUntil
    room.lastWrongAttempt = null
    room.history = [event, ...room.history].slice(0, MAX_HISTORY)

    this.broadcast(room, { type: 'buzz', event })
    this.broadcastSession(room)

    if (!manualLock) {
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
    }

    return { accepted: true, event }
  }

  public startSession(
    roomId: string,
    options?: { count?: number; shuffle?: boolean; resetScores?: boolean },
  ): { ok: true; snapshot: HostRoomSnapshot } | { ok: false; message: string } {
    const count = Math.max(1, Math.min(50, options?.count ?? 10))
    const shuffle = options?.shuffle ?? true
    const resetScores = options?.resetScores ?? true

    const drawn = this.questionBank.drawUnusedQuestions(count, shuffle)
    if (drawn.length === 0) {
      return {
        ok: false,
        message: 'Tidak ada soal tersisa di Bank Soal. Tambah soal baru atau reset riwayat soal terpakai.',
      }
    }

    const room = this.getOrCreateRoom(roomId)
    this.clearActiveBuzzInternal(room, true)

    if (resetScores) {
      for (const entry of room.scoreboard.values()) {
        entry.correctCount = 0
        entry.lastScoredAt = null
      }
    }

    room.sessionStatus = 'active'
    room.sessionNumber += 1
    room.sessionQuestions = drawn
    room.currentQuestionIndex = 0
    room.eliminatedOptions = []
    room.revealedCorrectOption = null
    room.answeredBy = null
    room.lastWrongAttempt = null
    room.questionResolved = false
    room.buzzerMode = 'manual'
    room.buzzerGateOpen = true
    room.lastActivityAt = Date.now()

    // Mark the displayed question as used so it never repeats in future sessions
    this.questionBank.markUsed(drawn[0].id)

    this.broadcastSession(room)
    return { ok: true, snapshot: this.getHostSnapshot(roomId) }
  }

  public submitHostAnswer(
    roomId: string,
    option: OptionKey,
  ):
    | { ok: true; correct: boolean; snapshot: HostRoomSnapshot }
    | { ok: false; message: string } {
    const room = this.getOrCreateRoom(roomId)
    if (room.sessionStatus !== 'active') {
      return { ok: false, message: 'Belum ada sesi kuis yang aktif.' }
    }
    const question = room.sessionQuestions[room.currentQuestionIndex]
    if (!question) {
      return { ok: false, message: 'Soal aktif tidak ditemukan.' }
    }
    if (room.questionResolved) {
      return { ok: false, message: 'Soal ini sudah selesai. Lanjut ke soal berikutnya.' }
    }
    if (!room.activeBuzz) {
      return { ok: false, message: 'Belum ada peserta yang menekan tombol buzzer.' }
    }

    const now = Date.now()
    const isCorrect = option === question.correctOption
    const attempt: AnswerAttempt = {
      playerName: room.activeBuzz.playerName,
      color: room.activeBuzz.color,
      option,
      correct: isCorrect,
      timestamp: now,
    }

    if (isCorrect) {
      room.revealedCorrectOption = question.correctOption
      room.answeredBy = attempt
      room.lastWrongAttempt = null
      room.questionResolved = true

      const key = attempt.playerName.toLowerCase()
      const existing = room.scoreboard.get(key)
      if (existing) {
        existing.correctCount += 1
        existing.color = attempt.color
        existing.lastScoredAt = now
      } else {
        room.scoreboard.set(key, {
          playerName: attempt.playerName,
          color: attempt.color,
          correctCount: 1,
          lastScoredAt: now,
        })
      }

      // Clear buzz lock on participants once scored (questionResolved still blocks new buzzes until next)
      this.clearActiveBuzzInternal(room, true)
    } else {
      if (!room.eliminatedOptions.includes(option)) {
        room.eliminatedOptions.push(option)
      }
      room.lastWrongAttempt = attempt
      // Keep activeBuzz locked until Host explicitly clicks Reset Buzzer
    }

    room.lastActivityAt = now
    this.broadcastSession(room)
    return { ok: true, correct: isCorrect, snapshot: this.getHostSnapshot(roomId) }
  }

  public revealAnswer(roomId: string): { ok: true; snapshot: HostRoomSnapshot } | { ok: false; message: string } {
    const room = this.getOrCreateRoom(roomId)
    if (room.sessionStatus !== 'active') {
      return { ok: false, message: 'Belum ada sesi kuis yang aktif.' }
    }
    const question = room.sessionQuestions[room.currentQuestionIndex]
    if (!question) {
      return { ok: false, message: 'Soal aktif tidak ditemukan.' }
    }

    room.revealedCorrectOption = question.correctOption
    room.questionResolved = true
    room.lastActivityAt = Date.now()
    this.clearActiveBuzzInternal(room, true)
    this.broadcastSession(room)
    return { ok: true, snapshot: this.getHostSnapshot(roomId) }
  }

  public nextQuestion(roomId: string): { ok: true; snapshot: HostRoomSnapshot } | { ok: false; message: string } {
    const room = this.getOrCreateRoom(roomId)
    if (room.sessionStatus !== 'active') {
      return { ok: false, message: 'Belum ada sesi kuis yang aktif.' }
    }

    this.clearActiveBuzzInternal(room, true)

    const nextIdx = room.currentQuestionIndex + 1
    if (nextIdx >= room.sessionQuestions.length) {
      room.sessionStatus = 'finished'
      room.currentQuestionIndex = room.sessionQuestions.length - 1
      room.eliminatedOptions = []
      room.revealedCorrectOption = null
      room.answeredBy = null
      room.lastWrongAttempt = null
      room.questionResolved = true
      room.buzzerGateOpen = false
      room.lastActivityAt = Date.now()
      this.broadcastSession(room)
      return { ok: true, snapshot: this.getHostSnapshot(roomId) }
    }

    room.currentQuestionIndex = nextIdx
    room.eliminatedOptions = []
    room.revealedCorrectOption = null
    room.answeredBy = null
    room.lastWrongAttempt = null
    room.questionResolved = false
    room.buzzerGateOpen = true
    room.lastActivityAt = Date.now()

    this.questionBank.markUsed(room.sessionQuestions[nextIdx].id)

    this.broadcastSession(room)
    return { ok: true, snapshot: this.getHostSnapshot(roomId) }
  }

  public finishSession(roomId: string): HostRoomSnapshot {
    const room = this.getOrCreateRoom(roomId)
    this.clearActiveBuzzInternal(room, true)
    room.sessionStatus = 'finished'
    room.buzzerGateOpen = false
    room.lastActivityAt = Date.now()
    this.broadcastSession(room)
    return this.getHostSnapshot(roomId)
  }

  public setStandby(roomId: string): HostRoomSnapshot {
    const room = this.getOrCreateRoom(roomId)
    this.clearActiveBuzzInternal(room, true)
    room.sessionStatus = 'standby'
    room.currentQuestionIndex = -1
    room.eliminatedOptions = []
    room.revealedCorrectOption = null
    room.answeredBy = null
    room.lastWrongAttempt = null
    room.questionResolved = false
    room.buzzerGateOpen = true
    room.lastActivityAt = Date.now()
    this.broadcastSession(room)
    return this.getHostSnapshot(roomId)
  }

  public resetBuzz(roomId: string): HostRoomSnapshot {
    const room = this.getOrCreateRoom(roomId)
    this.clearActiveBuzzInternal(room, true)
    room.lastWrongAttempt = null
    room.lastActivityAt = Date.now()
    this.broadcastSession(room)
    return this.getHostSnapshot(roomId)
  }

  public setBuzzerGate(roomId: string, open: boolean): HostRoomSnapshot {
    const room = this.getOrCreateRoom(roomId)
    room.buzzerGateOpen = open
    room.lastActivityAt = Date.now()
    this.broadcastSession(room)
    return this.getHostSnapshot(roomId)
  }

  public setBuzzerMode(roomId: string, mode: BuzzerMode): HostRoomSnapshot {
    const room = this.getOrCreateRoom(roomId)
    room.buzzerMode = mode
    room.lastActivityAt = Date.now()
    this.broadcastSession(room)
    return this.getHostSnapshot(roomId)
  }

  public adjustScore(
    roomId: string,
    rawPlayerName: string,
    delta: number,
    rawColor?: string,
  ): HostRoomSnapshot {
    const playerName = rawPlayerName.trim().slice(0, 20)
    const room = this.getOrCreateRoom(roomId)
    if (!playerName) return this.getHostSnapshot(roomId)

    const key = playerName.toLowerCase()
    const existing = room.scoreboard.get(key)
    const now = Date.now()
    if (existing) {
      existing.correctCount = Math.max(0, existing.correctCount + delta)
      if (delta > 0) existing.lastScoredAt = now
      if (rawColor && VALID_COLOR_REGEX.test(rawColor)) existing.color = rawColor
    } else {
      room.scoreboard.set(key, {
        playerName,
        color: rawColor && VALID_COLOR_REGEX.test(rawColor) ? rawColor : '#2A5FE6',
        correctCount: Math.max(0, delta),
        lastScoredAt: delta > 0 ? now : null,
      })
    }
    room.lastActivityAt = now
    this.broadcastSession(room)
    return this.getHostSnapshot(roomId)
  }

  public resetScores(roomId: string): HostRoomSnapshot {
    const room = this.getOrCreateRoom(roomId)
    for (const entry of room.scoreboard.values()) {
      entry.correctCount = 0
      entry.lastScoredAt = null
    }
    room.lastActivityAt = Date.now()
    this.broadcastSession(room)
    return this.getHostSnapshot(roomId)
  }

  private cleanupIdleRooms(): void {
    const now = Date.now()
    for (const [roomId, room] of this.rooms.entries()) {
      const isIdle =
        room.subscribers.size === 0 &&
        room.activeBuzz === null &&
        room.sessionStatus === 'standby' &&
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
