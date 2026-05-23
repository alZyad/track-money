import type { Tx } from './parsePdf'
import type { Category } from './types'
import { UNCAT_EXPENSE_ID, UNCAT_INCOME_ID, isUncategorised } from './types'
import { categorise } from './categorise'

export type Group = {
  key: string
  label: string
  type: 'expense' | 'income' | 'mixed'
  category: Category
  uncategorised: boolean
  txs: Tx[]
  totalAbs: number
}

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
  for (const tx of txs) {
    const { category } = categorise(tx, categories)
    let g = buckets.get(category.id)
    if (!g) {
      g = {
        key: category.id,
        label: category.name,
        type: category.type,
        category,
        uncategorised: isUncategorised(category),
        txs: [],
        totalAbs: 0,
      }
      buckets.set(category.id, g)
    }
    g.txs.push(tx)
    g.totalAbs += tx.amount
  }

  for (const g of buckets.values()) g.txs.sort((a, b) => b.amount - a.amount)

  const result: Group[] = []
  const uncatOut = buckets.get(UNCAT_EXPENSE_ID)
  const uncatIn = buckets.get(UNCAT_INCOME_ID)
  if (uncatOut) result.push(uncatOut)
  if (uncatIn) result.push(uncatIn)

  const realByType = (t: Group['type']) =>
    [...buckets.values()]
      .filter((g) => !g.uncategorised && g.type === t)
      .sort((a, b) => b.totalAbs - a.totalAbs || a.label.localeCompare(b.label))

  result.push(...realByType('expense'))
  result.push(...realByType('income'))
  result.push(...realByType('mixed'))
  return result
}
