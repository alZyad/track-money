# ADR-0007: `mixed` Category type

Date: 2026-05-22
Status: Accepted

## Context

ADR-0006 locked Category.type to `'expense' | 'income'` (required, no `'either'`). The picker hard-blocks direction mismatches. This forced any "I just want one bucket for everything I label X" use case to ship as two parallel Categories (e.g. `misc-expense` + `misc-income`), with refunds, transfers, and direction-ambiguous flows splitting awkwardly across them.

The MVP default catalogue showed the pain immediately: shipping two `Misc` Categories of different types is duplicative and the user can't visualise "all the misc stuff together" as one bucket.

## Decision

Introduce a third Category type: **`mixed`**.

- `Category.type ∈ { 'expense', 'income', 'mixed' }`.
- A `mixed` Category accepts **both** `out` and `in` Txs. Its group in the Refinement page renders a single block with both kinds of Tx aggregated (sum is still over `tx.amount`, which is always positive, so the displayed total is sum-of-absolute-values across the whole Category).
- The default `Misc` Category is `mixed`. The previous `misc-expense` + `misc-income` pair is collapsed into a single `misc` entry.
- The inline picker on a Tx now offers two sections:
  - For an `out` Tx → "Expense" Cats + "Mixed" Cats are pickable.
  - For an `in` Tx → "Income" Cats + "Mixed" Cats are pickable.
- The Refinement page renders three category clusters (still after the Uncategorised UI groups): `expense`, then `income`, then `mixed`.
- Bulk-assign: a `mixed` Category is always pickable for any non-empty selection (since it accepts both directions).

## Consequences

- `acceptsDirection(cat, direction)` helper centralises the type-compatibility check; matcher resolution + UI both call it.
- Conflict resolution semantics unchanged: a Tx may match matchers in a `mixed` Category and a typed Category; longest-matcher-wins still applies; ties still broken by Category array order.
- Visual treatment: `mixed` gets its own type-tag colour (re-uses the violet "default" token) to distinguish from expense (amber) and income (sky).
- Slight loss of strictness: a user could shove every Tx into a single `mixed` Category and never see direction in the grouped view. Treated as a feature: power users who want a flat list can have one.

## Alternatives considered

- **Stay with two Misc Categories**. Rejected: the visualisation goal of "see all misc together" is a real user need; this approach buries it behind two screens.
- **Optional `type?: 'expense' | 'income'` (omit = either)**. Rejected: this was the pre-ADR-0006 model. The implicit-`either` semantics made the picker logic ambiguous and the data model harder to reason about. An explicit `'mixed'` value is more honest.
- **Drop typing entirely**. Rejected: most Categories are direction-locked in practice (rent is never income); throwing away the guard would degrade the picker UX and let users assign refunds to "Rent" by mistake.
