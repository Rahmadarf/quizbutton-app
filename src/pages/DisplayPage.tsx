import {
  CheckCircle2,
  Maximize2,
  Minimize2,
  Radio,
  Trophy,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoomRealtime } from '../hooks/useRoomRealtime'
import { useWakeLock } from '../hooks/useWakeLock'
import { normalizeRoomCode } from '../lib/playerStorage'
import { OPTION_KEYS, type OptionKey, type RoomSnapshot, type ScoreEntry } from '../types/quiz'

function rankBadgeStyle(rank: number): { bg: string; text: string } {
  if (rank === 1) return { bg: '#fbcd3a', text: '#03071e' }
  if (rank === 2) return { bg: '#82aff9', text: '#03071e' }
  if (rank === 3) return { bg: '#fa9f1f', text: '#03071e' }
  return { bg: '#d6e0ff', text: '#0b1437' }
}

function ScoreboardPanel({
  scoreboard,
  activePlayerName,
}: {
  scoreboard: ScoreEntry[]
  activePlayerName?: string | null
}) {
  return (
    <aside className="flex h-full flex-col rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-5 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)]">
      <div className="mb-4 flex items-center justify-between border-b border-[#cbd5f5] pb-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#eaf0ff] text-[#0d2be3]">
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold leading-tight text-[#0b1437]">Papan Skor</h2>
            <p className="text-xs text-[#434d7e]">Peringkat &amp; jawaban benar</p>
          </div>
        </div>
        <span className="tnum rounded-full bg-[#eaf0ff] px-2.5 py-1 text-xs font-semibold text-[#2a55d6]">
          {scoreboard.length} peserta
        </span>
      </div>

      {scoreboard.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-[8px] border border-dashed border-[#cbd5f5] bg-[#f3f6ff] p-6 text-center">
          <Users className="mb-2 h-8 w-8 text-[#5c6694]" />
          <p className="text-sm font-medium text-[#434d7e]">Belum ada peserta bergabung</p>
          <p className="mt-1 text-xs text-[#5c6694]">
            Peserta otomatis tampil saat masuk room
          </p>
        </div>
      ) : (
        <ol className="flex-1 space-y-2.5 overflow-y-auto pr-0.5">
          {scoreboard.map((entry, idx) => {
            const rank = idx + 1
            const badge = rankBadgeStyle(rank)
            const isBuzzing =
              Boolean(activePlayerName) &&
              entry.playerName.toLowerCase() === activePlayerName?.toLowerCase()

            return (
              <li
                key={entry.playerName.toLowerCase()}
                className={`cm-board-card flex items-center justify-between gap-3 rounded-[14px] border px-3.5 py-2.5 ${
                  isBuzzing
                    ? 'border-[#0d2be3] bg-[#eaf0ff] cm-ring-pulse'
                    : rank === 1 && entry.correctCount > 0
                      ? 'border-[#cbd5f5] bg-[#f3f6ff]'
                      : 'border-[#cbd5f5] bg-[#ffffff]'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    style={{ backgroundColor: badge.bg, color: badge.text }}
                    className="tnum inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-sm font-bold"
                  >
                    {rank}
                  </span>
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-[#8e9cd6]"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="truncate text-base font-semibold text-[#0b1437]">
                    {entry.playerName}
                  </span>
                </div>

                <div className="shrink-0 text-right">
                  <span className="tnum text-xl font-bold text-[#0d2be3]">
                    {entry.correctCount}
                  </span>
                  <span className="ml-1 text-xs font-medium text-[#5c6694]">benar</span>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </aside>
  )
}

export function DisplayPage() {
  const { roomId: rawRoomId = '' } = useParams()
  const navigate = useNavigate()
  const roomId = normalizeRoomCode(rawRoomId)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [deletedMessage, setDeletedMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId || roomId.length < 3) {
      navigate('/', { replace: true })
    }
  }, [navigate, roomId])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useWakeLock(Boolean(roomId))

  const { roomQuery, connectionStatus } = useRoomRealtime<RoomSnapshot>({
    roomId,
    role: 'display',
    enabled: Boolean(roomId && !deletedMessage),
    onRoomDeleted: (message) => {
      setDeletedMessage(message || 'Room telah dihapus oleh Admin.')
    },
  })

  if (!roomId) return null

  if (deletedMessage) {
    return (
      <div className="classmeet-theme flex min-h-screen flex-col items-center justify-center bg-[#ffffff] px-6 text-center text-[#0b1437]">
        <img
          src="/logo-issc.png"
          alt="Logo ISSC"
          className="mb-6 h-20 w-auto object-contain"
        />
        <div className="w-full max-w-md rounded-[10px] border border-[#cbd5f5] bg-[#f3f6ff] p-8 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#c0262d]">
            Room {roomId} Ditutup
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#0b1437]">{deletedMessage}</h1>
          <p className="mt-2 text-sm text-[#434d7e]">
            Silakan buka kode room baru dari panel Host untuk memulai sesi berikutnya.
          </p>
          <button
            type="button"
            onClick={() => navigate('/host')}
            className="mt-6 inline-flex h-10 cursor-pointer items-center justify-center rounded-[8px] bg-[#0d2be3] px-5 text-sm font-bold text-[#ffffff] hover:bg-[#0a21b4]"
          >
            Ke Panel Host
          </button>
        </div>
      </div>
    )
  }

  const snapshot = roomQuery.data
  const session = snapshot?.session
  const activeBuzz = snapshot?.activeBuzz ?? null
  const scoreboard = session?.scoreboard ?? []
  const status = session?.status ?? 'standby'
  const currentQuestion = session?.currentQuestion ?? null
  const joinUrl = `${window.location.origin}/join/${roomId}`

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {
      // Ignore fullscreen denial
    }
  }

  const buzzerStatusPill = (() => {
    if (status === 'finished') {
      return { bg: '#eaf0ff', text: '#2a55d6', label: 'Sesi Selesai' }
    }
    if (activeBuzz) {
      return { bg: '#fbcd3a', text: '#03071e', label: `Menjawab: ${activeBuzz.playerName}` }
    }
    if (session?.questionResolved) {
      return { bg: '#dff8ef', text: '#09704a', label: 'Soal Terjawab' }
    }
    if (session && !session.buzzerGateOpen) {
      return { bg: '#fee8e8', text: '#c0262d', label: 'Buzzer Dikunci' }
    }
    return { bg: '#dff8ef', text: '#09704a', label: 'Buzzer Terbuka' }
  })()

  return (
    <div className="classmeet-theme flex min-h-screen flex-col bg-[#ffffff] text-[#0b1437]">
      {/* Top Bar */}
      <header className="border-b border-[#cbd5f5] bg-[#ffffff] px-6 py-3.5">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <img
              src="/logo-issc.png"
              alt="Logo ISSC"
              className="h-9 w-auto object-contain"
            />
            <div className="flex items-center gap-2 rounded-[8px] border border-[#cbd5f5] bg-[#eaf0ff] px-3.5 py-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2a55d6]">
                Room
              </span>
              <span className="tnum font-mono text-xl font-bold tracking-wider text-[#0d2be3]">
                {roomId}
              </span>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                connectionStatus === 'connected'
                  ? 'bg-[#dcfcfc] text-[#00717a]'
                  : 'bg-[#fee8e8] text-[#c0262d]'
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              {connectionStatus === 'connected' ? 'Terhubung' : 'Menyambung...'}
            </span>

            <span className="tnum inline-flex items-center gap-1.5 rounded-full bg-[#eaf0ff] px-3 py-1 text-xs font-semibold text-[#434d7e]">
              <Users className="h-3.5 w-3.5 text-[#2a55d6]" />
              {snapshot?.participantCount ?? 0} aktif
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {status === 'active' && session && (
              <span className="tnum rounded-full bg-[#eaf0ff] px-3.5 py-1.5 text-sm font-bold text-[#2a55d6]">
                Soal {session.currentQuestionIndex + 1} / {session.totalQuestions}
              </span>
            )}

            <span
              style={{ backgroundColor: buzzerStatusPill.bg, color: buzzerStatusPill.text }}
              className="rounded-full px-3.5 py-1.5 text-sm font-bold"
            >
              {buzzerStatusPill.label}
            </span>

            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[8px] border border-[#8e9cd6] bg-[#ffffff] text-[#2a55d6] transition-colors hover:bg-[#eaf0ff]"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col p-6">
        {/* STATE 1: STANDBY */}
        {status === 'standby' && (
          <div className="grid flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <div className="flex flex-col gap-6 lg:col-span-8">
              <section
                style={{
                  background: 'linear-gradient(167deg, #2a5fe6 14.6%, #0d2be3 85.4%)',
                  boxShadow: '0 8px 32px rgba(13, 43, 227, 0.28)',
                }}
                className="rounded-[10px] px-8 py-12 text-center text-[#ffffff]"
              >
                <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#eaf0ff]">
                  Kuis Cepat-Cepatan • Layar Soal
                </p>
                <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
                  Gabung ke Room Menggunakan Kode
                </h1>
                <div className="tnum mx-auto mt-6 inline-block rounded-[14px] bg-[#ffffff] px-10 py-5 font-mono text-6xl font-bold tracking-[0.18em] text-[#0d2be3] shadow-[0_8px_32px_rgba(13,43,227,0.16)] sm:text-7xl">
                  {roomId}
                </div>
                <p className="mt-6 text-base font-medium text-[#eaf0ff] sm:text-lg">
                  Buka <span className="font-mono font-bold text-[#ffffff] underline">{joinUrl}</span>{' '}
                  di perangkat peserta
                </p>
              </section>

              {activeBuzz && (
                <div className="flex items-center justify-between gap-4 rounded-[10px] border-2 border-[#0d2be3] bg-[#eaf0ff] p-5 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)]">
                  <div className="flex items-center gap-4">
                    <span className="rounded-full bg-[#fbcd3a] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#03071e]">
                      Tes Buzzer
                    </span>
                    <span
                      className="h-6 w-6 rounded-full border-2 border-[#8e9cd6]"
                      style={{ backgroundColor: activeBuzz.color }}
                    />
                    <span className="text-2xl font-bold text-[#0b1437]">
                      {activeBuzz.playerName} menekan tombol!
                    </span>
                  </div>
                </div>
              )}

              <div className="rounded-[10px] border border-[#cbd5f5] bg-[#f3f6ff] p-6 text-center">
                <p className="text-base font-semibold text-[#0b1437]">
                  Menunggu Host memulai sesi 10 soal...
                </p>
                <p className="mt-1 text-sm text-[#434d7e]">
                  Peserta menekan tombol di HP, lalu menyebutkan pilihan A / B / C / D ke Host.
                </p>
              </div>
            </div>

            <div className="lg:col-span-4">
              <ScoreboardPanel
                scoreboard={scoreboard}
                activePlayerName={activeBuzz?.playerName}
              />
            </div>
          </div>
        )}

        {/* STATE 2: ACTIVE QUESTION */}
        {status === 'active' && currentQuestion && session && (
          <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left 8 cols: Buzz Winner Banner + Question + Options A-D */}
            <div className="flex flex-col gap-5 lg:col-span-8">
              {/* Live Buzz / Result Banner */}
              {activeBuzz && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="cm-ring-pulse flex flex-wrap items-center justify-between gap-4 rounded-[10px] border-2 border-[#0d2be3] bg-[#eaf0ff] px-6 py-4 shadow-[0_8px_32px_rgba(13,43,227,0.16)]"
                >
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fbcd3a] px-3.5 py-1.5 text-sm font-bold uppercase tracking-wider text-[#03071e]">
                      <Zap className="h-4 w-4" />
                      Tercepat!
                    </span>
                    <span
                      className="h-8 w-8 shrink-0 rounded-full border-2 border-[#ffffff] shadow-xs"
                      style={{ backgroundColor: activeBuzz.color }}
                    />
                    <div>
                      <p className="text-2xl font-bold leading-tight text-[#0b1437] sm:text-3xl">
                        {activeBuzz.playerName}
                      </p>
                      <p className="text-sm font-medium text-[#434d7e]">
                        {session.lastWrongAttempt
                          ? `Pilihan ${session.lastWrongAttempt.option} belum tepat — menunggu Host reset buzzer`
                          : 'Sebutkan jawaban (A / B / C / D) kepada Host'}
                      </p>
                    </div>
                  </div>

                  {session.lastWrongAttempt && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fee8e8] px-3.5 py-1.5 text-sm font-bold text-[#c0262d]">
                      <XCircle className="h-4 w-4" />
                      Opsi {session.lastWrongAttempt.option} Salah
                    </span>
                  )}
                </div>
              )}

              {!activeBuzz && session.answeredBy && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border-2 border-[#09704a] bg-[#dff8ef] px-6 py-4">
                  <div className="flex items-center gap-3.5">
                    <CheckCircle2 className="h-8 w-8 shrink-0 text-[#09704a]" />
                    <div>
                      <p className="text-xl font-bold text-[#09704a] sm:text-2xl">
                        BENAR! +1 poin untuk {session.answeredBy.playerName}
                      </p>
                      <p className="text-sm font-medium text-[#09704a]/90">
                        Jawaban tepat: Opsi {session.answeredBy.option}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!activeBuzz && !session.answeredBy && session.revealedCorrectOption && (
                <div className="flex items-center gap-3 rounded-[10px] border border-[#8e9cd6] bg-[#eaf0ff] px-6 py-4">
                  <CheckCircle2 className="h-6 w-6 text-[#0d2be3]" />
                  <p className="text-lg font-bold text-[#0d2be3]">
                    Kunci Jawaban: Opsi {session.revealedCorrectOption} —{' '}
                    {currentQuestion.options[session.revealedCorrectOption]}
                  </p>
                </div>
              )}

              {/* Question Card */}
              <section className="flex flex-1 flex-col justify-between rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-6 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)] md:p-8">
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#2a55d6]">
                      {currentQuestion.category ? `${currentQuestion.category} • ` : ''}
                      Sesi {session.sessionNumber} • Soal {session.currentQuestionIndex + 1} dari{' '}
                      {session.totalQuestions}
                    </span>
                  </div>

                  <h1 className="text-2xl font-bold leading-snug text-[#0b1437] sm:text-3xl md:text-4xl">
                    {currentQuestion.prompt}
                  </h1>

                  {currentQuestion.imageUrl && (
                    <div className="mt-5 flex justify-center">
                      <img
                        src={currentQuestion.imageUrl}
                        alt="Ilustrasi soal"
                        className="max-h-60 rounded-[8px] border border-[#cbd5f5] object-contain"
                      />
                    </div>
                  )}
                </div>

                {/* Multiple Choice Grid A-D */}
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {OPTION_KEYS.map((key: OptionKey) => {
                    const isCorrect = session.revealedCorrectOption === key
                    const isEliminated = session.eliminatedOptions.includes(key)

                    const containerStyle = isCorrect
                      ? 'border-[#09704a] bg-[#dff8ef] text-[#09704a]'
                      : isEliminated
                        ? 'border-[#c0262d] bg-[#fee8e8] text-[#c0262d] opacity-80'
                        : 'border-[#8e9cd6] bg-[#f3f6ff] text-[#0b1437]'

                    const tileStyle = isCorrect
                      ? 'bg-[#34d399] text-[#03071e]'
                      : isEliminated
                        ? 'bg-[#f87171] text-[#03071e]'
                        : 'bg-[#2a5fe6] text-[#ffffff]'

                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-4 rounded-[10px] border-2 px-5 py-4 transition-all duration-300 ${containerStyle}`}
                      >
                        <span
                          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-xl font-bold ${tileStyle}`}
                        >
                          {key}
                        </span>
                        <span
                          className={`flex-1 text-lg font-semibold leading-snug sm:text-xl ${
                            isEliminated ? 'line-through' : ''
                          }`}
                        >
                          {currentQuestion.options[key]}
                        </span>
                        {isCorrect && <CheckCircle2 className="h-6 w-6 shrink-0 text-[#09704a]" />}
                        {isEliminated && <XCircle className="h-6 w-6 shrink-0 text-[#c0262d]" />}
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>

            {/* Right 4 cols: Live Scoreboard */}
            <div className="lg:col-span-4">
              <ScoreboardPanel
                scoreboard={scoreboard}
                activePlayerName={activeBuzz?.playerName}
              />
            </div>
          </div>
        )}

        {/* STATE 3: FINISHED / FINAL PODIUM */}
        {status === 'finished' && session && (
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
            <section
              style={{
                background: 'linear-gradient(167deg, #2a5fe6 14.6%, #0d2be3 85.4%)',
                boxShadow: '0 8px 32px rgba(13, 43, 227, 0.28)',
              }}
              className="rounded-[10px] px-8 py-8 text-center text-[#ffffff]"
            >
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#eaf0ff]">
                Sesi {session.sessionNumber} Selesai • {session.totalQuestions} Soal
              </p>
              <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Hasil Akhir &amp; Peringkat</h1>
            </section>

            {/* Top 3 Podium */}
            {scoreboard.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {scoreboard.slice(0, 3).map((entry, idx) => {
                  const rank = idx + 1
                  const badge = rankBadgeStyle(rank)
                  return (
                    <div
                      key={entry.playerName.toLowerCase()}
                      className={`flex flex-col items-center rounded-[10px] border bg-[#ffffff] p-6 text-center shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)] ${
                        rank === 1 ? 'border-2 border-[#0d2be3] sm:-translate-y-1' : 'border-[#cbd5f5]'
                      }`}
                    >
                      <span
                        style={{ backgroundColor: badge.bg, color: badge.text }}
                        className="tnum mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold"
                      >
                        #{rank}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 rounded-full border border-[#8e9cd6]"
                          style={{ backgroundColor: entry.color }}
                        />
                        <h2 className="text-2xl font-bold text-[#0b1437]">{entry.playerName}</h2>
                      </div>
                      <p className="tnum mt-3 text-4xl font-bold text-[#0d2be3]">
                        {entry.correctCount}
                      </p>
                      <p className="text-sm font-medium text-[#434d7e]">
                        soal dijawab benar
                      </p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Full Ranking Table */}
            <section className="rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-6 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)]">
              <h2 className="mb-4 text-xl font-bold text-[#0b1437]">Peringkat Lengkap</h2>
              {scoreboard.length === 0 ? (
                <p className="text-sm text-[#434d7e]">Belum ada peserta pada sesi ini.</p>
              ) : (
                <ol className="space-y-2.5">
                  {scoreboard.map((entry, idx) => {
                    const rank = idx + 1
                    const badge = rankBadgeStyle(rank)
                    return (
                      <li
                        key={entry.playerName.toLowerCase()}
                        className="flex items-center justify-between rounded-[14px] border border-[#cbd5f5] bg-[#f3f6ff] px-4 py-3"
                      >
                        <div className="flex items-center gap-3.5">
                          <span
                            style={{ backgroundColor: badge.bg, color: badge.text }}
                            className="tnum inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-sm font-bold"
                          >
                            {rank}
                          </span>
                          <span
                            className="h-4 w-4 rounded-full border border-[#8e9cd6]"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-lg font-semibold text-[#0b1437]">
                            {entry.playerName}
                          </span>
                        </div>
                        <span className="tnum text-xl font-bold text-[#0d2be3]">
                          {entry.correctCount}{' '}
                          <span className="text-sm font-medium text-[#434d7e]">benar</span>
                        </span>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
