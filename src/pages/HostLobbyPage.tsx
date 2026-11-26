import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Database, ExternalLink, Monitor, Plus, Radio, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useQuestionBank } from '../hooks/useQuestionBank'
import { normalizeRoomCode } from '../lib/playerStorage'
import type { SessionStatus } from '../types/quiz'

interface ActiveRoomSummary {
  roomId: string
  status: SessionStatus
  sessionNumber: number
  totalQuestions: number
  currentQuestionIndex: number
  participantCount: number
  lastActivityAt: number
}

async function fetchRooms(): Promise<ActiveRoomSummary[]> {
  const res = await fetch('/api/rooms')
  if (!res.ok) throw new Error('Gagal memuat daftar room')
  const data = (await res.json()) as { rooms: ActiveRoomSummary[] }
  return data.rooms ?? []
}

async function createRoomApi(roomId?: string): Promise<{ roomId: string }> {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(roomId ? { roomId } : {}),
  })
  const data = (await res.json().catch(() => ({}))) as { roomId?: string; error?: string }
  if (!res.ok || !data.roomId) {
    throw new Error(data.error || 'Gagal membuat room baru')
  }
  return { roomId: data.roomId }
}

export function HostLobbyPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [customCode, setCustomCode] = useState('')

  const roomsQuery = useQuery({
    queryKey: ['active-rooms'],
    queryFn: fetchRooms,
    refetchInterval: 5000,
  })

  const { bankQuery } = useQuestionBank()
  const bank = bankQuery.data

  const createRoomMutation = useMutation({
    mutationFn: (roomId?: string) => createRoomApi(roomId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['active-rooms'] })
      toast.success(`Room ${data.roomId} siap digunakan!`)
      navigate(`/host/${data.roomId}`)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat room')
    },
  })

  const handleCustomSubmit = (e: FormEvent) => {
    e.preventDefault()
    const normalized = normalizeRoomCode(customCode)
    if (normalized.length < 3) {
      toast.error('Masukkan minimal 3 karakter kode room (maks. 6 karakter)')
      return
    }
    createRoomMutation.mutate(normalized)
  }

  const rooms = roomsQuery.data ?? []

  return (
    <div className="classmeet-theme min-h-screen bg-[#ffffff] text-[#0b1437]">
      {/* Header */}
      <header className="border-b border-[#cbd5f5] bg-[#ffffff] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/logo-issc.png"
              alt="Logo ISSC"
              className="h-9 w-auto object-contain"
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2a55d6]">
                Panel Admin / Host
              </p>
              <h1 className="text-lg font-bold leading-tight text-[#0b1437]">
                Manajemen Room Kuis
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="tnum inline-flex items-center gap-1.5 rounded-full border border-[#cbd5f5] bg-[#f3f6ff] px-3 py-1.5 text-xs font-semibold text-[#434d7e]">
              <Database className="h-3.5 w-3.5 text-[#2a55d6]" />
              Bank Soal: <strong className="text-[#09704a]">{bank?.availableCount ?? 0}</strong> /{' '}
              {bank?.totalCount ?? 0} tersedia
            </span>

            <Link
              to="/"
              className="inline-flex h-9 items-center rounded-[8px] border border-[#8e9cd6] bg-[#ffffff] px-3 text-sm font-semibold text-[#2a55d6] hover:bg-[#eaf0ff]"
            >
              Halaman Peserta
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {/* Hero Create Room Card */}
        <section
          style={{
            background: 'linear-gradient(167deg, #2a5fe6 14.6%, #0d2be3 85.4%)',
            boxShadow: '0 8px 32px rgba(13, 43, 227, 0.28)',
          }}
          className="rounded-[10px] p-6 text-[#ffffff] sm:p-8"
        >
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#eaf0ff]">
                Host &amp; Operator Kuis
              </p>
              <h2 className="mt-1.5 text-2xl font-bold sm:text-3xl">
                Buat Room Kuis Baru Tanpa Ikut Bermain
              </h2>
              <p className="mt-2 text-sm text-[#eaf0ff] sm:text-base">
                Buat room langsung dari sini untuk mendapatkan kode 6 karakter, membuka layar
                proyektor Display Soal, dan mengendalikan buzzer peserta.
              </p>
            </div>

            <button
              type="button"
              onClick={() => createRoomMutation.mutate(undefined)}
              disabled={createRoomMutation.isPending}
              className="inline-flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-[8px] bg-[#ffffff] px-6 text-base font-bold text-[#0d2be3] shadow-[0_8px_32px_rgba(13,43,227,0.16)] transition hover:bg-[#eaf0ff] disabled:opacity-60"
            >
              <Plus className="h-5 w-5" />
              {createRoomMutation.isPending ? 'Membuat Room...' : 'Buat Room Baru'}
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Custom Code / Rejoin Card */}
          <section className="rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-5 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)] lg:col-span-5">
            <h3 className="text-base font-bold text-[#0b1437]">
              Buat dengan Kode Khusus / Masuk Room
            </h3>
            <p className="mt-1 text-sm text-[#434d7e]">
              Ingin kode room yang mudah diingat (mis. <code className="font-mono font-bold text-[#0d2be3]">ISSC01</code>) atau ingin masuk lagi ke room yang sudah ada?
            </p>

            <form onSubmit={handleCustomSubmit} className="mt-4 flex gap-2">
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(normalizeRoomCode(e.target.value))}
                maxLength={6}
                placeholder="Mis. ISSC01"
                aria-label="Kode room khusus"
                className="h-10 flex-1 rounded-[8px] border border-[#8e9cd6] bg-[#f3f6ff] px-3 text-center font-mono text-base font-bold uppercase tracking-widest text-[#0b1437] placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-[#5c6694]"
              />
              <button
                type="submit"
                disabled={createRoomMutation.isPending || customCode.trim().length < 3}
                className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[8px] bg-[#0d2be3] px-4 text-sm font-semibold text-[#ffffff] hover:bg-[#0a21b4] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Buka
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </section>

          {/* Active Rooms List */}
          <section className="rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-5 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)] lg:col-span-7">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-[#00717a]" />
                <h3 className="text-base font-bold text-[#0b1437]">Room Aktif Saat Ini</h3>
              </div>
              <span className="tnum rounded-full bg-[#eaf0ff] px-2.5 py-0.5 text-xs font-semibold text-[#2a55d6]">
                {rooms.length} room
              </span>
            </div>

            {rooms.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-[#cbd5f5] bg-[#f3f6ff] p-6 text-center">
                <p className="text-sm font-semibold text-[#434d7e]">Belum ada room aktif</p>
                <p className="mt-1 text-xs text-[#5c6694]">
                  Klik &ldquo;Buat Room Baru&rdquo; di atas untuk memulai sesi kuis.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {rooms.map((room) => (
                  <li
                    key={room.roomId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#cbd5f5] bg-[#f3f6ff] px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="tnum font-mono text-lg font-bold tracking-wider text-[#0d2be3]">
                        {room.roomId}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          room.status === 'active'
                            ? 'bg-[#dff8ef] text-[#09704a]'
                            : room.status === 'finished'
                              ? 'bg-[#eaf0ff] text-[#2a55d6]'
                              : 'bg-[#ffffff] text-[#434d7e] border border-[#cbd5f5]'
                        }`}
                      >
                        {room.status === 'active'
                          ? `Soal ${room.currentQuestionIndex + 1}/${room.totalQuestions}`
                          : room.status === 'finished'
                            ? 'Sesi Selesai'
                            : 'Standby'}
                      </span>
                      <span className="tnum inline-flex items-center gap-1 text-xs font-medium text-[#434d7e]">
                        <Users className="h-3.5 w-3.5 text-[#2a55d6]" />
                        {room.participantCount} peserta
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`/display/${room.roomId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#8e9cd6] bg-[#ffffff] px-2.5 text-xs font-semibold text-[#2a55d6] hover:bg-[#eaf0ff]"
                      >
                        <Monitor className="h-3.5 w-3.5" />
                        Display
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => navigate(`/host/${room.roomId}`)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[8px] bg-[#0d2be3] px-3 text-xs font-semibold text-[#ffffff] hover:bg-[#0a21b4]"
                      >
                        Kelola Host
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
