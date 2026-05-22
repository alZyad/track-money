# track-money

Domain language for a personal-finance app that parses bank statement PDFs (French "Relevé de compte" format, e.g. BNP Paribas, Société Générale, Crédit Agricole), lets the user categorize transactions, and visualizes monthly + cross-month flows.

## Language

**Statement**:
A monthly bank document covering one period. One PDF = one Statement.
_Avoid_: relevé, account summary, report

**Period**:
The start–end date range a Statement covers. Typically a calendar month, identified by `YYYY-MM`.
_Avoid_: month (ambiguous — calendar vs statement)

**Transaction (Tx)**:
A single accounting line on a Statement. Immutable, derived from the PDF.
_Avoid_: entry, line item, operation, écriture

**Direction**:
Whether a Transaction's amount is `in` (credit, money arrives) or `out` (debit, money leaves). From the account holder's perspective.
_Avoid_: sign, polarity, sense, type (overloaded)

**Counterparty**:
The other side of a Transaction — merchant, person, or organization. Extracted from line 1 of the LIBELLE block, with the type prefix stripped.
_Avoid_: payee, payer, merchant (only one role of counterparty)

**BankMemo**:
The bank-provided free-text purpose line for a Transaction. Sourced from the `LIBELLE:<text>` sub-line in the PDF, or for non-CB / non-FEE types the first bare continuation line. Distinguishes Transactions sharing the same Counterparty (e.g. Bouygues mobile vs landline).
_Avoid_: note, label, description, comment, memo (without the `bank` prefix — too generic)

**transactionIdentifier**:
The deterministic, lowercase string used as the rule-matching key for a Transaction. Format: `<counterparty>` if no BankMemo, else `<counterparty> - <bankMemo>`. Stable across Statements for recurring Transactions.
_Avoid_: key, signature, fingerprint, tx-id

**transactionRaw**:
The full LIBELLE block of a Transaction, joined with newlines, kept verbatim for safekeeping and audit.
_Avoid_: raw, blob, original

**Category**:
A budgetary bucket (e.g. Groceries, Rent). Each Tx whose identifier is matched by one of a Category's matchers belongs to that Category. Taxonomy is user-editable and may have one level of subcategories.
_Avoid_: tag, label, bucket, group

**Subcategory**:
A Category whose `parentId` references another Category. One level deep, no further nesting.
_Avoid_: child, sub-tag

**Matcher** (`transactionIdentifierMatcher`):
A substring of a `transactionIdentifier`, owned by a Category. Default = the full identifier (exact match). User shortens it to group similar Transactions (e.g. `aldi` covers all ALDI stores). A Tx is assigned to the Category whose matcher (across all Categories) is the longest substring of its identifier.
_Avoid_: pattern, regex, glob, rule (legacy term — see ADR-0006)

**Uncategorised**:
A virtual UI grouping (not a persisted Category) for Transactions whose `transactionIdentifier` is not matched by any matcher. Split into `Uncategorised-expense` and `Uncategorised-income` in the UI. Empties as the user adds matchers.
_Avoid_: unknown, other, misc (Misc is a real Category — see below)

**Workspace**:
The user's complete state: the currently loaded Statement + Category taxonomy (with their matchers). Persisted in the browser from v0.2.1 (localStorage + IndexedDB — see ADR-0008); migrated wholesale to Google Drive at v0.5. Pre-v0.2.1: in-memory only.
_Avoid_: account (this is single-user; no auth concept of account), profile, store

## Relationships

- A **Statement** has many **Transactions**
- A **Statement** covers exactly one **Period**
- A **Transaction** has exactly one **Direction**
- A **Transaction** has exactly one **Counterparty** and at most one **BankMemo**
- A **Category** owns zero or more **Matchers**
- A **Category** belongs to at most one parent **Category** (forming a **Subcategory**)
- A **Transaction** is assigned to the **Category** whose **Matcher** is the longest substring of its `transactionIdentifier`; with no match, the Tx is **Uncategorised**
- A **Workspace** owns at most one **Statement** at a time (pre-v0.5) and many **Categories**

## Invariants

- A **Transaction** has exactly one **Direction**: `in` or `out`. Never both, never zero.
- A **Transaction**'s amount is always positive; sign comes from **Direction**.
- For each **Statement**: `oldBalance + sum(in amounts) - sum(out amounts) = newBalance` (within rounding).
- Currency is always EUR. PDF format: `1 072,53` (space = thousands sep, comma = decimal).
- A **Matcher** is always lowercase, ≥ 2 characters, and a substring of some `transactionIdentifier`.
- Matchers may overlap across Categories. Resolution: longest substring wins; ties broken by Category array order. Overlaps are surfaced in the side panel conflicts section.
- **`Category.type` is required** (`'expense'`, `'income'`, or `'mixed'`). `'expense'` only accepts `out` Txs; `'income'` only accepts `in` Txs; `'mixed'` accepts both and aggregates them in a single group.
- **Direction mismatch is hard-blocked at the picker**: the inline Category picker on a Tx row filters to Categories that accept its direction (expense or mixed for `out`; income or mixed for `in`). A user cannot assign a Tx to an incompatible Category.
- **Categorisation is matcher-only** (see ADR-0006). There is no per-Tx override layer.

## Transaction types (bank prefixes)

Each **Transaction** has a `type` derived from the first word(s) of its LIBELLE block:

- **VIR INST** — instant transfer (SEPA Instant). Usually `in`.
- **VIR SEPA** — standard SEPA transfer.
- **VIR.PERMANENT** — standing order (recurring debit set up by the account holder).
- **VIREMENT** — generic transfer (often salary, rent income).
- **PRLV SEPA** — SEPA direct debit (creditor pulls funds; `out`).
- **CB** — card payment (carte bancaire). Always `out`.
- **FEE** — bank fees (`COTISATION MENSUELLE CARTE`, `ASSURANCE MOYEN DE PAIEMENT`).
- **OTHER** — anything that doesn't match.

## Date semantics

- **Operation date** (DATE column in PDF) — when the bank recorded the Transaction. The `date` field on a Tx.
- **Value date** (VALEUR column in PDF) — when the bank counts the funds for interest calc. Not exposed on the Tx; budgetary irrelevance for modern SEPA/CB.

## Default categories

Shipped with the app. All are deletable. All ship with **no matchers** — the user populates them as they go. Types are required.

| Name | Type | Notes |
|---|---|---|
| Rent | `expense` | Housing rent only. |
| Groceries | `expense` | Supermarkets, food retail. |
| Restaurant | `expense` | Eating out, food delivery, cafés. |
| Subscriptions | `expense` | Broad bucket: any recurring payment (streaming, gym, bank fees, insurance, telecom). User splits via subcategories if desired. |
| Transport | `expense` | Navigo, SNCF, flights, fuel, ride-hailing. |
| Salary | `income` | Primary work income. |
| Misc | `mixed` | User-owned miscellaneous bucket. Accepts both directions and sums them together. Empty by default. |

Edge cases that don't fit a single-direction default (e.g. a refund from a restaurant) land in **Misc** until the user creates a dedicated Category.

`Subscriptions` intentionally swallows what some apps split (Insurance, Banking fees, Entertainment); the user subdivides via Subcategories, not via top-level Categories.

Note: **Misc** ≠ **Uncategorised**. Misc is a real Category the user can populate with matchers. Uncategorised is the virtual UI group for Txs no matcher matched.

## Excluded rows

These appear in the LIBELLE column on the PDF but are **not Transactions** — they are Statement metadata:

- `ANCIEN SOLDE` — opening balance
- `TOTAUX` — period totals
- `SOLDE EN EUROS` — closing balance
- "Récapitulatif des frais" table — fee summary, redundant with FEE Transactions

## Example dialogue

> **User:** "Why is the Bouygues mobile bill in Subscriptions but my Bouygues landline isn't?"
>
> **App:** "Both lines share the **Counterparty** `Bouygues Telecom`, but their **BankMemos** differ (`07xxxxx363` vs `09xxxxx818`). That makes their **transactionIdentifiers** distinct. The Subscriptions Category has a matcher that hits the mobile identifier but not the landline one. Add a second matcher (or shorten the existing one) to cover both."

> **User:** "Can I make a category called `Refunds` for incoming money like rent deposits?"
>
> **App:** "Yes — create a **Category** named Refunds with `type: 'income'`. Pick the rent-deposit Tx and assign it to Refunds; that adds a matcher (the Tx's full `transactionIdentifier`) to Refunds, so future identical deposits auto-categorise. Shorten the matcher in the side panel to broaden the match."

## Flagged ambiguities

- **"label"** was previously used to mean both a user-editable text and the LIBELLE column from the PDF. Resolved: there is no user-editable label. The PDF's LIBELLE block decomposes into **Counterparty** + **BankMemo**.
- **"memo"** alone is too generic (could imply user-added). Resolved: the bank-provided memo is **BankMemo** (camelCase `bankMemo` in code, but conceptually distinct).
- **"category"** vs **"subcategory"**: a Subcategory is just a Category with a `parentId`. Same entity, different role.
- **"rule"** vs **"matcher"**: prior model had a `CounterpartyRule` entity. Resolved (ADR-0006): rules dissolve into `Matcher` strings owned by Categories. The word "rule" should not appear in new code or docs.
- **"Uncategorised"** vs **"Misc"**: Uncategorised is the virtual UI group for Txs no matcher matched. Misc-expense / Misc-income are real (default) Categories. Don't conflate.
- **"Refinement"**: removed (ADR-0006). The word should not appear in new code or docs.
