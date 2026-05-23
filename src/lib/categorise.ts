import type { Tx } from './parsePdf'
import type { Category } from './types'
import { UNCAT_EXPENSE, UNCAT_INCOME, acceptsDirection } from './types'

/**
 * The Category a Tx is assigned to, plus the winning matcher.
 * `matcher` is null when the Tx is uncategorised (the assigned Category is
 * one of the UNCAT_* sentinels).
 */
export type Assignment = {
  category: Category
  matcher: string | null
}

/**
 * Resolve which Category owns a Tx by scanning all matchers across all
 * Categories. Longest substring matcher wins. Ties broken by Category array
 * order (stable via `for…of`). Falls back to the direction-appropriate
 * UNCAT_* sentinel when nothing matches — callers always get a Category.
 */
export function categorise(tx: Tx, categories: Category[]): Assignment {
  let best: { category: Category; matcher: string } | null = null
  for (const cat of categories) {
    if (!acceptsDirection(cat, tx.direction)) continue
    for (const m of cat.matchers) {
      if (!tx.transactionIdentifier.includes(m)) continue
      if (!best || m.length > best.matcher.length) {
        best = { category: cat, matcher: m }
      }
    }
  }
  if (best) return { category: best.category, matcher: best.matcher }
  return {
    category: tx.direction === 'out' ? UNCAT_EXPENSE : UNCAT_INCOME,
    matcher: null,
  }
}

/** All `(category, matcher)` pairs that match this Tx. Used for conflicts. */
export function allMatches(tx: Tx, categories: Category[]): Array<{ category: Category; matcher: string }> {
  const hits: Array<{ category: Category; matcher: string }> = []
  for (const cat of categories) {
    if (!acceptsDirection(cat, tx.direction)) continue
    for (const m of cat.matchers) {
      if (tx.transactionIdentifier.includes(m)) hits.push({ category: cat, matcher: m })
    }
  }
  return hits
}

export type MatcherValidation =
  | { ok: true; matcher: string }
  | { ok: false; reason: string }

/**
 * Normalise + validate a matcher string for a given target Category.
 * Returns the cleaned matcher or a rejection reason. Cross-Cat duplicates are
 * allowed (they surface in the conflicts section).
 */
export function validateMatcher(input: string, target: Category): MatcherValidation {
  const cleaned = input.trim().toLowerCase()
  if (cleaned.length === 0) return { ok: false, reason: 'Matcher is empty' }
  if (cleaned.length < 2) return { ok: false, reason: 'Matcher must be at least 2 characters' }
  if (target.matchers.includes(cleaned)) {
    return { ok: false, reason: 'Matcher already exists in this Category' }
  }
  return { ok: true, matcher: cleaned }
}
