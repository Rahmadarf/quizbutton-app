import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import { WebSocket, WebSocketServer } from 'ws'
import { RoomManager, normalizeRoomId } from './roomManager.js'
import type { WsClientMessage, WsServerMessage } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001
const HOST = process.env.HOST || '0.0.0.0'
const IS_PROD = process.env.NODE_ENV === 'production'

const app = express()
const roomManager = new RoomManager()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

app.get('/api/rooms/:roomId', (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId)
  if (!roomId) {
    res.status(400).json({ error: 'Invalid room code' })
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
    if (result.reason === 'locked') {
      res.status(409).json(result)
      return
    }
    res.status(400).json(result)
    return
  }

  res.json(result)
})

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

  const unsubscribe = roomManager.subscribe(roomId, (message) => {
    if (message.type === 'buzz') {
      sendSse('buzz', message.event)
    } else if (message.type === 'reset') {
      sendSse('reset', { roomId: message.roomId, serverTimestamp: message.serverTimestamp })
    } else if (message.type === 'participants') {
      sendSse('participants', {
        roomId: message.roomId,
        participantCount: message.participantCount,
      })
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

  if (!roomId) {
    socket.close(1008, 'Invalid room code')
    return
  }

  socket.isAlive = true
  socket.on('pong', () => {
    socket.isAlive = true
  })

  const unsubscribe = roomManager.subscribe(roomId, (message) => {
    sendJson(socket, message)
  })

  sendJson(socket, {
    type: 'state',
    snapshot: roomManager.getSnapshot(roomId),
  })

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

    if (parsed.type === 'buzz') {
      const result = roomManager.pressButton(roomId, parsed.playerName ?? '', parsed.color ?? '')
      if (!result.accepted) {
        sendJson(socket, {
          type: 'buzz_rejected',
          reason: result.reason,
          activeBuzz: result.reason === 'locked' ? result.activeBuzz : undefined,
          message: result.reason === 'invalid_input' ? result.message : undefined,
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
