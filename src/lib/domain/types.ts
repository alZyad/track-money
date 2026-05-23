import type { TxType } from './txRules'

export type Tx = {
  date: string
  type: TxType
  transactionIdentifier: string
  transactionRaw: string
  amount: number
  direction: 'in' | 'out'
}

export type Statement = {
  periodStart: string
  periodEnd: string
  oldBalance: number
  newBalance: number
  txs: Tx[]
}

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

/**
 * Virtual sentinel Categories for Transactions no matcher matched. Not
 * persisted; not user-editable; never shown in pickers or the side panel.
 * The leading `__` reserves the id namespace from user input.
 */
export const UNCAT_EXPENSE_ID = '__uncat-expense'
export const UNCAT_INCOME_ID = '__uncat-income'

export const UNCAT_EXPENSE: Category = Object.freeze({
  id: UNCAT_EXPENSE_ID, name: 'Uncategorised', type: 'expense', matchers: [],
}) as Category
export const UNCAT_INCOME: Category = Object.freeze({
  id: UNCAT_INCOME_ID, name: 'Uncategorised', type: 'income', matchers: [],
}) as Category

export function isUncategorised(cat: Category): boolean {
  return cat.id === UNCAT_EXPENSE_ID || cat.id === UNCAT_INCOME_ID
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

