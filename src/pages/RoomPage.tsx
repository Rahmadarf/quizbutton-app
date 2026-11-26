import { Copy, Share2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useRoomRealtime } from '../hooks/useRoomRealtime'
import { useWakeLock } from '../hooks/useWakeLock'
import { emitBridgeEvent, isEmbedLayout } from '../lib/embedBridge'
import {
  getPlayerProfile,
  normalizeRoomCode,
  savePlayerProfile,
} from '../lib/playerStorage'
import { PLAYER_COLORS, type BuzzEvent, type PlayerProfile } from '../types/quiz'

async function safeCopyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fallback below
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

export function RoomPage() {
  const { roomId: rawRoomId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roomId = normalizeRoomCode(rawRoomId)
  const embedded = isEmbedLayout(searchParams.toString())

  const preservedQuery = embedded ? '?embed=1' : ''

  const player = useMemo<PlayerProfile | null>(() => {
    const paramName = searchParams.get('name')?.trim().slice(0, 20)
    const paramColor = searchParams.get('color')?.trim()
    if (paramName) {
      const profile: PlayerProfile = {
        name: paramName,
        color:
          paramColor && /^#[0-9A-Fa-f]{6}$/.test(paramColor)
            ? paramColor
            : PLAYER_COLORS[0].value,
      }
      savePlayerProfile(profile)
      return profile
    }
    return getPlayerProfile()
  }, [searchParams])

  const [overlayBuzz, setOverlayBuzz] = useState<BuzzEvent | null>(null)
  const [isFading, setIsFading] = useState(false)
  const fadeTimerRef = useRef<number | null>(null)
  const clearTimerRef = useRef<number | null>(null)

  const clearOverlayTimers = useCallback(() => {
    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = null
    }
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current)
      clearTimerRef.current = null
    }
  }, [])

  const triggerOverlay = useCallback(
    (event: BuzzEvent) => {
      clearOverlayTimers()
      setOverlayBuzz(event)
      setIsFading(false)

      // In manual lock mode (until Host resets), keep overlay up until server emits reset
      if (event.manualLock || event.lockedUntil === null) {
        return
      }

      const remainingMs = Math.max(500, event.lockedUntil - Date.now())
      const fadeDurationMs = Math.min(event.fadeDurationMs || 500, remainingMs)
      const solidDurationMs = Math.max(0, remainingMs - fadeDurationMs)

      fadeTimerRef.current = window.setTimeout(() => {
        setIsFading(true)
      }, solidDurationMs)

      clearTimerRef.current = window.setTimeout(() => {
        setOverlayBuzz(null)
        setIsFading(false)
      }, remainingMs)
    },
    [clearOverlayTimers],
  )

  const handleReset = useCallback(() => {
    clearOverlayTimers()
    setOverlayBuzz(null)
    setIsFading(false)
  }, [clearOverlayTimers])

  useEffect(() => {
    if (!roomId || roomId.length < 3) {
      navigate(`/${preservedQuery}`, { replace: true })
      return
    }
    if (!player) {
      navigate(`/join/${roomId}${preservedQuery}`, { replace: true })
      return
    }

    emitBridgeEvent({
      source: 'quizbutton',
      type: 'quizbutton:room_joined',
      payload: { roomId, player },
    })
  }, [navigate, player, preservedQuery, roomId])

  useEffect(() => {
    return () => clearOverlayTimers()
  }, [clearOverlayTimers])

  // Keep mobile screen awake while waiting in the quiz room
  useWakeLock(Boolean(player && roomId))

  const { roomQuery, buzzMutation } = useRoomRealtime({
    roomId,
    role: 'player',
    player,
    enabled: Boolean(player && roomId),
    onBuzz: triggerOverlay,
    onReset: handleReset,
    onBuzzRejected: (reason, message) => {
      if (reason === 'gate_closed' || reason === 'question_resolved') {
        toast.info(message || 'Buzzer sedang dikunci oleh Host')
      }
    },
  })

  if (!player || !roomId) {
    return null
  }

  const session = roomQuery.data?.session
  const gateClosed = session ? !session.buzzerGateOpen : false
  const questionResolved = session ? session.status === 'active' && session.questionResolved : false
  const sessionFinished = session?.status === 'finished'
  const pressDisabled = Boolean(overlayBuzz) || gateClosed || questionResolved || sessionFinished

  const joinUrl = `${window.location.origin}/join/${roomId}`

  const handleCopyCode = async () => {
    const ok = await safeCopyToClipboard(roomId)
    if (ok) {
      toast.success('Room code copied!')
    } else {
      toast.error('Could not copy room code')
    }
  }

  const handleCopyLink = async () => {
    const ok = await safeCopyToClipboard(joinUrl)
    if (ok) {
      toast.success('Room link copied!')
    } else {
      toast.error('Could not copy room link')
    }
  }

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Join Quiz Room ${roomId}`,
          text: `Join my quiz buzzer room with code ${roomId}!`,
          url: joinUrl,
        })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
      }
    }
    await handleCopyLink()
  }

  const handlePress = () => {
    if (pressDisabled) return
    buzzMutation.mutate({
      playerName: player.name,
      color: player.color,
    })
  }

  const bottomText = sessionFinished
    ? 'Sesi kuis selesai! Lihat skor akhir di layar display.'
    : questionResolved
      ? 'Soal terjawab! Menunggu Host ke soal berikutnya...'
      : gateClosed
        ? 'Buzzer sedang dikunci sementara oleh Host...'
        : "Press the button to change everyone's screen color!"

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-purple-600 to-blue-600">
      <header className="bg-white/90 shadow-md backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          {/* Desktop header */}
          <div className="hidden items-center justify-between md:flex">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleCopyCode}
                title="Click to copy room code"
                className="h-auto cursor-pointer p-0 text-2xl font-bold text-foreground transition-opacity hover:opacity-80"
              >
                Room: {roomId}
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-gray-100"
              >
                <Copy className="h-4 w-4" />
                Copy Link
              </button>
            </div>

            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => navigate(`/join/${roomId}${preservedQuery}`)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-gray-100"
              >
                <span
                  className="h-6 w-6 rounded-full border-2 border-gray-300"
                  style={{ backgroundColor: player.color }}
                />
                <span className="font-medium">{player.name}</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-gray-100"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            </div>
          </div>

          {/* Mobile header */}
          <div className="flex items-center justify-between md:hidden">
            <button
              type="button"
              onClick={handleCopyCode}
              title="Click to copy room code"
              className="h-auto cursor-pointer p-0 text-xl font-bold text-foreground"
            >
              {roomId}
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(`/join/${roomId}${preservedQuery}`)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-gray-100"
              >
                <span
                  className="h-5 w-5 rounded-full border-2 border-gray-300"
                  style={{ backgroundColor: player.color }}
                />
                <span className="text-sm font-medium">{player.name}</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                aria-label="Share room"
                className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm font-medium shadow-xs transition-colors hover:bg-gray-100"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 p-4">
        <button
          type="button"
          onClick={handlePress}
          disabled={pressDisabled}
          className="h-64 w-64 transform cursor-pointer select-none rounded-full bg-white text-6xl font-bold text-purple-600 shadow-2xl transition hover:scale-105 hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100"
        >
          {gateClosed || questionResolved || sessionFinished ? 'WAIT' : 'PRESS'}
        </button>
      </div>

      <div className="bg-white/90 p-4 text-center backdrop-blur-sm">
        <p className="text-sm text-gray-600">{bottomText}</p>
      </div>

      {overlayBuzz && (
        <div
          role="alert"
          aria-live="assertive"
          style={{ backgroundColor: overlayBuzz.color }}
          className={`fixed inset-0 z-50 flex items-center justify-center px-6 transition-opacity duration-500 ${
            isFading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="text-center">
            <h1 className="animate-[bounce-in_0.4s_ease-out] break-words text-6xl font-bold text-white drop-shadow-lg md:text-8xl">
              {overlayBuzz.playerName}
            </h1>
            <p
              className="mt-4 text-xl text-white/90 drop-shadow-md md:text-2xl"
              style={{ animation: 'fade-slide-down 0.4s ease-out 0.2s both' }}
            >
              {overlayBuzz.manualLock
                ? 'pressed the button! Menunggu Host...'
                : 'pressed the button!'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
