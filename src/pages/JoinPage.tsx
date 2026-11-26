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
    <div className="min-h-screen">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <button
          type="button"
          onClick={() => navigate(`/${preservedQuery}`)}
          className="mb-6 inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/80 hover:text-black"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </button>

        <div className="flex items-center justify-center">
          <div className="flex w-full max-w-md flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm">
            <div className="grid gap-1.5 px-6 text-center">
              <h1 className="text-3xl leading-none font-semibold">
                {isNewRoom ? 'Create Your Profile' : 'Join Room'}
              </h1>
              <p className="text-base text-muted-foreground">
                {isNewRoom ? 'Choose your name and color' : `Room Code: ${normalizedRoomId}`}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 px-6">
              <div className="space-y-2">
                <label htmlFor="player-name" className="text-sm leading-none font-medium">
                  Your Name
                </label>
                <input
                  id="player-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                  placeholder="Enter your name"
                  autoFocus
                  required
                  className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
                />
              </div>

              <div className="space-y-2">
                <span className="block text-sm leading-none font-medium">Choose Your Color</span>
                <div className="mt-1.5 grid grid-cols-4 gap-3" role="radiogroup" aria-label="Choose Your Color">
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
                        className={`h-16 transform cursor-pointer rounded-lg transition-all duration-200 hover:scale-105 ${
                          isSelected
                            ? 'scale-105 ring-4 ring-gray-400 ring-offset-2'
                            : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-2'
                        }`}
                      />
                    )
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={!name.trim()}
                className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isNewRoom ? 'Create Room' : 'Join Room'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
