export type OptionKey = 'A' | 'B' | 'C' | 'D'
export const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D']

export interface PlayerProfile {
  name: string
  color: string
}

export interface BankQuestion {
  id: string
  category?: string
  prompt: string
  options: Record<OptionKey, string>
  correctOption: OptionKey
  imageUrl?: string
  createdAt: number
  used?: boolean
}

export interface BankSummary {
  questions: Array<BankQuestion & { used: boolean }>
  usedQuestionIds: string[]
  totalCount: number
  usedCount: number
  availableCount: number
}

export interface QuestionInput {
  category?: string
  prompt: string
  options: Record<OptionKey, string>
  correctOption: OptionKey
  imageUrl?: string
}

export interface PublicQuizQuestion {
  id: string
  category?: string
  prompt: string
  options: Record<OptionKey, string>
  imageUrl?: string
}

export interface ScoreEntry {
  playerName: string
  color: string
  correctCount: number
  lastScoredAt: number | null
}

export interface AnswerAttempt {
  playerName: string
  color: string
  option: OptionKey
  correct: boolean
  timestamp: number
}

export type SessionStatus = 'standby' | 'active' | 'finished'
export type BuzzerMode = 'manual' | 'auto5s'

export interface QuizSessionPublicState {
  status: SessionStatus
  sessionNumber: number
  totalQuestions: number
  currentQuestionIndex: number
  currentQuestion: PublicQuizQuestion | null
  eliminatedOptions: OptionKey[]
  revealedCorrectOption: OptionKey | null
  answeredBy: AnswerAttempt | null
  lastWrongAttempt: AnswerAttempt | null
  questionResolved: boolean
  buzzerGateOpen: boolean
  buzzerMode: BuzzerMode
  scoreboard: ScoreEntry[]
}

export interface QuizSessionHostState extends QuizSessionPublicState {
  currentCorrectOption: OptionKey | null
}

export interface BuzzEvent {
  buzzId: string
  roomId: string
  playerName: string
  color: string
  serverTimestamp: number
  lockDurationMs: number | null
  fadeDurationMs: number
  lockedUntil: number | null
  manualLock: boolean
}

export interface RoomSnapshot {
  roomId: string
  activeBuzz: BuzzEvent | null
  isLocked: boolean
  lockedUntil: number | null
  remainingLockMs: number | null
  participantCount: number
  history: BuzzEvent[]
  session: QuizSessionPublicState
}

export interface HostRoomSnapshot extends Omit<RoomSnapshot, 'session'> {
  session: QuizSessionHostState
}

export type WsServerMessage =
  | { type: 'state'; snapshot: RoomSnapshot }
  | { type: 'host_state'; snapshot: HostRoomSnapshot }
  | { type: 'session_state'; roomId: string; session: QuizSessionPublicState }
  | { type: 'host_session_state'; roomId: string; session: QuizSessionHostState }
  | { type: 'buzz'; event: BuzzEvent }
  | {
      type: 'buzz_rejected'
      reason: 'locked' | 'gate_closed' | 'question_resolved' | 'invalid_input'
      activeBuzz?: BuzzEvent
      message?: string
    }
  | { type: 'reset'; roomId: string; serverTimestamp: number }
  | { type: 'room_deleted'; roomId: string; message: string }
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
