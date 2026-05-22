# Open design questions

Working notes from grilling sessions. Resolved questions live in `CONTEXT.md`, `docs/data-model.md`, `docs/processes.md`, or `docs/adr/`. This file tracks what's still unresolved and where we paused.

## How to resume in a new conversation

1. Read `CLAUDE.md` for the project overview.
2. Read `CONTEXT.md` (domain language) and `docs/data-model.md` + `docs/processes.md` for resolved decisions.
3. Skim `docs/adr/` for architectural choices.
4. Read this file for what's still open.
5. To resume grilling, run the `grill-with-docs` skill on a specific open question.

## Currently in flight

_(none)_

## v0.2 — Refinement page

- [ ] **Page 2 ergonomics**: bulk-select Txs to assign a category? Filter by `transactionIdentifier`? Where does the rule editor live (inline per-row, side panel, separate page)?
- [ ] **Rule creation UX**: when assigning a category, how does the user shorten the matcher? Auto-suggest substrings? Free-text edit? Preview "this rule will match N other Txs"?
- [ ] **Uncategorised badge**: how to surface Txs without a Refinement — colour, count, filter?
- [ ] **Provisional vs confirmed Refinements**: visual distinction so AI/rule auto-fills are obviously different from explicit user choices. Decide once we have AI in scope.

## v0.3 — Monthly visualization

- [ ] **Subcategory rollup behavior**: do pie charts collapse children into parents? Toggle? Always-on? What does the user actually want to see?
- [ ] **Direction split**: single pie of expenses + headline numbers for income? Two pies? One stacked bar?

## v0.4 — Multi-month visualization

- [ ] **Multi-month aggregation**: when looking across months, are categories the unit of analysis? Are there other axes (counterparty, subcategory)?
- [ ] **Empty-month handling**: months with no Statement uploaded — gap, zero, or hide?

## v0.5 — Google Drive integration

- [ ] **Drive layout**: single JSON blob, per-month files, or a folder per Statement? Tradeoffs: atomicity vs read efficiency vs Drive UI ergonomics.
- [ ] **OAuth flow**: popup vs redirect? Which scopes? Static-hosted SPA implications.
- [ ] **Conflict on concurrent edits**: irrelevant for solo use, but if the user has the app open in two tabs?
- [ ] **Migration strategy**: schema versioning of the stored Workspace JSON.

## v0.6 — Claude AI categorization

- [ ] **API access**: client-side with user's own API key (no proxy) vs minimal proxy (avoids exposing key in browser, costs per-user). Each implies a different deploy story.
- [ ] **Batch shape**: send all uncategorised Txs in one request, or stream? Token budget vs latency.
- [ ] **Confidence threshold**: should AI also output a confidence score, surfaced as a "review me" badge?

## Cross-cutting / not version-tagged

- [ ] **Multiple accounts**: out of scope today, but the data model assumes a single account. If ever in scope, `Workspace` needs an `accounts` axis.
- [ ] **Other banks**: explicitly out of scope. Re-asses if requested.
- [ ] **Currency drift**: currently EUR-only. Foreign-currency CB lines lose their original amount (we drop the second line). Acceptable for now.

## Recently resolved (last 24h, for fresh sessions to skim)

- Statement / Tx / Refinement / Category / Workspace shapes — see `docs/data-model.md`.
- `transactionIdentifier` algorithm (deterministic, lowercase, `<counterparty> - <bankMemo>`) — see `docs/processes.md` § transactionIdentifier derivation.
- `transactionIdentifierMatcher` semantics (substring, longest-wins) — see `docs/processes.md` § Counterparty rule matching.
- Persistence: in-memory pre-v0.5, Drive only after — see `docs/adr/0005-deferred-decisions.md`.
- Upload conflict resolution: `(year, month)` + byte-hash — see `docs/processes.md` § Statement upload conflict resolution.
- Default categories + type-locked Rent (expense) / Salary (income) — see `CONTEXT.md` § Default categories.
- Q7 resolved: Category.type mismatch is **hard-blocked** at assignment (picker hides incompatible categories) — see `CONTEXT.md` § Invariants.
