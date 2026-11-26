import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { emitBridgeEvent, emitBuzzBridgeEvent } from '../lib/embedBridge'
import type { BuzzEvent, RoomSnapshot, WsServerMessage } from '../types/quiz'

export function roomQueryKey(roomId: string) {
  return ['room', roomId] as const
}

async function fetchRoomSnapshot(roomId: string): Promise<RoomSnapshot> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`)
  if (!res.ok) {
    throw new Error('Failed to load room state')
  }
  return (await res.json()) as RoomSnapshot
}

function buildWsUrl(roomId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws?room=${encodeURIComponent(roomId)}`
}

interface UseRoomRealtimeOptions {
  roomId: string
  enabled: boolean
  onBuzz?: (event: BuzzEvent) => void
  onReset?: (roomId: string, serverTimestamp: number) => void
}

export function useRoomRealtime({ roomId, enabled, onBuzz, onReset }: UseRoomRealtimeOptions) {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const onBuzzRef = useRef(onBuzz)
  const onResetRef = useRef(onReset)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting')

  onBuzzRef.current = onBuzz
  onResetRef.current = onReset

  const roomQuery = useQuery<RoomSnapshot>({
    queryKey: roomQueryKey(roomId),
    queryFn: () => fetchRoomSnapshot(roomId),
    enabled: enabled && Boolean(roomId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!enabled || !roomId) return

    let disposed = false
    let reconnectTimer: number | null = null
    let pingTimer: number | null = null
    let reconnectAttempt = 0

    const connect = () => {
      if (disposed) return
      setConnectionStatus(reconnectAttempt === 0 ? 'connecting' : 'reconnecting')

      const ws = new WebSocket(buildWsUrl(roomId))
      wsRef.current = ws

      ws.onopen = () => {
        if (disposed) {
          ws.close()
          return
        }
        reconnectAttempt = 0
        setConnectionStatus('connected')
        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 25000)
      }

      ws.onmessage = (evt) => {
        let msg: WsServerMessage
        try {
          msg = JSON.parse(String(evt.data)) as WsServerMessage
        } catch {
          return
        }

        if (msg.type === 'state') {
          queryClient.setQueryData(roomQueryKey(roomId), msg.snapshot)
          emitBridgeEvent({
            source: 'quizbutton',
            type: 'quizbutton:state',
            payload: { roomId, snapshot: msg.snapshot },
          })
          if (msg.snapshot.activeBuzz && msg.snapshot.remainingLockMs > 0) {
            onBuzzRef.current?.(msg.snapshot.activeBuzz)
          }
          return
        }

        if (msg.type === 'buzz') {
          queryClient.setQueryData<RoomSnapshot>(roomQueryKey(roomId), (prev) => {
            const existingHistory = prev?.history ?? []
            const alreadyInHistory = existingHistory.some((item) => item.buzzId === msg.event.buzzId)
            return {
              roomId,
              activeBuzz: msg.event,
              isLocked: true,
              lockedUntil: msg.event.lockedUntil,
              remainingLockMs: Math.max(0, msg.event.lockedUntil - Date.now()),
              participantCount: prev?.participantCount ?? 1,
              history: alreadyInHistory
                ? existingHistory
                : [msg.event, ...existingHistory].slice(0, 50),
            }
          })
          emitBuzzBridgeEvent(msg.event)
          onBuzzRef.current?.(msg.event)
          return
        }

        if (msg.type === 'reset') {
          queryClient.setQueryData<RoomSnapshot>(roomQueryKey(roomId), (prev) =>
            prev
              ? {
                  ...prev,
                  activeBuzz: null,
                  isLocked: false,
                  lockedUntil: null,
                  remainingLockMs: 0,
                }
              : prev,
          )
          emitBridgeEvent({
            source: 'quizbutton',
            type: 'quizbutton:reset',
            payload: { roomId: msg.roomId, serverTimestamp: msg.serverTimestamp },
          })
          onResetRef.current?.(msg.roomId, msg.serverTimestamp)
          return
        }

        if (msg.type === 'participants') {
          queryClient.setQueryData<RoomSnapshot>(roomQueryKey(roomId), (prev) =>
            prev ? { ...prev, participantCount: msg.participantCount } : prev,
          )
        }
      }

      ws.onclose = () => {
        if (pingTimer !== null) {
          window.clearInterval(pingTimer)
          pingTimer = null
        }
        if (wsRef.current === ws) {
          wsRef.current = null
        }
        if (!disposed) {
          reconnectAttempt += 1
          const delay = Math.min(500 * 2 ** (reconnectAttempt - 1), 5000)
          setConnectionStatus('reconnecting')
          reconnectTimer = window.setTimeout(connect, delay)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      if (pingTimer !== null) window.clearInterval(pingTimer)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [enabled, queryClient, roomId])

  const buzzMutation = useMutation({
    mutationFn: async ({ playerName, color }: { playerName: string; color: string }) => {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'buzz', playerName, color }))
        return { via: 'ws' as const }
      }

      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/buzz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, color }),
      })

      if (!res.ok && res.status !== 409) {
        throw new Error('Failed to send buzz')
      }

      return { via: 'http' as const }
    },
  })

  return {
    roomQuery,
    buzzMutation,
    connectionStatus,
  }
}
