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

**Refinement**:
The user's category assignment for a Transaction: `{ txId, categoryId }`. Layered on top of the Tx; never mutates it.
_Avoid_: edit, override, annotation, classification

**Category**:
A budgetary bucket (e.g. Groceries, Rent). Each refined Tx has at most one Category. Taxonomy is user-editable and may have one level of subcategories.
_Avoid_: tag, label, bucket, group

**Subcategory**:
A Category whose `parentId` references another Category. One level deep, no further nesting.
_Avoid_: child, sub-tag

**Counterparty rule**:
A learned `(transactionIdentifierMatcher → categoryId)` mapping that pre-fills a Category for incoming Transactions whose `transactionIdentifier` contains the matcher.
_Avoid_: heuristic, classifier, mapping

**transactionIdentifierMatcher**:
A substring of a `transactionIdentifier`. Default = the full identifier (exact match). User can shorten it to group similar transactions (e.g. `aldi` covers all ALDI stores).
_Avoid_: pattern, regex, glob

**Workspace**:
The user's complete state: Statements + Refinements + Category taxonomy + Counterparty rules. Persisted in Google Drive from v0.5; before that, in-memory only.
_Avoid_: account (this is single-user; no auth concept of account), profile, store

## Relationships

- A **Statement** has many **Transactions**
- A **Statement** covers exactly one **Period**
- A **Transaction** has exactly one **Direction**
- A **Transaction** has exactly one **Counterparty** and at most one **BankMemo**
- A **Transaction** has at most one **Refinement** (a Tx with no Refinement is uncategorised)
- A **Refinement** references exactly one **Category**
- A **Category** belongs to at most one parent **Category** (forming a **Subcategory**)
- A **Counterparty rule** maps to exactly one **Category**
- A **Workspace** owns many **Statements**, **Refinements**, **Categories**, and **Counterparty rules**

## Invariants

- A **Transaction** has exactly one **Direction**: `in` or `out`. Never both, never zero.
- A **Transaction**'s amount is always positive; sign comes from **Direction**.
- For each **Statement**: `oldBalance + sum(in amounts) - sum(out amounts) = newBalance` (within rounding).
- Currency is always EUR. PDF format: `1 072,53` (space = thousands sep, comma = decimal).
- A **Refinement** survives re-parsing the same Statement, because **Tx identity** is deterministic (see `docs/processes.md`).
- A **Counterparty rule**'s matcher is always a substring of some `transactionIdentifier`; both are lowercase.
- A **Category** with `type: 'expense'` only accepts `out` Txs; `type: 'income'` only accepts `in` Txs; omit `type` for either. Default `Rent` is `expense`; default `Salary` is `income`.
- **Refinement assignment is hard-blocked on type mismatch**: a Refinement linking a Tx to a Category whose `type` contradicts the Tx's `direction` is rejected (UI hides incompatible Categories from the picker; programmatic creation throws).

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

Shipped with the app. User can rename, delete, or add to them.

| Name | Type | Notes |
|---|---|---|
| Rent | `expense` | Housing rent only. |
| Groceries | either | Supermarkets, food retail. |
| Restaurant | either | Eating out, food delivery, cafés. |
| Subscriptions | either | Broad bucket: any recurring payment (streaming, gym, bank fees, insurance, telecom). User splits via subcategories if desired. |
| Transport | either | Navigo, SNCF, flights, fuel, ride-hailing. |
| Salary | `income` | Primary work income. |
| Other | either | Fallback for anything not categorised. |

`Subscriptions` intentionally swallows what some apps split (Insurance, Banking fees, Entertainment); the user subdivides via Subcategories, not via top-level Categories.

## Excluded rows

These appear in the LIBELLE column on the PDF but are **not Transactions** — they are Statement metadata:

- `ANCIEN SOLDE` — opening balance
- `TOTAUX` — period totals
- `SOLDE EN EUROS` — closing balance
- "Récapitulatif des frais" table — fee summary, redundant with FEE Transactions

## Example dialogue

> **User:** "Why is the Bouygues mobile bill in Subscriptions but my Bouygues landline isn't?"
>
> **App:** "Both lines share the **Counterparty** `Bouygues Telecom`, but their **BankMemos** differ (`07xxxxx363` vs `09xxxxx818`). That makes their **transactionIdentifiers** distinct, so they map to two separate **Counterparty rules**. You categorised the mobile one but not the landline."

> **User:** "Can I make a category called `Refunds` for incoming money like rent deposits?"
>
> **App:** "Yes — create a **Category** named Refunds with `type: 'income'`. The rent-deposit Transaction will fit; assigning it via a **Refinement** also creates a **Counterparty rule** so future deposits auto-categorise."

## Flagged ambiguities

- **"label"** was previously used to mean both a user-editable text and the LIBELLE column from the PDF. Resolved: there is no user-editable label (Refinements only carry a categoryId). The PDF's LIBELLE block decomposes into **Counterparty** + **BankMemo**.
- **"memo"** alone is too generic (could imply user-added). Resolved: the bank-provided memo is **BankMemo** (camelCase `bankMemo` in code, but conceptually distinct).
- **"category"** vs **"subcategory"**: a Subcategory is just a Category with a `parentId`. Same entity, different role.
