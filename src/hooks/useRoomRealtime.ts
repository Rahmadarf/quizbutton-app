import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { emitBridgeEvent, emitBuzzBridgeEvent } from '../lib/embedBridge'
import { getHostAuthHeaders } from '../lib/hostAuth'
import type {
  BuzzEvent,
  BuzzerMode,
  HostRoomSnapshot,
  OptionKey,
  PlayerProfile,
  RoomSnapshot,
  WsServerMessage,
} from '../types/quiz'
import { BANK_QUERY_KEY } from './useQuestionBank'

export type RealtimeRole = 'player' | 'display' | 'host'

export function roomQueryKey(roomId: string, role: RealtimeRole = 'player') {
  return ['room', roomId, role === 'host' ? 'host' : 'public'] as const
}

class UnauthorizedHostError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnauthorizedHostError'
  }
}

async function fetchRoomSnapshot<T extends RoomSnapshot | HostRoomSnapshot>(
  roomId: string,
  role: RealtimeRole,
  hostToken?: string | null,
): Promise<T> {
  const qs = role === 'host' ? '?role=host' : ''
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}${qs}`, {
    headers: role === 'host' ? getHostAuthHeaders(hostToken) : undefined,
  })
  if (res.status === 401) {
    throw new UnauthorizedHostError('Sesi admin berakhir. Masukkan passcode admin.')
  }
  if (!res.ok) {
    throw new Error('Failed to load room state')
  }
  return (await res.json()) as T
}

function buildWsUrl(
  roomId: string,
  role: RealtimeRole,
  player?: PlayerProfile | null,
  hostToken?: string | null,
): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams({ room: roomId, role })
  if (role === 'player' && player) {
    params.set('playerName', player.name)
    params.set('color', player.color)
  }
  if (role === 'host' && hostToken) {
    params.set('token', hostToken)
  }
  return `${protocol}//${window.location.host}/ws?${params.toString()}`
}

async function postJson<T>(url: string, body?: unknown, hostToken?: string | null): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getHostAuthHeaders(hostToken),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (res.status === 401) {
    throw new UnauthorizedHostError(data.error || 'Sesi admin berakhir. Masukkan passcode admin.')
  }
  if (!res.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data
}

interface UseRoomRealtimeOptions {
  roomId: string
  role?: RealtimeRole
  player?: PlayerProfile | null
  hostToken?: string | null
  enabled: boolean
  onBuzz?: (event: BuzzEvent) => void
  onReset?: (roomId: string, serverTimestamp: number) => void
  onBuzzRejected?: (reason: string, message?: string) => void
  onRoomDeleted?: (message: string) => void
  onHostUnauthorized?: () => void
}

export function useRoomRealtime<TSnapshot extends RoomSnapshot | HostRoomSnapshot = RoomSnapshot>({
  roomId,
  role = 'player',
  player = null,
  hostToken = null,
  enabled,
  onBuzz,
  onReset,
  onBuzzRejected,
  onRoomDeleted,
  onHostUnauthorized,
}: UseRoomRealtimeOptions) {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const onBuzzRef = useRef(onBuzz)
  const onResetRef = useRef(onReset)
  const onRejectedRef = useRef(onBuzzRejected)
  const onRoomDeletedRef = useRef(onRoomDeleted)
  const onUnauthorizedRef = useRef(onHostUnauthorized)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting')

  onBuzzRef.current = onBuzz
  onResetRef.current = onReset
  onRejectedRef.current = onBuzzRejected
  onRoomDeletedRef.current = onRoomDeleted
  onUnauthorizedRef.current = onHostUnauthorized

  const queryKey = roomQueryKey(roomId, role)
  const canConnect = enabled && Boolean(roomId) && (role !== 'host' || Boolean(hostToken))

  const roomQuery = useQuery<TSnapshot>({
    queryKey,
    queryFn: () => fetchRoomSnapshot<TSnapshot>(roomId, role, hostToken),
    enabled: canConnect,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: (_count, err) => !(err instanceof UnauthorizedHostError),
  })

  useEffect(() => {
    if (roomQuery.error instanceof UnauthorizedHostError) {
      onUnauthorizedRef.current?.()
    }
  }, [roomQuery.error])

  useEffect(() => {
    if (!canConnect) return

    let disposed = false
    let reconnectTimer: number | null = null
    let pingTimer: number | null = null
    let reconnectAttempt = 0

    const connect = () => {
      if (disposed) return
      setConnectionStatus(reconnectAttempt === 0 ? 'connecting' : 'reconnecting')

      const ws = new WebSocket(buildWsUrl(roomId, role, player, hostToken))
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

        if (msg.type === 'room_deleted') {
          disposed = true
          onRoomDeletedRef.current?.(msg.message || 'Room telah dihapus oleh Admin.')
          ws.close()
          return
        }

        if (msg.type === 'state' || msg.type === 'host_state') {
          queryClient.setQueryData(queryKey, msg.snapshot)
          if (msg.type === 'state') {
            emitBridgeEvent({
              source: 'quizbutton',
              type: 'quizbutton:state',
              payload: { roomId, snapshot: msg.snapshot },
            })
          }
          const active = msg.snapshot.activeBuzz
          if (active && (active.manualLock || (msg.snapshot.remainingLockMs ?? 0) > 0)) {
            onBuzzRef.current?.(active)
          }
          return
        }

        if (msg.type === 'session_state' || msg.type === 'host_session_state') {
          queryClient.setQueryData<TSnapshot>(queryKey, (prev) =>
            prev ? ({ ...prev, session: msg.session } as TSnapshot) : prev,
          )
          return
        }

        if (msg.type === 'buzz') {
          queryClient.setQueryData<TSnapshot>(queryKey, (prev) => {
            if (!prev) return prev
            const existingHistory = prev.history ?? []
            const alreadyInHistory = existingHistory.some((item) => item.buzzId === msg.event.buzzId)
            return {
              ...prev,
              activeBuzz: msg.event,
              isLocked: true,
              lockedUntil: msg.event.lockedUntil,
              remainingLockMs:
                msg.event.lockedUntil !== null
                  ? Math.max(0, msg.event.lockedUntil - Date.now())
                  : null,
              history: alreadyInHistory
                ? existingHistory
                : [msg.event, ...existingHistory].slice(0, 50),
            }
          })
          emitBuzzBridgeEvent(msg.event)
          onBuzzRef.current?.(msg.event)
          return
        }

        if (msg.type === 'buzz_rejected') {
          onRejectedRef.current?.(msg.reason, msg.message)
          return
        }

        if (msg.type === 'reset') {
          queryClient.setQueryData<TSnapshot>(queryKey, (prev) =>
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
          queryClient.setQueryData<TSnapshot>(queryKey, (prev) =>
            prev ? { ...prev, participantCount: msg.participantCount } : prev,
          )
        }
      }

      ws.onclose = (closeEvt) => {
        if (pingTimer !== null) {
          window.clearInterval(pingTimer)
          pingTimer = null
        }
        if (wsRef.current === ws) {
          wsRef.current = null
        }
        if (closeEvt.code === 4001) {
          disposed = true
          onUnauthorizedRef.current?.()
          return
        }
        if (closeEvt.code === 4004) {
          disposed = true
          return
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
  }, [canConnect, hostToken, player?.color, player?.name, queryClient, role, roomId])

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

  const syncHostSnapshot = (snapshot?: HostRoomSnapshot, bank?: unknown) => {
    if (snapshot) {
      queryClient.setQueryData(roomQueryKey(roomId, 'host'), snapshot)
    }
    if (bank) {
      queryClient.setQueryData([...BANK_QUERY_KEY, true], bank)
    }
  }

  const handleMutationError = (err: unknown) => {
    if (err instanceof UnauthorizedHostError) {
      onUnauthorizedRef.current?.()
    }
  }

  const startSessionMutation = useMutation({
    mutationFn: (opts?: { count?: number; shuffle?: boolean; resetScores?: boolean }) =>
      postJson<{ snapshot: HostRoomSnapshot; bank: unknown }>(
        `/api/rooms/${encodeURIComponent(roomId)}/session/start`,
        opts ?? { count: 10, shuffle: true, resetScores: true },
        hostToken,
      ),
    onSuccess: (data) => syncHostSnapshot(data.snapshot, data.bank),
    onError: handleMutationError,
  })

  const submitAnswerMutation = useMutation({
    mutationFn: (option: OptionKey) =>
      postJson<{ ok: true; correct: boolean; snapshot: HostRoomSnapshot }>(
        `/api/rooms/${encodeURIComponent(roomId)}/session/answer`,
        { option },
        hostToken,
      ),
    onSuccess: (data) => syncHostSnapshot(data.snapshot),
    onError: handleMutationError,
  })

  const revealAnswerMutation = useMutation({
    mutationFn: () =>
      postJson<{ snapshot: HostRoomSnapshot }>(
        `/api/rooms/${encodeURIComponent(roomId)}/session/reveal`,
        undefined,
        hostToken,
      ),
    onSuccess: (data) => syncHostSnapshot(data.snapshot),
    onError: handleMutationError,
  })

  const nextQuestionMutation = useMutation({
    mutationFn: () =>
      postJson<{ snapshot: HostRoomSnapshot; bank: unknown }>(
        `/api/rooms/${encodeURIComponent(roomId)}/session/next`,
        undefined,
        hostToken,
      ),
    onSuccess: (data) => syncHostSnapshot(data.snapshot, data.bank),
    onError: handleMutationError,
  })

  const finishSessionMutation = useMutation({
    mutationFn: () =>
      postJson<{ snapshot: HostRoomSnapshot }>(
        `/api/rooms/${encodeURIComponent(roomId)}/session/finish`,
        undefined,
        hostToken,
      ),
    onSuccess: (data) => syncHostSnapshot(data.snapshot),
    onError: handleMutationError,
  })

  const standbySessionMutation = useMutation({
    mutationFn: () =>
      postJson<{ snapshot: HostRoomSnapshot }>(
        `/api/rooms/${encodeURIComponent(roomId)}/session/standby`,
        undefined,
        hostToken,
      ),
    onSuccess: (data) => syncHostSnapshot(data.snapshot),
    onError: handleMutationError,
  })

  const resetBuzzMutation = useMutation({
    mutationFn: () =>
      postJson<{ snapshot: HostRoomSnapshot }>(
        `/api/rooms/${encodeURIComponent(roomId)}/session/reset-buzz`,
        undefined,
        hostToken,
      ),
    onSuccess: (data) => syncHostSnapshot(data.snapshot),
    onError: handleMutationError,
  })

  const setGateMutation = useMutation({
    mutationFn: (open: boolean) =>
      postJson<{ snapshot: HostRoomSnapshot }>(
        `/api/rooms/${encodeURIComponent(roomId)}/session/gate`,
        { open },
        hostToken,
      ),
    onSuccess: (data) => syncHostSnapshot(data.snapshot),
    onError: handleMutationError,
  })

  const setModeMutation = useMutation({
    mutationFn: (mode: BuzzerMode) =>
      postJson<{ snapshot: HostRoomSnapshot }>(
        `/api/rooms/${encodeURIComponent(roomId)}/session/mode`,
        { mode },
        hostToken,
      ),
    onSuccess: (data) => syncHostSnapshot(data.snapshot),
    onError: handleMutationError,
  })

  const adjustScoreMutation = useMutation({
    mutationFn: (payload: { playerName: string; delta: number; color?: string }) =>
      postJson<{ snapshot: HostRoomSnapshot }>(
        `/api/rooms/${encodeURIComponent(roomId)}/session/score`,
        payload,
        hostToken,
      ),
    onSuccess: (data) => syncHostSnapshot(data.snapshot),
    onError: handleMutationError,
  })

  const resetScoresMutation = useMutation({
    mutationFn: () =>
      postJson<{ snapshot: HostRoomSnapshot }>(
        `/api/rooms/${encodeURIComponent(roomId)}/session/reset-scores`,
        undefined,
        hostToken,
      ),
    onSuccess: (data) => syncHostSnapshot(data.snapshot),
    onError: handleMutationError,
  })

  return {
    roomQuery,
    buzzMutation,
    connectionStatus,
    hostActions: {
      startSessionMutation,
      submitAnswerMutation,
      revealAnswerMutation,
      nextQuestionMutation,
      finishSessionMutation,
      standbySessionMutation,
      resetBuzzMutation,
      setGateMutation,
      setModeMutation,
      adjustScoreMutation,
      resetScoresMutation,
    },
  }
}
