import type { Tx } from './parsePdf'
import type { Category } from './types'
import { categorise } from './categorise'

export type Group = {
  key: string
  label: string
  type: 'expense' | 'income' | 'mixed'
  /** null = Uncategorised virtual group. */
  category: Category | null
  txs: Tx[]
  totalAbs: number
}

const UNCAT_OUT_KEY = 'uncat-out'
const UNCAT_IN_KEY = 'uncat-in'

/**
 * Bucket Transactions by their matched Category. Within each group, Txs are
 * sorted by amount desc. Group order:
 *
 *   1. Uncategorised expense   (if non-empty)
 *   2. Uncategorised income    (if non-empty)
 *   3. Expense Categories      sorted by totalAbs desc, name asc tiebreak
 *   4. Income Categories       same
 *   5. Mixed Categories        same
 */
export function groupTxsByCategory(txs: Tx[], categories: Category[]): Group[] {
  const buckets = new Map<string, Group>()
  const ensure = (key: string, label: string, type: Group['type'], category: Category | null): Group => {
    let g = buckets.get(key)
    if (!g) {
      g = { key, label, type, category, txs: [], totalAbs: 0 }
      buckets.set(key, g)
    }
    return g
  }

  ensure(UNCAT_OUT_KEY, 'Uncategorised', 'expense', null)
  ensure(UNCAT_IN_KEY, 'Uncategorised', 'income', null)

  for (const tx of txs) {
    const a = categorise(tx, categories)
    const g = a.kind === 'categorised'
      ? ensure(a.category.id, a.category.name, a.category.type, a.category)
      : buckets.get(tx.direction === 'out' ? UNCAT_OUT_KEY : UNCAT_IN_KEY)!
    g.txs.push(tx)
    g.totalAbs += tx.amount
  }

  for (const g of buckets.values()) g.txs.sort((a, b) => b.amount - a.amount)

  const realByType = (t: Group['type']) =>
    [...buckets.values()]
      .filter((g) => g.category !== null && g.type === t)
      .sort((a, b) => b.totalAbs - a.totalAbs || a.label.localeCompare(b.label))

  const uncatOut = buckets.get(UNCAT_OUT_KEY)!
  const uncatIn = buckets.get(UNCAT_IN_KEY)!
  const result: Group[] = []
  if (uncatOut.txs.length) result.push(uncatOut)
  if (uncatIn.txs.length) result.push(uncatIn)
  result.push(...realByType('expense'))
  result.push(...realByType('income'))
  result.push(...realByType('mixed'))
  return result
}
