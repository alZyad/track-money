# Processes

Algorithms and procedural rules. Domain entities and shapes are in `CONTEXT.md` and `docs/data-model.md`.

## Tx identity

For a **Refinement** to survive re-parsing the same Statement, each **Transaction** needs a stable identity across runs.

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

## Counterparty rule matching

When categorising a Tx, find the **Counterparty rule** to apply (Drive era only — pre-v0.5 there are no rules):

1. Among all rules, keep those whose `transactionIdentifierMatcher` is a substring of `tx.transactionIdentifier` (both already lowercase).
2. If multiple match, pick the rule with the **longest matcher** (most specific wins).
3. If none match, the Tx is uncategorised — AI fills in from v0.6 onwards.

## Rule learning (last-write-wins)

When the user assigns or changes a Tx's Category:

1. Compute the rule key. Default = the full `transactionIdentifier`. The user may shorten it via the rule editor.
2. Upsert the **Counterparty rule**: if a rule with the same matcher exists, replace its `categoryId`; otherwise create.
3. Past **Refinements** are not retroactively rewritten. Only future Statements (or future re-categorisations) see the new rule.

## Statement upload conflict resolution (Drive era)

On PDF upload, derive `(year, month)` from the parsed `periodEnd`.

| State of Workspace | Action |
|---|---|
| No Statement for `(year, month)` | Accept and persist. |
| Statement exists; **byte-level hash matches** the stored PDF | Reject as duplicate. |
| Statement exists; **hash differs** | Prompt: "Replace the existing `YYYY-MM` Statement with this one?" |

On replace:
1. Re-parse the new PDF.
2. Map old Refinements to new Txs by `txId`.
3. Refinements whose `txId` no longer exists are dropped; surface a notice listing them.

Pre-Drive: not applicable. Each session starts empty.

## AI pre-categorization (v0.6+)

After Counterparty-rule matching runs:

1. Collect Txs with no matching rule.
2. Send their `transactionIdentifier` (and optionally `amount`, `direction`) to Claude in a single batch request.
3. Receive suggested `categoryId` per Tx.
4. Apply as **provisional Refinements** — visually distinct in the UI so the user can accept or override.
5. User acceptance promotes the provisional Refinement to a regular one and creates the corresponding Counterparty rule (last-write-wins).

Rules always win over AI: the AI never overrides a rule-matched category.
