import { ArrowLeft } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  generateRoomCode,
  getPlayerProfile,
  normalizeRoomCode,
  savePlayerProfile,
} from '../lib/playerStorage'
import { PLAYER_COLORS } from '../types/quiz'

export function JoinPage() {
  const { roomId: rawRoomId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const isNewRoom = rawRoomId.toLowerCase() === 'new'
  const normalizedRoomId = isNewRoom ? 'new' : normalizeRoomCode(rawRoomId)

  const existing = getPlayerProfile()
  const paramName = searchParams.get('name')?.trim().slice(0, 20) || ''
  const paramColor = searchParams.get('color')?.trim() || ''
  const validParamColor = /^#[0-9A-Fa-f]{6}$/.test(paramColor) ? paramColor : ''

  const [name, setName] = useState(paramName || existing?.name || '')
  const [selectedColor, setSelectedColor] = useState(
    validParamColor || existing?.color || PLAYER_COLORS[0].value,
  )

  const preservedQuery = (() => {
    const next = new URLSearchParams()
    const embed = searchParams.get('embed')
    if (embed) next.set('embed', embed)
    const str = next.toString()
    return str ? `?${str}` : ''
  })()

  useEffect(() => {
    if (!isNewRoom && normalizedRoomId.length < 3) {
      navigate(`/${preservedQuery}`, { replace: true })
      return
    }

    const autojoin = searchParams.get('autojoin')
    if ((autojoin === '1' || autojoin === 'true') && (paramName || existing?.name)) {
      const targetRoom = isNewRoom ? generateRoomCode(6) : normalizedRoomId
      savePlayerProfile({
        name: paramName || existing?.name || 'Player',
        color: validParamColor || existing?.color || PLAYER_COLORS[0].value,
      })
      navigate(`/room/${targetRoom}${preservedQuery}`, { replace: true })
    }
  }, [
    existing?.color,
    existing?.name,
    isNewRoom,
    navigate,
    normalizedRoomId,
    paramName,
    preservedQuery,
    searchParams,
    validParamColor,
  ])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    const targetRoom = isNewRoom ? generateRoomCode(6) : normalizedRoomId
    savePlayerProfile({
      name: trimmed,
      color: selectedColor,
    })
    navigate(`/room/${targetRoom}${preservedQuery}`)
  }

  return (
    <div className="classmeet-theme min-h-screen bg-[#ffffff] text-[#0b1437]">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(`/${preservedQuery}`)}
            className="inline-flex h-9 cursor-pointer items-center justify-center rounded-[8px] border border-[#8e9cd6] bg-[#ffffff] px-3.5 text-sm font-semibold text-[#2a55d6] transition-colors hover:bg-[#eaf0ff]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </button>

          <img
            src="/logo-issc.png"
            alt="Logo ISSC"
            className="h-9 w-auto object-contain"
          />
        </div>

        <div className="flex items-center justify-center">
          <div className="flex w-full max-w-md flex-col gap-6 rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] py-6 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)]">
            <div className="grid gap-1.5 px-6 text-center">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#2a55d6]">
                {isNewRoom ? 'Profil Peserta' : `Kode Room: ${normalizedRoomId}`}
              </p>
              <h1 className="text-3xl leading-none font-bold text-[#0b1437]">
                {isNewRoom ? 'Buat Profil' : 'Gabung Room'}
              </h1>
              <p className="text-sm text-[#434d7e]">
                Masukkan nama tim atau nama peserta lalu pilih warna
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 px-6">
              <div className="space-y-2">
                <label htmlFor="player-name" className="text-sm leading-none font-semibold text-[#0b1437]">
                  Nama Peserta / Tim
                </label>
                <input
                  id="player-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                  placeholder="Contoh: Tim Alpha"
                  autoFocus
                  required
                  className="mt-1.5 flex h-10 w-full rounded-[8px] border border-[#8e9cd6] bg-[#f3f6ff] px-3 py-1 text-base text-[#0b1437] placeholder:text-[#5c6694] md:text-sm"
                />
              </div>

              <div className="space-y-2">
                <span className="block text-sm leading-none font-semibold text-[#0b1437]">
                  Pilih Warna
                </span>
                <div className="mt-1.5 grid grid-cols-4 gap-3" role="radiogroup" aria-label="Pilih Warna">
                  {PLAYER_COLORS.map((color) => {
                    const isSelected = selectedColor.toLowerCase() === color.value.toLowerCase()
                    return (
                      <button
                        key={color.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={color.name}
                        title={color.name}
                        onClick={() => setSelectedColor(color.value)}
                        style={{ backgroundColor: color.value }}
                        className={`h-14 transform cursor-pointer rounded-[8px] transition-all duration-200 hover:scale-105 ${
                          isSelected
                            ? 'scale-105 ring-4 ring-[#0d2be3] ring-offset-2'
                            : 'hover:ring-2 hover:ring-[#8e9cd6] hover:ring-offset-2'
                        }`}
                      />
                    )
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={!name.trim()}
                className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-[8px] bg-[#0d2be3] px-6 text-sm font-bold text-[#ffffff] transition-colors hover:bg-[#0a21b4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isNewRoom ? 'Masuk Room' : 'Gabung Room'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
