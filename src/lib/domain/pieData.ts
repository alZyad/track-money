import type { Category, Tx } from './types'
import { categorise } from './categorise'
import { categoryColor } from './categoryColor'

export type Slice = {
  categoryId: string
  label: string
  color: string
  value: number
}

/**
 * Aggregate Txs into expense-pie slices. For each Category:
 *   net = sum(amount where direction='out') − sum(amount where direction='in')
 * A slice is emitted only when net > 0. Uncategorised expense Txs collapse
 * into the UNCAT_EXPENSE sentinel slice. Income-only and net-positive mixed
 * Categories produce no slice. Result is sorted by value desc.
 */
export function expensePieSlices(txs: Tx[], categories: Category[]): Slice[] {
  type Acc = { category: { id: string; name: string }; out: number; in: number }
  const buckets = new Map<string, Acc>()
  for (const tx of txs) {
    const { category } = categorise(tx, categories)
    let acc = buckets.get(category.id)
    if (!acc) {
      acc = { category: { id: category.id, name: category.name }, out: 0, in: 0 }
      buckets.set(category.id, acc)
    }
    if (tx.direction === 'out') acc.out += tx.amount
    else acc.in += tx.amount
  }

  const slices: Slice[] = []
  for (const acc of buckets.values()) {
    const net = acc.out - acc.in
    if (net <= 0) continue
    slices.push({
      categoryId: acc.category.id,
      label: acc.category.name,
      color: categoryColor(acc.category.id),
      value: net,
    })
  }
  slices.sort((a, b) => b.value - a.value)
  return slices
}
