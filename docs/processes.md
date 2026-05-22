# Processes

Algorithms and procedural rules. Domain entities and shapes are in `CONTEXT.md` and `docs/data-model.md`.

## Tx identity (legacy, possibly removable)

Originally introduced so per-Tx Refinements could survive re-parsing. With Refinements dissolved (ADR-0006), `txId` is no longer load-bearing for categorisation. May still be useful when v0.5 introduces Drive upload-replace; revisit when implementing that flow.

```
txId = SHA1(period | date | amount | direction | transactionIdentifier | indexInStatement)
```

- `period` = `YYYY-MM`
- `indexInStatement` = 0-based occurrence rank among all Txs in the same Statement that share `(date, amount, direction, transactionIdentifier)`. Always `0` for unique tuples; only true duplicates (e.g. two 4,99€ TooGoodToGo orders on the same day) get incrementing indices.

Stable across re-parses because positional reconstruction (ADR-0003) yields a deterministic order.

## transactionIdentifier derivation

Pure string operations on the parsed PDF. No AI, no API calls. Runs offline.

1. Take line 1 of the LIBELLE block.
2. Strip the type prefix (`CB `, `VIR INST `, `VIR SEPA `, `VIR.PERMANENT `, `VIREMENT `, `PRLV SEPA `).
3. For `CB` only: strip trailing ` DD/MM/YY` (the card-purchase date).
4. The result is `counterparty`.
5. Find `bankMemo`:
   - First `LIBELLE:<text>` sub-line if present, else
   - For non-CB / non-FEE / non-OTHER types: the first bare continuation line that is **not** a known SEPA label (`REF.CLIENT`, `ID.CREANCIER`, `REF.MANDAT`, `NATURE DU PAIEMENT`, `CREANCIER INITIAL`, `LIBELLE`).
   - Else `undefined`.
6. Combine: `bankMemo ? "${counterparty} - ${bankMemo}" : counterparty`.
7. Lowercase the whole thing.

## Categorisation (matcher resolution)

For each Tx, decide its Category by scanning matchers across all Categories.

1. Collect candidate matchers: every `matcher ∈ Category.matchers` (across all Categories) such that `matcher` is a substring of `tx.transactionIdentifier`. Both are already lowercase.
2. Of the candidates, keep those of **maximum length** (most specific wins).
3. If multiple candidates remain (tie), pick the one belonging to the **earliest Category** in `Workspace.categories` array order. Stable iteration / `Array.prototype.find` gives this for free.
4. The owning Category of the surviving matcher = the Tx's Category.
5. If no candidate matched, the Tx is **Uncategorised** (rendered into the `Uncategorised-expense` or `Uncategorised-income` UI group based on `tx.direction`).

Re-evaluated immediately whenever any Category's `matchers` changes.

## Inline picker (assigning a Category from a Tx row)

User clicks a Tx row → dropdown lists all Categories whose `type` matches `tx.direction`, organised under a single header. On pick:

1. Append the Tx's full `transactionIdentifier` as a new matcher to the chosen Category.
2. Apply matcher validation (see below). If validation rejects (e.g. matcher already exists in that Category), no-op silently.
3. Re-run categorisation. Tx hops to the chosen Category's group in the list.

The picker has no other effect — there is no Refinement entity, no rule object, no precedence layer. It is sugar over "add matcher to Category".

## Side panel (advanced rule management)

Right-side collapsible panel. Top-down structure:

1. List of Categories (expense cluster, then income cluster; within cluster, name asc).
2. Each Category expandable to its matcher list. Per-matcher actions: edit, delete. Per-Category actions: rename, delete, add matcher.
3. "+ Add Category" button: name + type (required radio).
4. Conflicts section at bottom: lists every Tx matched by ≥ 2 matchers from different Categories. Shows the Tx identifier, all matching `(Category, matcher)` pairs, and which one currently wins.

All mutations are immediate. There is no draft / commit step.

## Matcher validation

When the user adds or edits a matcher:

- **Lowercase**: input is auto-lowercased on save.
- **Trim**: leading/trailing whitespace stripped; internal whitespace preserved.
- **Min length**: 2 characters.
- **Empty**: rejected.
- **Duplicate within the same Category**: rejected silently (no-op).
- **Duplicate across Categories**: allowed. Surfaces in the conflicts section.
- **Zero current matches**: accepted, but the matcher row gets a small icon with hover-tooltip "Matches 0 current Txs" so the user knows.

## Statement upload (v0.2.1 — browser persistence)

Per ADR-0008, only one Statement is persisted at a time. Upload always
replaces.

1. Parse the new PDF.
2. Compute `pdfHash` = SHA-256 of the byte stream.
3. Write Workspace JSON to localStorage immediately (new `statement` field
   pointing at the new `pdfHash`). Categories + matchers carry across
   unchanged.
4. Delete the previous PDF blob from IndexedDB (if any).
5. Write the new blob to IndexedDB. Retry twice on failure; if it still
   fails, surface a toast — the app continues working from the Workspace
   JSON, but the backup is missing.

Re-upload of the same `pdfHash` is treated as a no-op replace (Workspace
JSON rewritten identically; IDB blob rewritten). No dedup prompt.

## Boot (v0.2.1)

1. Read `localStorage["track-money:workspace"]` synchronously.
2. If empty → first-run upload screen.
3. If JSON.parse fails OR `schemaVersion !== 1` → wipe both stores, show
   error toast, fall through to first-run screen.
4. Otherwise hydrate the in-memory Workspace from the JSON.
5. Asynchronously check IndexedDB for the `pdfHash` blob. If missing,
   show a warn toast (data still works; backup gone).

## Statement upload conflict resolution (Drive era, v0.5+)

Deferred until Drive lands. The v0.5 model will keep multiple Statements
keyed by `(year, month)`, replacing the single-Statement model from
v0.2.1. Conflict policy (hash match → duplicate; hash differs → replace
prompt) will land alongside that change.

## AI pre-categorization (v0.6+)

Open: provisional-vs-confirmed UX (matchers from AI vs matchers from user). Deferred — design once AI integration is in scope.

Outline:

1. Collect Txs that the matcher resolver returned Uncategorised for.
2. Send their `transactionIdentifier` (and optionally `amount`, `direction`) to Claude in a single batch request.
3. Receive suggested `categoryId` per Tx.
4. Open question: does AI directly write matchers into the chosen Category, or stage them as "provisional" entries visually distinct in the side panel until the user accepts?
