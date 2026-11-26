import { ArrowLeft, Copy, Radio } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { generateRoomCode, normalizeRoomCode } from '../lib/playerStorage'

interface CapturedEvent {
  id: string
  channel: 'postMessage' | 'SSE'
  type: string
  winnerName?: string
  winnerColor?: string
  timestamp: string
  raw: string
}

export function EmbedDemoPage() {
  const navigate = useNavigate()
  const [roomId, setRoomId] = useState(() => generateRoomCode(6))
  const [inputRoom, setInputRoom] = useState(roomId)
  const [events, setEvents] = useState<CapturedEvent[]>([])
  const [latestWinner, setLatestWinner] = useState<{
    name: string
    color: string
    time: string
  } | null>(null)

  const embedSrc = `/join/${roomId}?embed=1`

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || data.source !== 'quizbutton') return

      const now = new Date().toLocaleTimeString()
      if (data.type === 'quizbutton:buzz' && data.payload?.winner) {
        setLatestWinner({
          name: data.payload.winner.name,
          color: data.payload.winner.color,
          time: now,
        })
      }

      setEvents((prev) =>
        [
          {
            id: `${Date.now()}-${Math.random()}`,
            channel: 'postMessage' as const,
            type: String(data.type),
            winnerName: data.payload?.winner?.name,
            winnerColor: data.payload?.winner?.color,
            timestamp: now,
            raw: JSON.stringify(data.payload),
          },
          ...prev,
        ].slice(0, 30),
      )
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    const sse = new EventSource(`/api/rooms/${encodeURIComponent(roomId)}/events`)

    const handleBuzz = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as {
          playerName: string
          color: string
          serverTimestamp: number
        }
        const now = new Date(parsed.serverTimestamp).toLocaleTimeString()
        setLatestWinner({
          name: parsed.playerName,
          color: parsed.color,
          time: now,
        })
        setEvents((prev) =>
          [
            {
              id: `${Date.now()}-${Math.random()}`,
              channel: 'SSE' as const,
              type: 'buzz',
              winnerName: parsed.playerName,
              winnerColor: parsed.color,
              timestamp: now,
              raw: e.data,
            },
            ...prev,
          ].slice(0, 30),
        )
      } catch {
        // Ignore parse error
      }
    }

    const handleReset = (e: MessageEvent) => {
      setEvents((prev) =>
        [
          {
            id: `${Date.now()}-${Math.random()}`,
            channel: 'SSE' as const,
            type: 'reset',
            timestamp: new Date().toLocaleTimeString(),
            raw: e.data,
          },
          ...prev,
        ].slice(0, 30),
      )
    }

    sse.addEventListener('buzz', handleBuzz)
    sse.addEventListener('reset', handleReset)

    return () => {
      sse.removeEventListener('buzz', handleBuzz)
      sse.removeEventListener('reset', handleReset)
      sse.close()
    }
  }, [roomId])

  const snippet = `<iframe
  src="${window.location.origin}/join/${roomId}?embed=1"
  allow="clipboard-write; web-share; screen-wake-lock"
  style="width:100%;height:600px;border:0;"
></iframe>
<script>
  window.addEventListener('message', (event) => {
    if (event.data?.source !== 'quizbutton') return;
    if (event.data.type === 'quizbutton:buzz') {
      console.log('Winner:', event.data.payload.winner);
    }
  });
</script>`

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      toast.success('Embed snippet copied!')
    } catch {
      toast.error('Failed to copy snippet')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              const normalized = normalizeRoomCode(inputRoom)
              if (normalized.length >= 3) {
                setRoomId(normalized)
                setEvents([])
                setLatestWinner(null)
              }
            }}
            className="flex items-center gap-2"
          >
            <span className="text-sm text-slate-400">Room:</span>
            <input
              value={inputRoom}
              onChange={(e) => setInputRoom(normalizeRoomCode(e.target.value))}
              maxLength={6}
              className="h-9 w-28 rounded-md border border-slate-700 bg-slate-900 px-3 text-center font-mono text-sm uppercase text-white outline-none focus:border-purple-400"
            />
            <button
              type="submit"
              className="h-9 cursor-pointer rounded-md bg-purple-600 px-3 text-sm font-medium text-white hover:bg-purple-500"
            >
              Load Room
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 text-xs text-slate-400">
                <span>Embedded Iframe ({embedSrc})</span>
                <a
                  href={`/join/${roomId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-purple-400 hover:underline"
                >
                  Open Room in New Tab
                </a>
              </div>
              <iframe
                key={roomId}
                src={embedSrc}
                title="QuizButton Embed Demo"
                allow="clipboard-write; web-share; screen-wake-lock"
                className="h-[580px] w-full border-0"
              />
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:col-span-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Radio className="h-4 w-4 text-emerald-400" />
                Captured Winner (Live via postMessage &amp; SSE)
              </div>
              {latestWinner ? (
                <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <span
                    className="h-10 w-10 shrink-0 rounded-full border-2 border-white/30"
                    style={{ backgroundColor: latestWinner.color }}
                  />
                  <div>
                    <div className="text-xl font-bold text-white">{latestWinner.name}</div>
                    <div className="text-xs text-slate-400">
                      Captured at {latestWinner.time} • Color {latestWinner.color}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-400">
                  Join room <span className="font-mono text-white">{roomId}</span> in the iframe
                  (or another tab) and press the button to capture who pressed first.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-300">Live Event Stream</h2>
                <button
                  type="button"
                  onClick={() => setEvents([])}
                  className="cursor-pointer text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto font-mono text-xs">
                {events.length === 0 ? (
                  <p className="text-slate-500">Waiting for events...</p>
                ) : (
                  events.map((evt) => (
                    <div
                      key={evt.id}
                      className="rounded border border-slate-800 bg-slate-950 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-purple-300">
                          [{evt.channel}] {evt.type}
                        </span>
                        <span className="text-slate-500">{evt.timestamp}</span>
                      </div>
                      <div className="mt-1 truncate text-slate-400">{evt.raw}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-300">
                  Embed Snippet (Parent Website)
                </h2>
                <button
                  type="button"
                  onClick={handleCopySnippet}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-300">
                {snippet}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
