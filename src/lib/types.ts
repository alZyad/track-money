import type { Statement } from './parsePdf'

export type CategoryType = 'expense' | 'income' | 'mixed'

export type Category = {
  id: string
  name: string
  parentId?: string
  type: CategoryType
  matchers: string[]
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'rent',          name: 'Rent',          type: 'expense', matchers: [] },
  { id: 'groceries',     name: 'Groceries',     type: 'expense', matchers: [] },
  { id: 'restaurant',    name: 'Restaurant',    type: 'expense', matchers: [] },
  { id: 'subscriptions', name: 'Subscriptions', type: 'expense', matchers: [] },
  { id: 'transport',     name: 'Transport',     type: 'expense', matchers: [] },
  { id: 'salary',        name: 'Salary',        type: 'income',  matchers: [] },
  { id: 'misc',          name: 'Misc',          type: 'mixed',   matchers: [] },
]

export function acceptsDirection(cat: Category, direction: 'in' | 'out'): boolean {
  if (cat.type === 'mixed') return true
  if (cat.type === 'expense') return direction === 'out'
  return direction === 'in'
}

export type PersistedStatement = {
  pdfHash: string
  statement: Statement
}

export type PersistedWorkspace = {
  schemaVersion: 1
  statement: PersistedStatement | null
  categories: Category[]
}

export const SCHEMA_VERSION = 1

