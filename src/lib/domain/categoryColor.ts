import { UNCAT_EXPENSE_ID, UNCAT_INCOME_ID } from './types'

const PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
  '#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#8c564b',
] as const

const UNCAT_COLOR = '#cfcfcf'

const assigned = new Map<string, string>()
let cursor = 0

/**
 * Stable per-session color for a Category. Same id always returns the same
 * color within a session; removing other cats does not shift assignments.
 * Wraps after 15 cats — duplicates possible past that. Uncategorised sentinels
 * get a fixed neutral gray.
 */
export function categoryColor(categoryId: string): string {
  if (categoryId === UNCAT_EXPENSE_ID || categoryId === UNCAT_INCOME_ID) return UNCAT_COLOR
  let c = assigned.get(categoryId)
  if (!c) {
    c = PALETTE[cursor % PALETTE.length]
    cursor++
    assigned.set(categoryId, c)
  }
  return c
}
