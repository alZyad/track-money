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

## v0.2.1 — Browser persistence

Resolved — see `docs/adr/0008-browser-persistence.md`. Carry-overs:

- [ ] **Persistence status indicator** (top-right corner): visual surface
  for "persistence healthy / write failing / backup missing" state. User
  will spec the details when v0.2.1 lands.
- [ ] **IDB helper choice**: ~50 LOC inline wrapper vs pull in `idb-keyval`
  (~1 KB gzipped). Decide at impl time.

## v0.2 — Refinement page

_(all resolved — see CONTEXT.md, docs/data-model.md, docs/processes.md, docs/adr/0006-matcher-only-categorisation.md)_

Deferred for later versions:

- [ ] **Search / filter on Tx list** (deferred enhancement — recommend single search box, substring match on `transactionIdentifier`).
- [ ] **Provisional vs confirmed matchers**: needed once AI lands in v0.6 — should AI-suggested matchers be visually distinct (e.g. dashed border) and require user confirmation before being treated as ground truth?
- [ ] **Drag-to-reorder Categories**: out of scope for v0.2 (defaults are alphabetical within direction cluster, sum-of-amounts desc later). Revisit if user list grows past ~15 categories.
- [ ] **Subcategory UX**: `parentId` is in the data model but v0.2 ships flat. Decide nesting UX (drag-set parent, indented rendering, rollup behavior) when needed.

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

## Recently resolved (for fresh sessions to skim)

- Statement / Tx / Category / Workspace shapes — see `docs/data-model.md`.
- `transactionIdentifier` algorithm (deterministic, lowercase, `<counterparty> - <bankMemo>`) — see `docs/processes.md` § transactionIdentifier derivation.
- Matcher resolution (substring, longest-wins, ties by Category array order) — see `docs/processes.md` § Categorisation.
- Persistence: in-memory pre-v0.5, Drive only after — see `docs/adr/0005-deferred-decisions.md`.
- Upload conflict resolution: `(year, month)` + byte-hash — see `docs/processes.md` § Statement upload conflict resolution.
- Default categories all typed (`expense` / `income`), all deletable, all ship empty — see `CONTEXT.md` § Default categories.
- Category.type required; direction mismatch hard-blocked at picker — see `CONTEXT.md` § Invariants.
- **v0.2 grill (Refinement page)**: matcher-only model (no `Refinement` / `CounterpartyRule` entities); side panel right-collapsible is the advanced rule manager; inline Tx picker = "add matcher to Category" sugar; Tx list grouped by Category with Uncategorised-expense/income pinned top; direction-clustered, amount-desc ordering; bulk-select via checkboxes; matcher validation (lowercase, trim, min 2, dedup within Cat, allow cross-Cat with conflict warnings); Misc-expense / Misc-income added as defaults distinct from Uncategorised UI groups — see `docs/adr/0006-matcher-only-categorisation.md`.
- **Mixed Category type** (ADR-0007): `Category.type ∈ { expense, income, mixed }`. Default `Misc` collapses into a single mixed Category. Inline picker shows two sections (primary direction + Mixed). Refinement page groups: expense → income → mixed clusters.
- **v0.2.1 grill (browser persistence)**: hybrid localStorage (Workspace JSON, immediate writes) + IndexedDB (write-once PDF backup); single-Statement-at-a-time, upload replaces both stores; corrupt/schema-mismatch boot → wipe + toast; missing IDB blob → load + warn toast; no user reset action; 2-retry on backup write failure → toast; new toast system; persistence indicator deferred. See `docs/adr/0008-browser-persistence.md`.
