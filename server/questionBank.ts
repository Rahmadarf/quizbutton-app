import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BankQuestion, OptionKey } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../data')
const BANK_FILE = path.join(DATA_DIR, 'question-bank.json')

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D']

interface PersistedBank {
  questions: BankQuestion[]
  usedQuestionIds: string[]
}

export interface BankSummary {
  questions: Array<BankQuestion & { used: boolean }>
  usedQuestionIds: string[]
  totalCount: number
  usedCount: number
  availableCount: number
}

export interface QuestionInput {
  id?: string
  category?: string
  prompt: string
  options: Record<OptionKey, string>
  correctOption: OptionKey
  imageUrl?: string
}

const SAMPLE_QUESTIONS: Array<Omit<BankQuestion, 'id' | 'createdAt'>> = [
  {
    category: 'Pengetahuan Umum',
    prompt: 'Apa nama ibu kota Provinsi Kalimantan Timur?',
    options: { A: 'Balikpapan', B: 'Samarinda', C: 'Bontang', D: 'Tenggarong' },
    correctOption: 'B',
  },
  {
    category: 'Sains',
    prompt: 'Planet manakah di Tata Surya yang memiliki julukan Planet Merah?',
    options: { A: 'Venus', B: 'Jupiter', C: 'Mars', D: 'Merkurius' },
    correctOption: 'C',
  },
  {
    category: 'Teknologi',
    prompt: 'Protokol apa yang digunakan untuk komunikasi dua arah realtime di web?',
    options: { A: 'FTP', B: 'SMTP', C: 'WebSocket', D: 'POP3' },
    correctOption: 'C',
  },
  {
    category: 'Matematika',
    prompt: 'Berapakah hasil dari 15 × 12 − 30?',
    options: { A: '140', B: '150', C: '160', D: '180' },
    correctOption: 'B',
  },
  {
    category: 'Sejarah',
    prompt: 'Pada tanggal berapakah Sumpah Pemuda diikrarkan?',
    options: {
      A: '20 Mei 1908',
      B: '17 Agustus 1945',
      C: '28 Oktober 1928',
      D: '10 November 1945',
    },
    correctOption: 'C',
  },
  {
    category: 'Geografi',
    prompt: 'Gunung tertinggi di Pulau Jawa adalah...',
    options: { A: 'Gunung Merapi', B: 'Gunung Slamet', C: 'Gunung Semeru', D: 'Gunung Lawu' },
    correctOption: 'C',
  },
  {
    category: 'Sains',
    prompt: 'Unsur kimia dengan lambang "Au" adalah...',
    options: { A: 'Perak', B: 'Emas', C: 'Aluminium', D: 'Argon' },
    correctOption: 'B',
  },
  {
    category: 'Teknologi',
    prompt: 'Kepanjangan dari HTTP adalah...',
    options: {
      A: 'HyperText Transfer Protocol',
      B: 'High Transmission Text Process',
      C: 'Hyperlink Terminal Transfer Path',
      D: 'Host Text Transport Protocol',
    },
    correctOption: 'A',
  },
  {
    category: 'Bahasa',
    prompt: 'Manakah penulisan kata baku yang benar menurut KBBI?',
    options: { A: 'Aktifitas', B: 'Analisa', C: 'Risiko', D: 'Praktek' },
    correctOption: 'C',
  },
  {
    category: 'Olahraga',
    prompt: 'Berapa jumlah pemain inti dalam satu tim bola basket di lapangan?',
    options: { A: '5 orang', B: '6 orang', C: '7 orang', D: '11 orang' },
    correctOption: 'A',
  },
  {
    category: 'Pengetahuan Umum',
    prompt: 'Mata uang resmi negara Jepang adalah...',
    options: { A: 'Won', B: 'Yuan', C: 'Yen', D: 'Baht' },
    correctOption: 'C',
  },
  {
    category: 'Sains',
    prompt: 'Gas apa yang paling banyak menyusun atmosfer Bumi?',
    options: { A: 'Oksigen', B: 'Nitrogen', C: 'Karbon dioksida', D: 'Hidrogen' },
    correctOption: 'B',
  },
  {
    category: 'Teknologi',
    prompt: 'Struktur data yang bekerja dengan prinsip LIFO (Last In, First Out) adalah...',
    options: { A: 'Queue', B: 'Stack', C: 'Linked List', D: 'Hash Map' },
    correctOption: 'B',
  },
  {
    category: 'Matematika',
    prompt: 'Berapakah nilai dari akar kuadrat 196?',
    options: { A: '12', B: '13', C: '14', D: '16' },
    correctOption: 'C',
  },
  {
    category: 'Sejarah',
    prompt: 'Kerajaan Hindu tertua di Indonesia adalah Kerajaan...',
    options: { A: 'Majapahit', B: 'Sriwijaya', C: 'Tarumanegara', D: 'Kutai' },
    correctOption: 'D',
  },
  {
    category: 'Geografi',
    prompt: 'Benua terluas di dunia adalah...',
    options: { A: 'Afrika', B: 'Amerika', C: 'Asia', D: 'Eropa' },
    correctOption: 'C',
  },
  {
    category: 'Sains',
    prompt: 'Organ tubuh manusia yang berfungsi memompa darah ke seluruh tubuh adalah...',
    options: { A: 'Paru-paru', B: 'Jantung', C: 'Ginjal', D: 'Hati' },
    correctOption: 'B',
  },
  {
    category: 'Teknologi',
    prompt: 'Port default untuk layanan HTTPS adalah...',
    options: { A: '22', B: '80', C: '443', D: '8080' },
    correctOption: 'C',
  },
  {
    category: 'Pengetahuan Umum',
    prompt: 'Alat musik tradisional Angklung berasal dari daerah...',
    options: { A: 'Jawa Tengah', B: 'Jawa Barat', C: 'Bali', D: 'Sumatera Barat' },
    correctOption: 'B',
  },
  {
    category: 'Matematika',
    prompt: 'Jumlah sudut dalam sebuah segitiga selalu sebesar...',
    options: { A: '90 derajat', B: '180 derajat', C: '270 derajat', D: '360 derajat' },
    correctOption: 'B',
  },
]

function sanitizeQuestion(input: QuestionInput): BankQuestion | null {
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : ''
  if (!prompt) return null

  const options = {} as Record<OptionKey, string>
  for (const key of OPTION_KEYS) {
    const val = typeof input.options?.[key] === 'string' ? input.options[key].trim() : ''
    if (!val) return null
    options[key] = val
  }

  const rawCorrect = String(input.correctOption || '').trim().toUpperCase()
  if (!OPTION_KEYS.includes(rawCorrect as OptionKey)) return null

  const category = typeof input.category === 'string' ? input.category.trim().slice(0, 60) : ''
  const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : ''

  return {
    id: input.id && input.id.trim() ? input.id.trim() : randomUUID(),
    category: category || undefined,
    prompt,
    options,
    correctOption: rawCorrect as OptionKey,
    imageUrl: imageUrl || undefined,
    createdAt: Date.now(),
  }
}

export class QuestionBankStore {
  private questions: BankQuestion[] = []
  private usedQuestionIds = new Set<string>()

  constructor() {
    this.load()
  }

  private load(): void {
    try {
      if (!fs.existsSync(BANK_FILE)) {
        this.questions = []
        this.usedQuestionIds = new Set()
        return
      }
      const raw = fs.readFileSync(BANK_FILE, 'utf8')
      const parsed = JSON.parse(raw) as Partial<PersistedBank>
      this.questions = Array.isArray(parsed.questions) ? parsed.questions : []
      this.usedQuestionIds = new Set(
        Array.isArray(parsed.usedQuestionIds) ? parsed.usedQuestionIds : [],
      )
    } catch {
      this.questions = []
      this.usedQuestionIds = new Set()
    }
  }

  private save(): void {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const payload: PersistedBank = {
      questions: this.questions,
      usedQuestionIds: Array.from(this.usedQuestionIds),
    }
    const tmpFile = `${BANK_FILE}.tmp`
    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf8')
    fs.renameSync(tmpFile, BANK_FILE)
  }

  public getSummary(): BankSummary {
    const existingIds = new Set(this.questions.map((q) => q.id))
    let usedCount = 0
    const questions = this.questions.map((q) => {
      const used = this.usedQuestionIds.has(q.id)
      if (used) usedCount += 1
      return { ...q, used }
    })
    return {
      questions,
      usedQuestionIds: Array.from(this.usedQuestionIds).filter((id) => existingIds.has(id)),
      totalCount: this.questions.length,
      usedCount,
      availableCount: this.questions.length - usedCount,
    }
  }

  public createQuestion(input: QuestionInput): BankQuestion | null {
    const q = sanitizeQuestion({ ...input, id: undefined })
    if (!q) return null
    this.questions.push(q)
    this.save()
    return q
  }

  public updateQuestion(id: string, input: QuestionInput): BankQuestion | null {
    const idx = this.questions.findIndex((q) => q.id === id)
    if (idx === -1) return null
    const updated = sanitizeQuestion({ ...input, id })
    if (!updated) return null
    updated.createdAt = this.questions[idx].createdAt
    this.questions[idx] = updated
    this.save()
    return updated
  }

  public deleteQuestion(id: string): boolean {
    const before = this.questions.length
    this.questions = this.questions.filter((q) => q.id !== id)
    if (this.questions.length === before) return false
    this.usedQuestionIds.delete(id)
    this.save()
    return true
  }

  public importQuestions(inputs: QuestionInput[]): { added: number; skipped: number } {
    let added = 0
    let skipped = 0
    for (const item of inputs) {
      const sanitized = sanitizeQuestion({ ...item, id: undefined })
      if (!sanitized) {
        skipped += 1
        continue
      }
      this.questions.push(sanitized)
      added += 1
    }
    if (added > 0) {
      this.save()
    }
    return { added, skipped }
  }

  public seedSampleQuestions(): { added: number } {
    const existingPrompts = new Set(this.questions.map((q) => q.prompt.toLowerCase()))
    let added = 0
    const now = Date.now()
    for (let i = 0; i < SAMPLE_QUESTIONS.length; i += 1) {
      const sample = SAMPLE_QUESTIONS[i]
      if (existingPrompts.has(sample.prompt.toLowerCase())) continue
      this.questions.push({
        id: randomUUID(),
        ...sample,
        createdAt: now + i,
      })
      added += 1
    }
    if (added > 0) {
      this.save()
    }
    return { added }
  }

  public drawUnusedQuestions(count = 10, shuffle = true): BankQuestion[] {
    const unused = this.questions.filter((q) => !this.usedQuestionIds.has(q.id))
    const pool = [...unused]
    if (shuffle) {
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = pool[i]
        pool[i] = pool[j]
        pool[j] = tmp
      }
    }
    return pool.slice(0, Math.max(1, count))
  }

  public markUsed(questionId: string): void {
    if (!questionId) return
    if (!this.usedQuestionIds.has(questionId)) {
      this.usedQuestionIds.add(questionId)
      this.save()
    }
  }

  public resetUsedHistory(): void {
    this.usedQuestionIds.clear()
    this.save()
  }
}
