import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function TermsPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-6 inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/80 hover:text-black"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </button>

        <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
          <h1 className="mb-4 text-3xl font-bold">Terms &amp; Conditions</h1>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <p>
              This self-hosted QuizButton web application provides a real-time digital quiz buzzer
              for live games, trivia sessions, and classroom activities.
            </p>
            <p>
              <strong className="text-foreground">Privacy:</strong> Player names and color choices
              are stored only in your browser&apos;s local storage and transmitted transiently to
              other participants in the same room.
            </p>
            <p>
              <strong className="text-foreground">Real-Time Fairness:</strong> The server records
              the first press arriving during an unlocked round and locks the room for 5 seconds
              before automatically resetting.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
