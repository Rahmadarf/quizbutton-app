import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Timer, Users, Zap } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { generateRoomCode, normalizeRoomCode } from '../lib/playerStorage'

export function HomePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [roomCode, setRoomCode] = useState('')

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : ''

  const handleJoinSubmit = (e: FormEvent) => {
    e.preventDefault()
    const normalized = normalizeRoomCode(roomCode)
    if (normalized.length !== 6) {
      toast.error('Please enter a 6-character room code')
      return
    }
    navigate(`/join/${normalized}${suffix}`)
  }

  const handleStartSession = () => {
    const newCode = generateRoomCode(6)
    navigate(`/join/${newCode}${suffix}`)
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="flex flex-col items-center text-center text-white/90">
          <div className="mb-8">
            <h1 className="mb-4 text-4xl font-bold sm:text-5xl md:text-6xl">
              QuizButton.app
            </h1>
            <p className="mb-2 text-xl sm:text-2xl">
              The Digital Quiz Buzzer That Shows Who&apos;s First
            </p>
            <p className="text-base opacity-90 sm:text-lg">
              Create a room, share the code, and see who has the fastest reflexes!
            </p>
          </div>

          <div className="mb-12 flex w-full max-w-md flex-col gap-6">
            <form onSubmit={handleJoinSubmit} className="flex gap-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(normalizeRoomCode(e.target.value))}
                maxLength={6}
                placeholder="Enter room code"
                aria-label="Room code"
                autoComplete="off"
                className="flex h-9 w-full min-w-0 flex-1 rounded-md border border-white/90 bg-white/20 px-3 py-1 text-center font-mono text-lg text-white placeholder:text-white/90 shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-white/60"
              />
              <button
                type="submit"
                className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-white/90 px-4 py-2 text-sm font-medium text-purple-600 shadow-xs transition-colors hover:bg-white"
              >
                Join Room
              </button>
            </form>

            <div className="flex items-center gap-2 text-white">
              <div className="h-px flex-1 bg-white/30" />
              <span className="px-3 text-sm font-medium">OR</span>
              <div className="h-px flex-1 bg-white/30" />
            </div>

            <button
              type="button"
              onClick={handleStartSession}
              className="inline-flex h-10 transform cursor-pointer items-center justify-center rounded-md bg-white px-6 py-5 text-lg font-semibold text-purple-600 shadow-lg transition hover:scale-105 hover:bg-gray-100 sm:px-8 sm:py-6 sm:text-xl"
            >
              Start a Quiz Session
            </button>
          </div>

          <div className="mb-12 grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-center">
              <Users className="mb-3 h-12 w-12 sm:h-16 sm:w-16" />
              <h3 className="text-base font-semibold sm:text-lg">Multiple Participants</h3>
            </div>
            <div className="flex flex-col items-center">
              <Zap className="mb-3 h-12 w-12 sm:h-16 sm:w-16" />
              <h3 className="text-base font-semibold sm:text-lg">Instant Results</h3>
            </div>
            <div className="flex flex-col items-center">
              <Timer className="mb-3 h-12 w-12 sm:h-16 sm:w-16" />
              <h3 className="text-base font-semibold sm:text-lg">Fair &amp; Transparent</h3>
            </div>
          </div>

          <div className="mt-12 max-w-2xl px-4 sm:mt-16">
            <h2 className="mb-4 text-2xl font-bold sm:text-3xl">How It Works</h2>
            <ol className="space-y-3 text-left text-sm sm:text-base">
              <li className="flex items-start">
                <span className="mr-2 font-bold">1.</span>
                <span>Quiz master creates a room and shares the code</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 font-bold">2.</span>
                <span>Participants join using the room code on their devices</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 font-bold">3.</span>
                <span>When a question is asked, participants press their buzzer</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 font-bold">4.</span>
                <span>Everyone instantly sees who buzzed in first - no disputes!</span>
              </li>
            </ol>

            <div className="mt-10">
              <Link
                to="/embed-demo"
                className="text-xs font-medium text-white/75 underline decoration-white/40 underline-offset-4 transition hover:text-white"
              >
                Developer Embed &amp; Event API Demo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
