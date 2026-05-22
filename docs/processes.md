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

## Statement upload conflict resolution (Drive era)

On PDF upload, derive `(year, month)` from the parsed `periodEnd`.

| State of Workspace | Action |
|---|---|
| No Statement for `(year, month)` | Accept and persist. |
| Statement exists; **byte-level hash matches** the stored PDF | Reject as duplicate. |
| Statement exists; **hash differs** | Prompt: "Replace the existing `YYYY-MM` Statement with this one?" |

On replace: re-parse the new PDF. Categorisation is automatic via matchers — no per-Tx state to migrate. (Pre-ADR-0006 this flow had to map old Refinements to new Txs by `txId`; that step no longer applies.)

Pre-Drive: not applicable. Each session starts empty.

## AI pre-categorization (v0.6+)

Open: provisional-vs-confirmed UX (matchers from AI vs matchers from user). Deferred — design once AI integration is in scope.

Outline:

1. Collect Txs that the matcher resolver returned Uncategorised for.
2. Send their `transactionIdentifier` (and optionally `amount`, `direction`) to Claude in a single batch request.
3. Receive suggested `categoryId` per Tx.
4. Open question: does AI directly write matchers into the chosen Category, or stage them as "provisional" entries visually distinct in the side panel until the user accepts?
