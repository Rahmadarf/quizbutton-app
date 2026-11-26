import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BankSummary, QuestionInput } from '../types/quiz'

export const BANK_QUERY_KEY = ['question-bank'] as const

async function fetchBank(): Promise<BankSummary> {
  const res = await fetch('/api/bank')
  if (!res.ok) throw new Error('Gagal memuat Bank Soal')
  return (await res.json()) as BankSummary
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (!res.ok) throw new Error(data.error || 'Permintaan gagal')
  return data
}

export function useQuestionBank() {
  const queryClient = useQueryClient()

  const bankQuery = useQuery<BankSummary>({
    queryKey: BANK_QUERY_KEY,
    queryFn: fetchBank,
  })

  const updateCache = (bank?: BankSummary) => {
    if (bank) {
      queryClient.setQueryData(BANK_QUERY_KEY, bank)
    } else {
      void queryClient.invalidateQueries({ queryKey: BANK_QUERY_KEY })
    }
  }

  const createQuestionMutation = useMutation({
    mutationFn: (input: QuestionInput) =>
      requestJson<{ bank: BankSummary }>('/api/bank/questions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => updateCache(data.bank),
  })

  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: QuestionInput }) =>
      requestJson<{ bank: BankSummary }>(`/api/bank/questions/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => updateCache(data.bank),
  })

  const deleteQuestionMutation = useMutation({
    mutationFn: (id: string) =>
      requestJson<{ bank: BankSummary }>(`/api/bank/questions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    onSuccess: (data) => updateCache(data.bank),
  })

  const importQuestionsMutation = useMutation({
    mutationFn: (questions: QuestionInput[]) =>
      requestJson<{ added: number; skipped: number; bank: BankSummary }>('/api/bank/import', {
        method: 'POST',
        body: JSON.stringify({ questions }),
      }),
    onSuccess: (data) => updateCache(data.bank),
  })

  const seedSampleMutation = useMutation({
    mutationFn: () =>
      requestJson<{ added: number; bank: BankSummary }>('/api/bank/seed-sample', {
        method: 'POST',
      }),
    onSuccess: (data) => updateCache(data.bank),
  })

  const resetUsedMutation = useMutation({
    mutationFn: () =>
      requestJson<{ bank: BankSummary }>('/api/bank/reset-used', {
        method: 'POST',
      }),
    onSuccess: (data) => updateCache(data.bank),
  })

  return {
    bankQuery,
    createQuestionMutation,
    updateQuestionMutation,
    deleteQuestionMutation,
    importQuestionsMutation,
    seedSampleMutation,
    resetUsedMutation,
  }
}
