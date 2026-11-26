import { randomBytes, timingSafeEqual } from 'node:crypto'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { WebSocket, WebSocketServer } from 'ws'
import { QuestionBankStore, type QuestionInput } from './questionBank.js'
import { RoomManager, normalizeRoomId, type SubscriberRole } from './roomManager.js'
import type { OptionKey, WsClientMessage, WsServerMessage } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001
const HOST = process.env.HOST || '0.0.0.0'
const IS_PROD = process.env.NODE_ENV === 'production'
const HOST_CREATE_PASSCODE = process.env.HOST_PASSCODE || '223332'
const HOST_TOKEN_TTL_MS = 12 * 60 * 60 * 1000

const hostTokens = new Map<string, number>()

function isValidHostPasscode(input: string): boolean {
  const a = Buffer.from(input.trim(), 'utf8')
  const b = Buffer.from(HOST_CREATE_PASSCODE, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function issueHostToken(): string {
  const now = Date.now()
  for (const [token, expiresAt] of hostTokens.entries()) {
    if (expiresAt <= now) hostTokens.delete(token)
  }
  const token = randomBytes(32).toString('hex')
  hostTokens.set(token, now + HOST_TOKEN_TTL_MS)
  return token
}

function isValidHostToken(token: string | undefined): boolean {
  if (!token) return false
  const expiresAt = hostTokens.get(token)
  if (!expiresAt) return false
  if (Date.now() > expiresAt) {
    hostTokens.delete(token)
    return false
  }
  return true
}

function extractHostToken(req: Request): string | undefined {
  const header = req.header('x-host-token')
  return header ? header.trim() : undefined
}

function paramString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function requireHostAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isValidHostToken(extractHostToken(req))) {
    res.status(401).json({
      error: 'Sesi admin tidak valid atau belum terverifikasi. Masukkan passcode admin.',
    })
    return
  }
  next()
}

const app = express()
const questionBank = new QuestionBankStore()
const roomManager = new RoomManager(questionBank)

app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// ---------------- Host Authentication ----------------

app.post('/api/host/verify', (req, res) => {
  const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : ''
  if (!isValidHostPasscode(passcode)) {
    res.status(403).json({
      error: 'Passcode admin salah. Masukkan passcode yang benar.',
    })
    return
  }
  res.json({ ok: true, hostToken: issueHostToken() })
})

// ---------------- Question Bank API (Persistent, Anti-Repeat) ----------------

app.get('/api/bank', (req, res) => {
  const summary = questionBank.getSummary()
  if (!isValidHostToken(extractHostToken(req))) {
    res.json({
      questions: [],
      usedQuestionIds: [],
      totalCount: summary.totalCount,
      usedCount: summary.usedCount,
      availableCount: summary.availableCount,
    })
    return
  }
  res.json(summary)
})

app.post('/api/bank/questions', requireHostAuth, (req, res) => {
  const created = questionBank.createQuestion(req.body as QuestionInput)
  if (!created) {
    res.status(400).json({ error: 'Soal, keempat opsi (A-D), dan kunci jawaban wajib diisi.' })
    return
  }
  res.status(201).json({ question: created, bank: questionBank.getSummary() })
})

app.put('/api/bank/questions/:id', requireHostAuth, (req, res) => {
  const updated = questionBank.updateQuestion(paramString(req.params.id), req.body as QuestionInput)
  if (!updated) {
    res.status(404).json({ error: 'Soal tidak ditemukan atau data tidak valid.' })
    return
  }
  res.json({ question: updated, bank: questionBank.getSummary() })
})

app.delete('/api/bank/questions/:id', requireHostAuth, (req, res) => {
  const deleted = questionBank.deleteQuestion(paramString(req.params.id))
  if (!deleted) {
    res.status(404).json({ error: 'Soal tidak ditemukan.' })
    return
  }
  res.json({ ok: true, bank: questionBank.getSummary() })
})

app.post('/api/bank/import', requireHostAuth, (req, res) => {
  const items = Array.isArray(req.body?.questions)
    ? (req.body.questions as QuestionInput[])
    : Array.isArray(req.body)
      ? (req.body as QuestionInput[])
      : null

  if (!items) {
    res.status(400).json({ error: 'Format harus berupa array soal JSON.' })
    return
  }

  const skipDuplicates =
    typeof req.body?.skipDuplicates === 'boolean' ? req.body.skipDuplicates : true
  const result = questionBank.importQuestions(items, { skipDuplicates })
  res.json({ ...result, bank: questionBank.getSummary() })
})

app.post('/api/bank/seed-sample', requireHostAuth, (_req, res) => {
  const result = questionBank.seedSampleQuestions()
  res.json({ ...result, bank: questionBank.getSummary() })
})

app.post('/api/bank/reset-used', requireHostAuth, (_req, res) => {
  questionBank.resetUsedHistory()
  res.json({ ok: true, bank: questionBank.getSummary() })
})

// ---------------- Room & Buzzer API ----------------

app.get('/api/rooms', (_req, res) => {
  res.json({ rooms: roomManager.listRooms() })
})

app.post('/api/rooms', (req, res) => {
  const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : ''
  if (!isValidHostPasscode(passcode)) {
    res.status(403).json({
      error: 'Passcode admin salah. Masukkan passcode yang benar untuk membuat room.',
    })
    return
  }

  const rawRoomId = typeof req.body?.roomId === 'string' ? req.body.roomId : undefined
  if (rawRoomId && !normalizeRoomId(rawRoomId)) {
    res.status(400).json({ error: 'Kode room harus 3-12 karakter huruf/angka.' })
    return
  }
  const created = roomManager.createRoom(rawRoomId)
  res.status(201).json({ ...created, hostToken: issueHostToken() })
})

app.delete('/api/rooms/:roomId', (req, res) => {
  const passcode =
    typeof req.body?.passcode === 'string'
      ? req.body.passcode
      : req.header('x-host-passcode') || ''

  if (!isValidHostPasscode(passcode)) {
    res.status(403).json({
      error: 'Passcode admin salah. Masukkan passcode yang benar untuk menghapus room.',
    })
    return
  }

  const roomId = normalizeRoomId(req.params.roomId)
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
    return
  }

  const deleted = roomManager.deleteRoom(roomId)
  if (!deleted) {
    res.status(404).json({ error: 'Room tidak ditemukan atau sudah dihapus.' })
    return
  }

  res.json({ ok: true, roomId })
})

app.get('/api/rooms/:roomId', (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId)
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
    return
  }
  if (req.query.role === 'host') {
    if (!isValidHostToken(extractHostToken(req))) {
      res.status(401).json({
        error: 'Sesi admin tidak valid atau belum terverifikasi. Masukkan passcode admin.',
      })
      return
    }
    res.json(roomManager.getHostSnapshot(roomId))
    return
  }
  res.json(roomManager.getSnapshot(roomId))
})

app.post('/api/rooms/:roomId/buzz', (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId)
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
    return
  }

  const playerName = typeof req.body?.playerName === 'string' ? req.body.playerName : ''
  const color = typeof req.body?.color === 'string' ? req.body.color : '#FF6B6B'

  const result = roomManager.pressButton(roomId, playerName, color)
  if (!result.accepted) {
    if (
      result.reason === 'locked' ||
      result.reason === 'gate_closed' ||
      result.reason === 'question_resolved'
    ) {
      res.status(409).json(result)
      return
    }
    res.status(400).json(result)
    return
  }

  res.json(result)
})

// ---------------- Host Session Control API ----------------

app.post('/api/rooms/:roomId/session/start', requireHostAuth, (req, res) => {
  const roomId = normalizeRoomId(paramString(req.params.roomId))
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
    return
  }
  const count = typeof req.body?.count === 'number' ? req.body.count : 10
  const shuffle = typeof req.body?.shuffle === 'boolean' ? req.body.shuffle : true
  const resetScores = typeof req.body?.resetScores === 'boolean' ? req.body.resetScores : true

  const result = roomManager.startSession(roomId, { count, shuffle, resetScores })
  if (!result.ok) {
    res.status(400).json({ error: result.message })
    return
  }
  res.json({ snapshot: result.snapshot, bank: questionBank.getSummary() })
})

app.post('/api/rooms/:roomId/session/answer', requireHostAuth, (req, res) => {
  const roomId = normalizeRoomId(paramString(req.params.roomId))
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
    return
  }
  const rawOption = String(req.body?.option || '').trim().toUpperCase()
  if (!['A', 'B', 'C', 'D'].includes(rawOption)) {
    res.status(400).json({ error: 'Opsi jawaban harus A, B, C, atau D.' })
    return
  }

  const result = roomManager.submitHostAnswer(roomId, rawOption as OptionKey)
  if (!result.ok) {
    res.status(400).json({ error: result.message })
    return
  }
  res.json(result)
})

app.post('/api/rooms/:roomId/session/reveal', requireHostAuth, (req, res) => {
  const roomId = normalizeRoomId(paramString(req.params.roomId))
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
    return
  }
  const result = roomManager.revealAnswer(roomId)
  if (!result.ok) {
    res.status(400).json({ error: result.message })
    return
  }
  res.json(result)
})

app.post('/api/rooms/:roomId/session/next', requireHostAuth, (req, res) => {
  const roomId = normalizeRoomId(paramString(req.params.roomId))
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
    return
  }
  const result = roomManager.nextQuestion(roomId)
  if (!result.ok) {
    res.status(400).json({ error: result.message })
    return
  }
  res.json({ snapshot: result.snapshot, bank: questionBank.getSummary() })
})

app.post('/api/rooms/:roomId/session/finish', requireHostAuth, (req, res) => {
  const roomId = normalizeRoomId(paramString(req.params.roomId))
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
    return
  }
  res.json({ snapshot: roomManager.finishSession(roomId) })
})

app.post('/api/rooms/:roomId/session/standby', requireHostAuth, (req, res) => {
  const roomId = normalizeRoomId(paramString(req.params.roomId))
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
    return
  }
  res.json({ snapshot: roomManager.setStandby(roomId) })
})

app.post('/api/rooms/:roomId/session/reset-buzz', requireHostAuth, (req, res) => {
  const roomId = normalizeRoomId(paramString(req.params.roomId))
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
    return
  }
  res.json({ snapshot: roomManager.resetBuzz(roomId) })
})

app.post('/api/rooms/:roomId/session/gate', requireHostAuth, (req, res) => {
  const roomId = normalizeRoomId(paramString(req.params.roomId))
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
    return
  }
  const open = Boolean(req.body?.open)
  res.json({ snapshot: roomManager.setBuzzerGate(roomId, open) })
})

app.post('/api/rooms/:roomId/session/mode', requireHostAuth, (req, res) => {
  const roomId = normalizeRoomId(paramString(req.params.roomId))
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
    return
  }
  const mode = req.body?.mode === 'auto5s' ? 'auto5s' : 'manual'
  res.json({ snapshot: roomManager.setBuzzerMode(roomId, mode) })
})

app.post('/api/rooms/:roomId/session/score', requireHostAuth, (req, res) => {
  const roomId = normalizeRoomId(paramString(req.params.roomId))
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
    return
  }
  const playerName = typeof req.body?.playerName === 'string' ? req.body.playerName : ''
  const delta = typeof req.body?.delta === 'number' ? req.body.delta : 0
  const color = typeof req.body?.color === 'string' ? req.body.color : undefined
  res.json({ snapshot: roomManager.adjustScore(roomId, playerName, delta, color) })
})

app.post('/api/rooms/:roomId/session/reset-scores', requireHostAuth, (req, res) => {
  const roomId = normalizeRoomId(paramString(req.params.roomId))
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
    return
  }
  res.json({ snapshot: roomManager.resetScores(roomId) })
})

// ---------------- Server-Sent Events ----------------

app.get('/api/rooms/:roomId/events', (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId)
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const sendSse = (eventName: string, payload: unknown) => {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`)
  }

  sendSse('state', roomManager.getSnapshot(roomId))

  const unsubscribe = roomManager.subscribe(roomId, 'display', (message) => {
    if (message.type === 'buzz') {
      sendSse('buzz', message.event)
    } else if (message.type === 'reset') {
      sendSse('reset', { roomId: message.roomId, serverTimestamp: message.serverTimestamp })
    } else if (message.type === 'participants') {
      sendSse('participants', {
        roomId: message.roomId,
        participantCount: message.participantCount,
      })
    } else if (message.type === 'session_state') {
      sendSse('session_state', message.session)
    } else if (message.type === 'room_deleted') {
      sendSse('room_deleted', { roomId: message.roomId, message: message.message })
    }
  })

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n')
  }, 25000)

  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
    res.end()
  })
})

if (IS_PROD) {
  const distDir = path.resolve(__dirname, '../dist')
  app.use(express.static(distDir))
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/ws')) {
      res.sendFile('index.html', { root: distDir })
      return
    }
    next()
  })
}

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

interface AliveWebSocket extends WebSocket {
  isAlive?: boolean
}

function sendJson(ws: WebSocket, message: WsServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

wss.on('connection', (socket: AliveWebSocket, req) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const roomParam = url.searchParams.get('room') || ''
  const roomId = normalizeRoomId(roomParam)
  const rawRole = url.searchParams.get('role') || 'player'
  const role: SubscriberRole =
    rawRole === 'host' || rawRole === 'display' ? rawRole : 'player'

  if (!roomId) {
    socket.close(1008, 'Invalid room code')
    return
  }

  if (role === 'host') {
    const token = url.searchParams.get('token') || undefined
    if (!isValidHostToken(token)) {
      socket.close(4001, 'Unauthorized host')
      return
    }
  }

  socket.isAlive = true
  socket.on('pong', () => {
    socket.isAlive = true
  })

  const unsubscribe = roomManager.subscribe(roomId, role, (message) => {
    sendJson(socket, message)
    if (message.type === 'room_deleted') {
      socket.close(4004, 'Room deleted')
    }
  })

  const initialName = url.searchParams.get('playerName')
  const initialColor = url.searchParams.get('color') || '#FF6B6B'
  if (role === 'player' && initialName) {
    roomManager.registerPlayer(roomId, initialName, initialColor)
  }

  if (role === 'host') {
    sendJson(socket, {
      type: 'host_state',
      snapshot: roomManager.getHostSnapshot(roomId),
    })
  } else {
    sendJson(socket, {
      type: 'state',
      snapshot: roomManager.getSnapshot(roomId),
    })
  }

  socket.on('message', (raw) => {
    let parsed: WsClientMessage
    try {
      parsed = JSON.parse(raw.toString()) as WsClientMessage
    } catch {
      return
    }

    if (parsed.type === 'ping') {
      sendJson(socket, { type: 'pong', serverTimestamp: Date.now() })
      return
    }

    if (parsed.type === 'register_player') {
      roomManager.registerPlayer(roomId, parsed.playerName ?? '', parsed.color ?? '')
      return
    }

    if (parsed.type === 'buzz') {
      const result = roomManager.pressButton(roomId, parsed.playerName ?? '', parsed.color ?? '')
      if (!result.accepted) {
        sendJson(socket, {
          type: 'buzz_rejected',
          reason: result.reason,
          activeBuzz: result.reason === 'locked' ? result.activeBuzz : undefined,
          message:
            result.reason === 'gate_closed' ||
            result.reason === 'question_resolved' ||
            result.reason === 'invalid_input'
              ? result.message
              : undefined,
        })
      }
    }
  })

  socket.on('close', () => {
    unsubscribe()
  })

  socket.on('error', () => {
    unsubscribe()
  })
})

const pingInterval = setInterval(() => {
  for (const client of wss.clients as Set<AliveWebSocket>) {
    if (client.isAlive === false) {
      client.terminate()
      continue
    }
    client.isAlive = false
    client.ping()
  }
}, 30000)

server.on('close', () => {
  clearInterval(pingInterval)
  roomManager.close()
})

server.listen(PORT, HOST, () => {
  console.log(`QuizButton server listening on http://${HOST}:${PORT}`)
})
