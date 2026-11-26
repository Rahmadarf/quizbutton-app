import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Flag,
  Lock,
  Minus,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
  Unlock,
  Upload,
  XCircle,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useQuestionBank } from '../hooks/useQuestionBank'
import { useRoomRealtime } from '../hooks/useRoomRealtime'
import {
  downloadCsvTemplate,
  parseQuestionsCsv,
  type CsvParseResult,
} from '../lib/csvQuestions'
import { normalizeRoomCode } from '../lib/playerStorage'
import {
  OPTION_KEYS,
  type BankQuestion,
  type HostRoomSnapshot,
  type OptionKey,
  type QuestionInput,
} from '../types/quiz'

const EMPTY_FORM: QuestionInput = {
  category: '',
  prompt: '',
  options: { A: '', B: '', C: '', D: '' },
  correctOption: 'A',
  imageUrl: '',
}

const IMPORT_PLACEHOLDER = `[
  {
    "category": "Sains",
    "prompt": "Planet terbesar di Tata Surya adalah?",
    "options": { "A": "Bumi", "B": "Mars", "C": "Jupiter", "D": "Saturnus" },
    "correctOption": "C"
  }
]`

export function HostPage() {
  const { roomId: rawRoomId = '' } = useParams()
  const navigate = useNavigate()
  const roomId = normalizeRoomCode(rawRoomId)

  const [activeTab, setActiveTab] = useState<'control' | 'bank'>('control')
  const [form, setForm] = useState<QuestionInput>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<'csv' | 'json'>('csv')
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [csvPreview, setCsvPreview] = useState<CsvParseResult | null>(null)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [isDraggingCsv, setIsDraggingCsv] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [importText, setImportText] = useState('')
  const [confirmResetUsed, setConfirmResetUsed] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')

  useEffect(() => {
    if (!roomId || roomId.length < 3) {
      navigate('/', { replace: true })
    }
  }, [navigate, roomId])

  const { roomQuery, connectionStatus, hostActions } = useRoomRealtime<HostRoomSnapshot>({
    roomId,
    role: 'host',
    enabled: Boolean(roomId),
  })

  const {
    bankQuery,
    createQuestionMutation,
    updateQuestionMutation,
    deleteQuestionMutation,
    importQuestionsMutation,
    seedSampleMutation,
    resetUsedMutation,
  } = useQuestionBank()

  const snapshot = roomQuery.data
  const session = snapshot?.session
  const activeBuzz = snapshot?.activeBuzz ?? null
  const bank = bankQuery.data

  // Keyboard shortcut: 'R' to reset buzzer when not typing in an input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key.toLowerCase() === 'r' && activeBuzz) {
        e.preventDefault()
        hostActions.resetBuzzMutation.mutate(undefined, {
          onSuccess: () => toast.success('Buzzer direset! Peserta dapat menekan tombol lagi.'),
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeBuzz, hostActions.resetBuzzMutation])

  if (!roomId) return null

  const joinUrl = `${window.location.origin}/join/${roomId}`
  const displayUrl = `/display/${roomId}`

  const handleCopyJoin = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl)
      toast.success('Link peserta disalin!')
    } catch {
      toast.error('Gagal menyalin link')
    }
  }

  const handleStartSession = () => {
    hostActions.startSessionMutation.mutate(
      { count: 10, shuffle: true, resetScores: true },
      {
        onSuccess: (res) => {
          toast.success(
            `Sesi ${res.snapshot.session.sessionNumber} dimulai (${res.snapshot.session.totalQuestions} soal baru)!`,
          )
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Gagal memulai sesi')
        },
      },
    )
  }

  const handleSelectAnswer = (option: OptionKey) => {
    if (!activeBuzz) {
      toast.info('Tunggu peserta menekan tombol buzzer dulu.')
      return
    }
    hostActions.submitAnswerMutation.mutate(option, {
      onSuccess: (res) => {
        if (res.correct) {
          toast.success(`BENAR! +1 poin untuk ${activeBuzz.playerName}`)
        } else {
          toast.error(
            `Opsi ${option} SALAH! Klik "Reset Buzzer" untuk lempar ke peserta lain.`,
          )
        }
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Gagal memproses jawaban')
      },
    })
  }

  const handleSaveQuestion = (e: FormEvent) => {
    e.preventDefault()
    if (editingId) {
      updateQuestionMutation.mutate(
        { id: editingId, input: form },
        {
          onSuccess: () => {
            toast.success('Soal berhasil diperbarui')
            setEditingId(null)
            setForm(EMPTY_FORM)
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : 'Gagal update'),
        },
      )
    } else {
      createQuestionMutation.mutate(form, {
        onSuccess: () => {
          toast.success('Soal ditambahkan ke Bank Soal')
          setForm(EMPTY_FORM)
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Gagal menambah soal'),
      })
    }
  }

  const handleEditClick = (q: BankQuestion) => {
    setEditingId(q.id)
    setForm({
      category: q.category || '',
      prompt: q.prompt,
      options: { ...q.options },
      correctOption: q.correctOption,
      imageUrl: q.imageUrl || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleReadCsvFile = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = parseQuestionsCsv(text)
      setCsvFileName(file.name)
      setCsvPreview(parsed)
      if (parsed.questions.length === 0 && parsed.errors.length > 0) {
        toast.error(parsed.errors[0].message)
      }
    } catch {
      toast.error('Gagal membaca file CSV')
    }
  }

  const handleCsvInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void handleReadCsvFile(file)
    }
    e.target.value = ''
  }

  const handleCsvDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingCsv(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      void handleReadCsvFile(file)
    }
  }

  const handleConfirmCsvImport = () => {
    if (!csvPreview || csvPreview.questions.length === 0) return
    importQuestionsMutation.mutate(
      { questions: csvPreview.questions, skipDuplicates },
      {
        onSuccess: (res) => {
          const dupNote = res.duplicates > 0 ? `, duplikat dilewati: ${res.duplicates}` : ''
          const skipNote = res.skipped > 0 ? `, tidak valid: ${res.skipped}` : ''
          toast.success(`Berhasil import ${res.added} soal dari CSV${dupNote}${skipNote}`)
          setCsvFileName(null)
          setCsvPreview(null)
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Import CSV gagal'),
      },
    )
  }

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(importText) as unknown
      const list = Array.isArray(parsed) ? (parsed as QuestionInput[]) : null
      if (!list) {
        toast.error('JSON harus berupa array [...] soal')
        return
      }
      importQuestionsMutation.mutate(
        { questions: list, skipDuplicates },
        {
          onSuccess: (res) => {
            const dupNote = res.duplicates > 0 ? `, duplikat: ${res.duplicates}` : ''
            toast.success(`Berhasil import ${res.added} soal (dilewati: ${res.skipped}${dupNote})`)
            setImportText('')
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : 'Import gagal'),
        },
      )
    } catch {
      toast.error('Format JSON tidak valid')
    }
  }

  const handleAddManualPlayer = (e: FormEvent) => {
    e.preventDefault()
    const name = newPlayerName.trim()
    if (!name) return
    hostActions.adjustScoreMutation.mutate(
      { playerName: name, delta: 0, color: '#2a5fe6' },
      {
        onSuccess: () => {
          setNewPlayerName('')
          toast.success(`${name} ditambahkan ke papan skor`)
        },
      },
    )
  }

  const currentQuestion = session?.currentQuestion ?? null
  const isLastQuestion =
    session && session.status === 'active'
      ? session.currentQuestionIndex + 1 >= session.totalQuestions
      : false

  return (
    <div className="classmeet-theme min-h-screen bg-[#ffffff] text-[#0b1437]">
      {/* Header */}
      <header className="border-b border-[#cbd5f5] bg-[#ffffff] px-4 py-3.5 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <img
              src="/logo-issc.png"
              alt="Logo ISSC"
              className="h-8 w-auto object-contain"
            />
            <button
              type="button"
              onClick={() => navigate('/host')}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[8px] border border-[#8e9cd6] bg-[#ffffff] px-3 text-sm font-semibold text-[#2a55d6] hover:bg-[#eaf0ff]"
            >
              <ArrowLeft className="h-4 w-4" />
              Daftar Room
            </button>

            <div className="flex items-center gap-2 rounded-[8px] border border-[#cbd5f5] bg-[#eaf0ff] px-3 py-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#2a55d6]">
                Host Room
              </span>
              <span className="tnum font-mono text-lg font-bold text-[#0d2be3]">{roomId}</span>
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
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="tnum rounded-full bg-[#f3f6ff] px-3 py-1.5 text-xs font-semibold text-[#434d7e] border border-[#cbd5f5]">
              Bank Soal: <strong className="text-[#09704a]">{bank?.availableCount ?? 0}</strong> /{' '}
              {bank?.totalCount ?? 0} belum dipakai
            </span>

            <button
              type="button"
              onClick={handleCopyJoin}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[8px] border border-[#8e9cd6] bg-[#ffffff] px-3 text-sm font-semibold text-[#2a55d6] hover:bg-[#eaf0ff]"
            >
              <Copy className="h-4 w-4" />
              Link Peserta
            </button>

            <a
              href={displayUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#0d2be3] px-3.5 text-sm font-semibold text-[#ffffff] transition-colors hover:bg-[#0a21b4]"
            >
              <ExternalLink className="h-4 w-4" />
              Buka Layar Display
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Tabs */}
        <div className="mb-6 inline-flex rounded-[16px] bg-[#eaf0ff] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('control')}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-[12px] px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'control'
                ? 'bg-[#ffffff] text-[#0d2be3] shadow-xs'
                : 'text-[#434d7e] hover:text-[#0b1437]'
            }`}
          >
            <Zap className="h-4 w-4" />
            Kontrol Sesi &amp; Buzzer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-[12px] px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'bank'
                ? 'bg-[#ffffff] text-[#0d2be3] shadow-xs'
                : 'text-[#434d7e] hover:text-[#0b1437]'
            }`}
          >
            <Database className="h-4 w-4" />
            Bank Soal ({bank?.totalCount ?? 0})
          </button>
        </div>

        {/* TAB 1: SESSION & BUZZER CONTROL */}
        {activeTab === 'control' && (
          <div className="space-y-6">
            {/* Session Controls Toolbar */}
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-4 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)]">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleStartSession}
                  disabled={hostActions.startSessionMutation.isPending}
                  className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[8px] bg-[#0d2be3] px-4 text-sm font-semibold text-[#ffffff] transition-colors hover:bg-[#0a21b4] disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                  Mulai Sesi Baru (10 Soal)
                </button>

                {session?.status === 'active' && (
                  <>
                    <button
                      type="button"
                      onClick={() => hostActions.nextQuestionMutation.mutate()}
                      disabled={hostActions.nextQuestionMutation.isPending}
                      className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-[8px] px-4 text-sm font-semibold transition-colors ${
                        session.questionResolved
                          ? 'bg-[#0d2be3] text-[#ffffff] hover:bg-[#0a21b4]'
                          : 'border-2 border-[#2a55d6] bg-[#ffffff] text-[#2a55d6] hover:bg-[#eaf0ff]'
                      }`}
                    >
                      {isLastQuestion ? (
                        <>
                          <Flag className="h-4 w-4" />
                          Tampilkan Skor Akhir
                        </>
                      ) : (
                        <>
                          Soal Berikutnya
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>

                    {!session.questionResolved && (
                      <button
                        type="button"
                        onClick={() => hostActions.revealAnswerMutation.mutate()}
                        className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[8px] border border-[#8e9cd6] bg-[#f3f6ff] px-3.5 text-sm font-semibold text-[#434d7e] hover:bg-[#eaf0ff]"
                      >
                        <Eye className="h-4 w-4" />
                        Buka Kunci
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => hostActions.finishSessionMutation.mutate()}
                      className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[8px] border border-[#c0262d] bg-[#ffffff] px-3.5 text-sm font-semibold text-[#c0262d] hover:bg-[#fee8e8]"
                    >
                      <Flag className="h-4 w-4" />
                      Akhiri Sesi
                    </button>
                  </>
                )}

                {session?.status === 'finished' && (
                  <button
                    type="button"
                    onClick={() => hostActions.standbySessionMutation.mutate()}
                    className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[8px] border border-[#8e9cd6] bg-[#ffffff] px-3.5 text-sm font-semibold text-[#2a55d6] hover:bg-[#eaf0ff]"
                  >
                    Kembali ke Standby
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    hostActions.setGateMutation.mutate(!(session?.buzzerGateOpen ?? true))
                  }
                  className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[8px] border px-3.5 text-sm font-semibold ${
                    session?.buzzerGateOpen === false
                      ? 'border-[#c0262d] bg-[#fee8e8] text-[#c0262d]'
                      : 'border-[#09704a] bg-[#dff8ef] text-[#09704a]'
                  }`}
                >
                  {session?.buzzerGateOpen === false ? (
                    <>
                      <Lock className="h-4 w-4" />
                      Buzzer Dikunci (Klik Buka)
                    </>
                  ) : (
                    <>
                      <Unlock className="h-4 w-4" />
                      Buzzer Terbuka
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    hostActions.resetBuzzMutation.mutate(undefined, {
                      onSuccess: () => toast.success('Buzzer direset!'),
                    })
                  }
                  disabled={!activeBuzz}
                  className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[8px] px-4 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                    activeBuzz
                      ? 'bg-[#fa9f1f] text-[#03071e] hover:bg-[#fbcd3a] cm-ring-pulse'
                      : 'border border-[#8e9cd6] bg-[#f3f6ff] text-[#5c6694]'
                  }`}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset Buzzer (R)
                </button>
              </div>
            </section>

            {/* Quick notice if bank is empty */}
            {(bank?.totalCount ?? 0) === 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-[#fa9f1f] bg-[#fbcd3a]/25 p-4">
                <div>
                  <p className="font-bold text-[#0b1437]">Bank Soal masih kosong</p>
                  <p className="text-sm text-[#434d7e]">
                    Muat 20 soal contoh siap pakai atau tambahkan soal milikmu di tab Bank Soal.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      seedSampleMutation.mutate(undefined, {
                        onSuccess: (res) =>
                          toast.success(`${res.added} soal contoh berhasil dimuat!`),
                      })
                    }
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[8px] bg-[#0d2be3] px-3.5 text-sm font-semibold text-[#ffffff] hover:bg-[#0a21b4]"
                  >
                    <Sparkles className="h-4 w-4" />
                    Muat 20 Soal Contoh
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('bank')}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[8px] border border-[#2a55d6] bg-[#ffffff] px-3.5 text-sm font-semibold text-[#2a55d6] hover:bg-[#eaf0ff]"
                  >
                    Kelola Bank Soal
                  </button>
                </div>
              </div>
            )}

            {/* Main 2-column Workspace */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left 7 cols: Active Buzz + Question & Answer Buttons A-D */}
              <div className="space-y-5 lg:col-span-7">
                {/* Active Buzzer Card */}
                <section className="rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-5 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)]">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#2a55d6]">
                      Penekan Buzzer Tercepat
                    </span>
                    <span className="text-xs font-medium text-[#5c6694]">
                      Mode: Tahan sampai Host Reset
                    </span>
                  </div>

                  {activeBuzz ? (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border-2 border-[#0d2be3] bg-[#eaf0ff] p-4">
                      <div className="flex items-center gap-3.5">
                        <span className="rounded-full bg-[#fbcd3a] px-3 py-1 text-xs font-bold uppercase text-[#03071e]">
                          Tercepat
                        </span>
                        <span
                          className="h-7 w-7 rounded-full border-2 border-[#ffffff]"
                          style={{ backgroundColor: activeBuzz.color }}
                        />
                        <div>
                          <p className="text-2xl font-bold text-[#0b1437]">
                            {activeBuzz.playerName}
                          </p>
                          <p className="tnum text-xs text-[#434d7e]">
                            Menekan pukul{' '}
                            {new Date(activeBuzz.serverTimestamp).toLocaleTimeString('id-ID')}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          hostActions.resetBuzzMutation.mutate(undefined, {
                            onSuccess: () => toast.success('Buzzer direset!'),
                          })
                        }
                        className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[8px] bg-[#fa9f1f] px-4 text-sm font-bold text-[#03071e] hover:bg-[#fbcd3a]"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset Buzzer
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-[8px] border border-dashed border-[#8e9cd6] bg-[#f3f6ff] p-4 text-sm text-[#434d7e]">
                      Belum ada peserta yang menekan tombol. Saat peserta menekan tombol di HP,
                      namanya langsung muncul di sini dan di layar Display.
                    </div>
                  )}

                  {session?.lastWrongAttempt && activeBuzz && (
                    <div className="mt-3 flex items-center gap-2 rounded-[8px] bg-[#fee8e8] px-3.5 py-2.5 text-sm font-semibold text-[#c0262d]">
                      <XCircle className="h-4 w-4 shrink-0" />
                      Pilihan {session.lastWrongAttempt.option} oleh{' '}
                      {session.lastWrongAttempt.playerName} SALAH. Klik &ldquo;Reset Buzzer&rdquo;
                      untuk lempar ke peserta lain.
                    </div>
                  )}
                </section>

                {/* Active Question + Host Choice Buttons A-D */}
                <section className="rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-5 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)]">
                  {session?.status === 'active' && currentQuestion ? (
                    <>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#2a55d6]">
                          {currentQuestion.category ? `${currentQuestion.category} • ` : ''}
                          Soal {session.currentQuestionIndex + 1} / {session.totalQuestions}
                        </span>
                        {session.currentCorrectOption && (
                          <span className="rounded-full bg-[#dff8ef] px-3 py-1 text-xs font-bold text-[#09704a]">
                            Kunci Host: {session.currentCorrectOption}
                          </span>
                        )}
                      </div>

                      <h2 className="text-xl font-bold leading-snug text-[#0b1437]">
                        {currentQuestion.prompt}
                      </h2>

                      <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#5c6694]">
                        Klik pilihan sesuai jawaban lisan peserta:
                      </p>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {OPTION_KEYS.map((key) => {
                          const isKeyAnswer = session.currentCorrectOption === key
                          const isRevealedCorrect = session.revealedCorrectOption === key
                          const isEliminated = session.eliminatedOptions.includes(key)
                          const disabled =
                            session.questionResolved ||
                            isEliminated ||
                            hostActions.submitAnswerMutation.isPending

                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleSelectAnswer(key)}
                              disabled={disabled}
                              className={`flex cursor-pointer items-center gap-3 rounded-[10px] border-2 px-4 py-3.5 text-left transition-all disabled:cursor-not-allowed ${
                                isRevealedCorrect
                                  ? 'border-[#09704a] bg-[#dff8ef] text-[#09704a]'
                                  : isEliminated
                                    ? 'border-[#c0262d] bg-[#fee8e8] text-[#c0262d] opacity-75'
                                    : activeBuzz
                                      ? 'border-[#8e9cd6] bg-[#f3f6ff] text-[#0b1437] hover:border-[#0d2be3] hover:bg-[#eaf0ff]'
                                      : 'border-[#cbd5f5] bg-[#f3f6ff] text-[#434d7e] opacity-75'
                              }`}
                            >
                              <span
                                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-base font-bold ${
                                  isRevealedCorrect
                                    ? 'bg-[#34d399] text-[#03071e]'
                                    : isEliminated
                                      ? 'bg-[#f87171] text-[#03071e]'
                                      : 'bg-[#2a5fe6] text-[#ffffff]'
                                }`}
                              >
                                {key}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div
                                  className={`font-semibold leading-snug ${
                                    isEliminated ? 'line-through' : ''
                                  }`}
                                >
                                  {currentQuestion.options[key]}
                                </div>
                                {isKeyAnswer && (
                                  <span className="mt-0.5 inline-block text-[11px] font-bold text-[#09704a]">
                                    • Kunci Jawaban
                                  </span>
                                )}
                              </div>
                              {isRevealedCorrect && (
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#09704a]" />
                              )}
                              {isEliminated && (
                                <XCircle className="h-5 w-5 shrink-0 text-[#c0262d]" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <BookOpen className="mx-auto mb-2 h-9 w-9 text-[#5c6694]" />
                      <p className="font-semibold text-[#0b1437]">
                        {session?.status === 'finished'
                          ? 'Sesi selesai! Skor akhir sedang tampil di layar Display.'
                          : 'Belum ada soal yang ditayangkan.'}
                      </p>
                      <p className="mt-1 text-sm text-[#434d7e]">
                        Klik &ldquo;Mulai Sesi Baru (10 Soal)&rdquo; untuk mengambil 10 soal baru
                        yang belum pernah tampil sebelumnya.
                      </p>
                    </div>
                  )}
                </section>
              </div>

              {/* Right 5 cols: Scoreboard + Manual Score Adjustment */}
              <div className="space-y-5 lg:col-span-5">
                <section className="rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-5 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)]">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-[#0d2be3]" />
                      <h2 className="text-lg font-bold text-[#0b1437]">Papan Skor Live</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        hostActions.resetScoresMutation.mutate(undefined, {
                          onSuccess: () => toast.success('Skor direset ke 0'),
                        })
                      }
                      className="cursor-pointer text-xs font-semibold text-[#c0262d] hover:underline"
                    >
                      Reset Skor
                    </button>
                  </div>

                  {!session?.scoreboard.length ? (
                    <p className="rounded-[8px] border border-dashed border-[#cbd5f5] bg-[#f3f6ff] p-4 text-center text-sm text-[#434d7e]">
                      Peserta otomatis muncul di sini saat masuk room atau menekan buzzer.
                    </p>
                  ) : (
                    <ol className="space-y-2">
                      {session.scoreboard.map((entry, idx) => (
                        <li
                          key={entry.playerName.toLowerCase()}
                          className="flex items-center justify-between gap-2 rounded-[14px] border border-[#cbd5f5] bg-[#f3f6ff] px-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="tnum inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#d6e0ff] text-xs font-bold text-[#0b1437]">
                              {idx + 1}
                            </span>
                            <span
                              className="h-3.5 w-3.5 shrink-0 rounded-full border border-[#8e9cd6]"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="truncate font-semibold text-[#0b1437]">
                              {entry.playerName}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              aria-label={`Kurangi skor ${entry.playerName}`}
                              onClick={() =>
                                hostActions.adjustScoreMutation.mutate({
                                  playerName: entry.playerName,
                                  delta: -1,
                                })
                              }
                              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[8px] border border-[#8e9cd6] bg-[#ffffff] text-[#434d7e] hover:bg-[#eaf0ff]"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="tnum w-8 text-center text-base font-bold text-[#0d2be3]">
                              {entry.correctCount}
                            </span>
                            <button
                              type="button"
                              aria-label={`Tambah skor ${entry.playerName}`}
                              onClick={() =>
                                hostActions.adjustScoreMutation.mutate({
                                  playerName: entry.playerName,
                                  delta: 1,
                                })
                              }
                              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[8px] border border-[#8e9cd6] bg-[#ffffff] text-[#2a55d6] hover:bg-[#eaf0ff]"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}

                  <form onSubmit={handleAddManualPlayer} className="mt-4 flex gap-2">
                    <input
                      type="text"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      maxLength={20}
                      placeholder="Tambah nama tim/peserta manual..."
                      className="h-9 flex-1 rounded-[8px] border border-[#8e9cd6] bg-[#f3f6ff] px-3 text-sm text-[#0b1437] placeholder:text-[#5c6694]"
                    />
                    <button
                      type="submit"
                      className="h-9 cursor-pointer rounded-[8px] border border-[#2a55d6] bg-[#ffffff] px-3 text-sm font-semibold text-[#2a55d6] hover:bg-[#eaf0ff]"
                    >
                      Tambah
                    </button>
                  </form>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PERSISTENT QUESTION BANK */}
        {activeTab === 'bank' && (
          <div className="space-y-6">
            {/* Bank Stats & Actions */}
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-4 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)]">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="tnum rounded-full bg-[#eaf0ff] px-3 py-1 font-semibold text-[#0b1437]">
                  Total: {bank?.totalCount ?? 0} soal
                </span>
                <span className="tnum rounded-full bg-[#dff8ef] px-3 py-1 font-semibold text-[#09704a]">
                  Belum Dipakai: {bank?.availableCount ?? 0}
                </span>
                <span className="tnum rounded-full bg-[#f3f6ff] px-3 py-1 font-semibold text-[#5c6694]">
                  Sudah Tampil: {bank?.usedCount ?? 0}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    seedSampleMutation.mutate(undefined, {
                      onSuccess: (res) =>
                        toast.success(
                          res.added > 0
                            ? `${res.added} soal contoh berhasil ditambahkan!`
                            : 'Semua soal contoh sudah ada di bank.',
                        ),
                    })
                  }
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[8px] border border-[#2a55d6] bg-[#ffffff] px-3 text-sm font-semibold text-[#2a55d6] hover:bg-[#eaf0ff]"
                >
                  <Sparkles className="h-4 w-4" />
                  Muat 20 Soal Contoh
                </button>

                {!confirmResetUsed ? (
                  <button
                    type="button"
                    onClick={() => setConfirmResetUsed(true)}
                    disabled={(bank?.usedCount ?? 0) === 0}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[8px] border border-[#c0262d] bg-[#ffffff] px-3 text-sm font-semibold text-[#c0262d] hover:bg-[#fee8e8] disabled:opacity-45"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset Riwayat Terpakai
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        resetUsedMutation.mutate(undefined, {
                          onSuccess: () => {
                            setConfirmResetUsed(false)
                            toast.success('Semua soal kembali tersedia untuk sesi berikutnya!')
                          },
                        })
                      }
                      className="h-9 cursor-pointer rounded-[8px] bg-[#c0262d] px-3 text-sm font-semibold text-[#ffffff]"
                    >
                      Ya, Reset Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmResetUsed(false)}
                      className="h-9 cursor-pointer rounded-[8px] border border-[#8e9cd6] bg-[#ffffff] px-3 text-sm font-semibold text-[#434d7e]"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left 5 cols: CSV/JSON Import + Add/Edit Form */}
              <div className="space-y-6 lg:col-span-5">
                {/* Bulk CSV / JSON Import */}
                <section className="space-y-4 rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-5 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-[#0d2be3]" />
                      <h2 className="text-lg font-bold text-[#0b1437]">Import Soal Otomatis</h2>
                    </div>

                    <div className="inline-flex rounded-[12px] bg-[#eaf0ff] p-0.5 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setImportMode('csv')}
                        className={`cursor-pointer rounded-[10px] px-2.5 py-1 transition-all ${
                          importMode === 'csv'
                            ? 'bg-[#ffffff] text-[#0d2be3] shadow-xs'
                            : 'text-[#434d7e]'
                        }`}
                      >
                        CSV (Excel/Sheets)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode('json')}
                        className={`cursor-pointer rounded-[10px] px-2.5 py-1 transition-all ${
                          importMode === 'json'
                            ? 'bg-[#ffffff] text-[#0d2be3] shadow-xs'
                            : 'text-[#434d7e]'
                        }`}
                      >
                        JSON
                      </button>
                    </div>
                  </div>

                  {importMode === 'csv' ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] bg-[#f3f6ff] px-3 py-2 text-xs text-[#434d7e] border border-[#cbd5f5]">
                        <span>
                          Kolom: <code className="font-mono font-semibold text-[#0b1437]">kategori,pertanyaan,A,B,C,D,kunci,gambar</code>
                        </span>
                        <button
                          type="button"
                          onClick={downloadCsvTemplate}
                          className="inline-flex cursor-pointer items-center gap-1 font-semibold text-[#0d2be3] hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Template CSV
                        </button>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleCsvInputChange}
                        className="hidden"
                      />

                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            fileInputRef.current?.click()
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setIsDraggingCsv(true)
                        }}
                        onDragLeave={() => setIsDraggingCsv(false)}
                        onDrop={handleCsvDrop}
                        className={`flex cursor-pointer flex-col items-center justify-center rounded-[10px] border-2 border-dashed px-4 py-6 text-center transition-colors ${
                          isDraggingCsv
                            ? 'border-[#0d2be3] bg-[#eaf0ff]'
                            : 'border-[#8e9cd6] bg-[#f3f6ff] hover:bg-[#eaf0ff]'
                        }`}
                      >
                        <Upload className="mb-2 h-6 w-6 text-[#2a55d6]" />
                        <p className="text-sm font-semibold text-[#0b1437]">
                          {csvFileName ? csvFileName : 'Klik atau seret file .csv ke sini'}
                        </p>
                        <p className="mt-0.5 text-xs text-[#5c6694]">
                          Otomatis mendeteksi pemisah koma (,) maupun titik koma (;) dari Excel
                        </p>
                      </div>

                      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#434d7e]">
                        <input
                          type="checkbox"
                          checked={skipDuplicates}
                          onChange={(e) => setSkipDuplicates(e.target.checked)}
                          className="h-4 w-4 accent-[#0d2be3]"
                        />
                        Lewati soal duplikat (jika pertanyaan sudah ada di Bank Soal)
                      </label>

                      {csvPreview && (
                        <div className="space-y-2.5 rounded-[8px] border border-[#cbd5f5] bg-[#f3f6ff] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-[#0b1437]">
                              Hasil baca ({csvPreview.delimiter === ';' ? 'pemisah ;' : 'pemisah ,'}):
                            </span>
                            <div className="flex gap-2">
                              <span className="tnum rounded-full bg-[#dff8ef] px-2.5 py-0.5 font-bold text-[#09704a]">
                                {csvPreview.questions.length} valid
                              </span>
                              {csvPreview.errors.length > 0 && (
                                <span className="tnum rounded-full bg-[#fee8e8] px-2.5 py-0.5 font-bold text-[#c0262d]">
                                  {csvPreview.errors.length} error
                                </span>
                              )}
                            </div>
                          </div>

                          {csvPreview.errors.length > 0 && (
                            <ul className="max-h-28 space-y-1 overflow-y-auto rounded-[6px] bg-[#fee8e8] p-2 text-xs text-[#c0262d]">
                              {csvPreview.errors.slice(0, 10).map((err, idx) => (
                                <li key={`${err.row}-${idx}`}>
                                  <strong>Baris {err.row}:</strong> {err.message}
                                </li>
                              ))}
                              {csvPreview.errors.length > 10 && (
                                <li>...dan {csvPreview.errors.length - 10} baris error lainnya</li>
                              )}
                            </ul>
                          )}

                          {csvPreview.questions.length > 0 && (
                            <div className="max-h-32 space-y-1 overflow-y-auto rounded-[6px] border border-[#cbd5f5] bg-[#ffffff] p-2 text-xs text-[#434d7e]">
                              {csvPreview.questions.slice(0, 5).map((q, idx) => (
                                <div key={idx} className="truncate">
                                  <strong className="text-[#0b1437]">{idx + 1}.</strong> {q.prompt}{' '}
                                  <span className="font-bold text-[#09704a]">
                                    (Kunci: {q.correctOption})
                                  </span>
                                </div>
                              ))}
                              {csvPreview.questions.length > 5 && (
                                <div className="text-[#5c6694]">
                                  ...+{csvPreview.questions.length - 5} soal lainnya siap di-import
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleConfirmCsvImport}
                              disabled={
                                csvPreview.questions.length === 0 ||
                                importQuestionsMutation.isPending
                              }
                              className="h-9 flex-1 cursor-pointer rounded-[8px] bg-[#0d2be3] text-sm font-semibold text-[#ffffff] hover:bg-[#0a21b4] disabled:opacity-45"
                            >
                              Import {csvPreview.questions.length} Soal ke Bank
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCsvFileName(null)
                                setCsvPreview(null)
                              }}
                              className="h-9 cursor-pointer rounded-[8px] border border-[#8e9cd6] bg-[#ffffff] px-3 text-sm font-semibold text-[#434d7e]"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <textarea
                        rows={5}
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder={IMPORT_PLACEHOLDER}
                        className="w-full rounded-[8px] border border-[#8e9cd6] bg-[#f3f6ff] p-3 font-mono text-xs text-[#0b1437] placeholder:text-[#5c6694]"
                      />
                      <button
                        type="button"
                        onClick={handleImportJson}
                        disabled={!importText.trim()}
                        className="h-9 w-full cursor-pointer rounded-[8px] border-2 border-[#2a55d6] bg-[#ffffff] text-sm font-semibold text-[#2a55d6] hover:bg-[#eaf0ff] disabled:opacity-45"
                      >
                        Import JSON ke Bank Soal
                      </button>
                    </div>
                  )}
                </section>

                <form
                  onSubmit={handleSaveQuestion}
                  className="space-y-4 rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-5 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)]"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-[#0b1437]">
                      {editingId ? 'Edit Soal' : 'Tambah Soal Manual'}
                    </h2>
                    {editingId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null)
                          setForm(EMPTY_FORM)
                        }}
                        className="cursor-pointer text-xs font-semibold text-[#c0262d]"
                      >
                        Batal Edit
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#434d7e]">
                      Kategori / Babak (opsional)
                    </label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      placeholder="Mis. Sains, Teknologi, Pengetahuan Umum"
                      className="h-9 w-full rounded-[8px] border border-[#8e9cd6] bg-[#f3f6ff] px-3 text-sm text-[#0b1437] placeholder:text-[#5c6694]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#434d7e]">
                      Pertanyaan *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={form.prompt}
                      onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                      placeholder="Tulis teks pertanyaan yang akan tampil di layar Display..."
                      className="w-full rounded-[8px] border border-[#8e9cd6] bg-[#f3f6ff] p-3 text-sm text-[#0b1437] placeholder:text-[#5c6694]"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {OPTION_KEYS.map((key) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[#2a5fe6] text-sm font-bold text-[#ffffff]">
                          {key}
                        </span>
                        <input
                          required
                          type="text"
                          value={form.options[key]}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              options: { ...form.options, [key]: e.target.value },
                            })
                          }
                          placeholder={`Pilihan ${key}`}
                          className="h-9 flex-1 rounded-[8px] border border-[#8e9cd6] bg-[#f3f6ff] px-3 text-sm text-[#0b1437] placeholder:text-[#5c6694]"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#434d7e]">
                        Kunci Jawaban *
                      </label>
                      <select
                        value={form.correctOption}
                        onChange={(e) =>
                          setForm({ ...form, correctOption: e.target.value as OptionKey })
                        }
                        className="h-9 w-full rounded-[8px] border border-[#8e9cd6] bg-[#f3f6ff] px-3 text-sm font-semibold text-[#0b1437]"
                      >
                        {OPTION_KEYS.map((key) => (
                          <option key={key} value={key}>
                            Opsi {key}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#434d7e]">
                        URL Gambar (opsional)
                      </label>
                      <input
                        type="url"
                        value={form.imageUrl}
                        onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                        placeholder="https://..."
                        className="h-9 w-full rounded-[8px] border border-[#8e9cd6] bg-[#f3f6ff] px-3 text-sm text-[#0b1437] placeholder:text-[#5c6694]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="h-10 w-full cursor-pointer rounded-[8px] bg-[#0d2be3] text-sm font-semibold text-[#ffffff] hover:bg-[#0a21b4]"
                  >
                    {editingId ? 'Simpan Perubahan' : 'Tambahkan ke Bank Soal'}
                  </button>
                </form>
              </div>

              {/* Right 7 cols: Question List */}
              <section className="rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-5 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)] lg:col-span-7">
                <h2 className="mb-4 text-lg font-bold text-[#0b1437]">
                  Daftar Bank Soal ({bank?.questions.length ?? 0})
                </h2>

                {!bank?.questions.length ? (
                  <p className="rounded-[8px] border border-dashed border-[#cbd5f5] bg-[#f3f6ff] p-6 text-center text-sm text-[#434d7e]">
                    Belum ada soal. Tambahkan lewat form di kiri atau klik &ldquo;Muat 20 Soal
                    Contoh&rdquo;.
                  </p>
                ) : (
                  <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
                    {bank.questions.map((q, i) => (
                      <article
                        key={q.id}
                        className="rounded-[10px] border border-[#cbd5f5] bg-[#f3f6ff] p-4"
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="tnum rounded-[6px] bg-[#d6e0ff] px-2 py-0.5 text-xs font-bold text-[#0b1437]">
                              #{i + 1}
                            </span>
                            {q.category && (
                              <span className="text-xs font-semibold uppercase tracking-wider text-[#2a55d6]">
                                {q.category}
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                q.used
                                  ? 'bg-[#eaf0ff] text-[#5c6694]'
                                  : 'bg-[#dff8ef] text-[#09704a]'
                              }`}
                            >
                              {q.used ? 'Sudah Tampil' : 'Belum Dipakai'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditClick(q)}
                              className="cursor-pointer text-xs font-semibold text-[#0d2be3] hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                deleteQuestionMutation.mutate(q.id, {
                                  onSuccess: () => toast.success('Soal dihapus'),
                                })
                              }
                              aria-label="Hapus soal"
                              className="cursor-pointer text-[#c0262d] hover:opacity-75"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <p className="font-semibold text-[#0b1437]">{q.prompt}</p>

                        <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                          {OPTION_KEYS.map((key) => (
                            <div
                              key={key}
                              className={`rounded-[6px] px-2.5 py-1.5 ${
                                q.correctOption === key
                                  ? 'bg-[#dff8ef] font-bold text-[#09704a]'
                                  : 'bg-[#ffffff] text-[#434d7e]'
                              }`}
                            >
                              <strong>{key}.</strong> {q.options[key]}
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
