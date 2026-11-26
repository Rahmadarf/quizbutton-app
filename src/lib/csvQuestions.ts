import type { OptionKey, QuestionInput } from '../types/quiz'

export interface CsvParseError {
  row: number
  message: string
}

export interface CsvParseResult {
  questions: QuestionInput[]
  errors: CsvParseError[]
  delimiter: ',' | ';'
  totalRows: number
}

const VALID_OPTIONS = new Set<OptionKey>(['A', 'B', 'C', 'D'])

function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function detectDelimiter(text: string): ',' | ';' {
  const firstLine = text.split(/\r?\n/, 1)[0] || ''
  let commas = 0
  let semicolons = 0
  let inQuotes = false
  for (let i = 0; i < firstLine.length; i += 1) {
    const ch = firstLine[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (!inQuotes) {
      if (ch === ',') commas += 1
      if (ch === ';') semicolons += 1
    }
  }
  return semicolons > commas ? ';' : ','
}

function parseCsvRows(text: string, delimiter: ',' | ';'): string[][] {
  const clean = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i]
    const next = clean[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\r' && next === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      i += 1
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0))
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias)
    if (idx !== -1) return idx
  }
  return -1
}

export function parseQuestionsCsv(csvText: string): CsvParseResult {
  const delimiter = detectDelimiter(csvText)
  const rows = parseCsvRows(csvText, delimiter)

  if (rows.length < 2) {
    return {
      questions: [],
      errors: [
        {
          row: 1,
          message: 'File CSV minimal harus memiliki 1 baris header dan 1 baris soal.',
        },
      ],
      delimiter,
      totalRows: 0,
    }
  }

  const headers = rows[0].map(normalizeHeader)
  const idxCategory = findColumnIndex(headers, ['kategori', 'category', 'babak', 'topik'])
  const idxPrompt = findColumnIndex(headers, ['pertanyaan', 'soal', 'prompt', 'question'])
  const idxA = findColumnIndex(headers, ['a', 'opsi_a', 'option_a', 'pilihan_a'])
  const idxB = findColumnIndex(headers, ['b', 'opsi_b', 'option_b', 'pilihan_b'])
  const idxC = findColumnIndex(headers, ['c', 'opsi_c', 'option_c', 'pilihan_c'])
  const idxD = findColumnIndex(headers, ['d', 'opsi_d', 'option_d', 'pilihan_d'])
  const idxCorrect = findColumnIndex(headers, [
    'kunci',
    'jawaban',
    'kunci_jawaban',
    'correctoption',
    'correct_option',
    'correct',
    'answer',
  ])
  const idxImage = findColumnIndex(headers, ['gambar', 'url_gambar', 'image', 'imageurl', 'image_url'])

  const missingCols: string[] = []
  if (idxPrompt === -1) missingCols.push('pertanyaan')
  if (idxA === -1) missingCols.push('A')
  if (idxB === -1) missingCols.push('B')
  if (idxC === -1) missingCols.push('C')
  if (idxD === -1) missingCols.push('D')
  if (idxCorrect === -1) missingCols.push('kunci')

  if (missingCols.length > 0) {
    return {
      questions: [],
      errors: [
        {
          row: 1,
          message: `Kolom wajib tidak ditemukan di header CSV: ${missingCols.join(', ')}. Gunakan header: kategori,pertanyaan,A,B,C,D,kunci,gambar`,
        },
      ],
      delimiter,
      totalRows: rows.length - 1,
    }
  }

  const questions: QuestionInput[] = []
  const errors: CsvParseError[] = []

  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i]
    const rowNum = i + 1
    const get = (idx: number) => (idx >= 0 && idx < r.length ? r[idx].trim() : '')

    const prompt = get(idxPrompt)
    const optA = get(idxA)
    const optB = get(idxB)
    const optC = get(idxC)
    const optD = get(idxD)
    const rawKey = get(idxCorrect).toUpperCase()
    const category = get(idxCategory)
    const imageUrl = get(idxImage)

    if (!prompt) {
      errors.push({ row: rowNum, message: 'Pertanyaan kosong.' })
      continue
    }
    if (!optA || !optB || !optC || !optD) {
      errors.push({ row: rowNum, message: 'Keempat pilihan (A, B, C, D) wajib diisi.' })
      continue
    }
    if (!VALID_OPTIONS.has(rawKey as OptionKey)) {
      errors.push({
        row: rowNum,
        message: `Kunci jawaban "${rawKey || '(kosong)'}" tidak valid (harus A, B, C, atau D).`,
      })
      continue
    }

    questions.push({
      category: category || undefined,
      prompt,
      options: { A: optA, B: optB, C: optC, D: optD },
      correctOption: rawKey as OptionKey,
      imageUrl: imageUrl || undefined,
    })
  }

  return {
    questions,
    errors,
    delimiter,
    totalRows: rows.length - 1,
  }
}

export const CSV_TEMPLATE_CONTENT = `\uFEFFkategori,pertanyaan,A,B,C,D,kunci,gambar
Sains,"Planet manakah yang memiliki cincin paling mencolok di Tata Surya?",Mars,Venus,Saturnus,Merkurius,C,
Teknologi,"Kepanjangan dari HTML adalah?",HyperText Markup Language,High Transfer Machine Logic,Hyperlink Text Mode List,Home Tool Markup Language,A,
Pengetahuan Umum,"Ibu kota negara Indonesia adalah?",Bandung,Jakarta,Surabaya,Medan,B,
`

export function downloadCsvTemplate(): void {
  const blob = new Blob([CSV_TEMPLATE_CONTENT], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'template-soal-quizbutton.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
