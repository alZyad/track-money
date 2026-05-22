# ADR-0006: Matcher-only categorisation (no per-Tx Refinement layer)

Date: 2026-05-22
Status: Accepted

## Context

Earlier model had two parallel mechanisms for categorising a **Transaction**:

1. **CounterpartyRule** — a `(matcher → categoryId)` pair applied by substring match across many Txs.
2. **Refinement** — a per-Tx `(txId → categoryId)` override, sticky regardless of what rules say.

This created two precedence layers (manual sticky vs rule-driven) and required a `txId` SHA1 anchor so Refinements survived re-parsing. It also forced the **Refinement page** to expose two distinct concepts to the user.

During v0.2 design grilling we collapsed this. The user's mental model: matchers are the single source of categorisation; editing rules takes effect immediately and Txs no longer matched fall back to "uncategorised". There is no concept of a per-Tx override hiding behind the rules.

## Decision

**Categorisation is entirely matcher-driven.** No `Refinement` entity.

- Each **Category** owns a list of `matchers: string[]`. The `CounterpartyRule` entity is dissolved; matchers nest inside their owning Category.
- For each **Transaction**, scan all matchers across all Categories. The longest matcher that is a substring of `tx.transactionIdentifier` wins; the owning Category becomes the Tx's category.
- On length ties, **Category array order** breaks the tie (falls out of stable iteration; no explicit code).
- A Tx with no matching matcher is **uncategorised** — surfaced as a virtual UI group, not persisted.
- The inline picker on a Tx row is a UI shortcut for "add a matcher equal to this Tx's full `transactionIdentifier` to the chosen Category". It has no other semantics.
- Matchers may overlap freely (e.g. `amazon` in Shopping and `amazon fr` in Misc). Overlaps surface in a **conflicts** section of the side panel showing affected Txs and which Category wins.

## Consequences

- `Workspace.refinements` removed. `Workspace.rules` removed. `Category` gains `matchers: string[]`.
- `Category.type` is **required** (`'expense' | 'income'`) — no `'either'`. The picker filters by Tx direction, enforcing the type guard.
- `txId` SHA1 anchor no longer required for cross-parse stability of categorisation. (May still be useful for upload-replace flow under v0.5; revisit when Drive lands.)
- "Uncategorised" is a UI concept (two virtual groups: `Uncategorised-expense`, `Uncategorised-income`), not a Category. Defaults ship with `misc-expense` / `misc-income` as real-but-empty Categories the user can populate.
- Side panel edits are immediate and global; there is no "preview, then commit" step.

## Alternatives considered

- **Keep the two-layer model.** Rejected: confusion between sticky overrides and rule effects, harder UI, second source of truth.
- **Refinement as max-length matcher (sugar over rules)**. Rejected as halfway house — same end state as full collapse, with extra concept to explain.
- **Tiebreaker = most-recently-edited Category**. Rejected for v0.2: nice-to-have, but free behavior from array order is good enough and zero code.
