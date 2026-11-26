import { ArrowRight, Timer, Users, Zap } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { normalizeRoomCode } from '../lib/playerStorage'

export function HomePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [roomCode, setRoomCode] = useState('')

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : ''

  const handleJoinSubmit = (e: FormEvent) => {
    e.preventDefault()
    const normalized = normalizeRoomCode(roomCode)
    if (normalized.length < 3) {
      toast.error('Masukkan kode room dari panitia (3-6 karakter)')
      return
    }
    navigate(`/join/${normalized}${suffix}`)
  }

  return (
    <div className="classmeet-theme min-h-screen bg-[#ffffff] text-[#0b1437]">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-10 text-center md:py-16">
        {/* ISSC Logo */}
        <img
          src="/logo-issc.png"
          alt="Logo ISSC"
          className="mb-5 h-24 w-auto object-contain sm:h-28"
        />

        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#2a55d6]">
          Buzzer Kuis Cepat-Cepatan
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0b1437] sm:text-5xl">
          Siap Jadi yang Tercepat?
        </h1>
        <p className="mt-3 max-w-xl text-base text-[#434d7e] sm:text-lg">
          Masukkan kode room yang tampil di layar proyektor untuk bergabung ke sesi kuis.
        </p>

        {/* Join Room Card (Participant Only) */}
        <section className="mt-8 w-full max-w-md rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-6 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)]">
          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div className="text-left">
              <label
                htmlFor="home-room-code"
                className="mb-1.5 block text-sm font-semibold text-[#0b1437]"
              >
                Kode Room
              </label>
              <input
                id="home-room-code"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(normalizeRoomCode(e.target.value))}
                maxLength={6}
                placeholder="Masukkan kode 6 karakter"
                aria-label="Kode Room"
                autoComplete="off"
                autoFocus
                className="tnum h-12 w-full rounded-[8px] border border-[#8e9cd6] bg-[#f3f6ff] px-4 text-center font-mono text-2xl font-bold uppercase tracking-[0.2em] text-[#0b1437] placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-[#5c6694]"
              />
            </div>

            <button
              type="submit"
              disabled={roomCode.trim().length < 3}
              className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] bg-[#0d2be3] px-6 text-base font-bold text-[#ffffff] transition-colors hover:bg-[#0a21b4] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Gabung Room
              <ArrowRight className="h-5 w-5" />
            </button>
          </form>
        </section>

        {/* Feature Highlights */}
        <div className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col items-center rounded-[10px] border border-[#cbd5f5] bg-[#f3f6ff] p-5">
            <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#2a5fe6] text-[#ffffff]">
              <Users className="h-6 w-6" />
            </span>
            <h3 className="text-base font-bold text-[#0b1437]">Banyak Peserta</h3>
            <p className="mt-1 text-xs text-[#434d7e]">
              Semua tim bergabung serentak dari perangkat masing-masing
            </p>
          </div>

          <div className="flex flex-col items-center rounded-[10px] border border-[#cbd5f5] bg-[#f3f6ff] p-5">
            <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#2a5fe6] text-[#ffffff]">
              <Zap className="h-6 w-6" />
            </span>
            <h3 className="text-base font-bold text-[#0b1437]">Deteksi Instan</h3>
            <p className="mt-1 text-xs text-[#434d7e]">
              Server mengunci penekan tercepat secara akurat &amp; real-time
            </p>
          </div>

          <div className="flex flex-col items-center rounded-[10px] border border-[#cbd5f5] bg-[#f3f6ff] p-5">
            <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#2a5fe6] text-[#ffffff]">
              <Timer className="h-6 w-6" />
            </span>
            <h3 className="text-base font-bold text-[#0b1437]">Adil &amp; Transparan</h3>
            <p className="mt-1 text-xs text-[#434d7e]">
              Nama penekan pertama &amp; papan skor tampil langsung di layar utama
            </p>
          </div>
        </div>

        {/* How It Works */}
        <section className="mt-10 w-full max-w-2xl rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-6 text-left shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)]">
          <h2 className="mb-4 text-center text-xl font-bold text-[#0b1437]">Cara Bermain</h2>
          <ol className="space-y-3 text-sm text-[#434d7e] sm:text-base">
            <li className="flex items-start gap-3">
              <span className="tnum inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eaf0ff] text-xs font-bold text-[#0d2be3]">
                1
              </span>
              <span>Masukkan kode room yang ditampilkan panitia di layar proyektor</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="tnum inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eaf0ff] text-xs font-bold text-[#0d2be3]">
                2
              </span>
              <span>Isi nama tim/peserta dan pilih warna identitasmu</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="tnum inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eaf0ff] text-xs font-bold text-[#0d2be3]">
                3
              </span>
              <span>Saat soal tampil di layar, tekan tombol PRESS secepat mungkin</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="tnum inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eaf0ff] text-xs font-bold text-[#0d2be3]">
                4
              </span>
              <span>Sebutkan pilihan jawaban (A / B / C / D) kepada Host!</span>
            </li>
          </ol>
        </section>
      </div>
    </div>
  )
}
