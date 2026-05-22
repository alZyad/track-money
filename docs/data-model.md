# Data model

Concrete TypeScript shapes for the entities defined in `CONTEXT.md`. All types are app-internal; see `docs/processes.md` for the algorithms that produce/consume them.

## `Statement`

One parsed PDF.

```ts
type Statement = {
  periodStart: string  // "DD.MM.YYYY"
  periodEnd: string    // "DD.MM.YYYY"
  oldBalance: number
  newBalance: number
  txs: Tx[]
}
```

## `Tx`

One parsed Transaction. Immutable. Derived purely from the PDF.

```ts
type Tx = {
  date: string                    // "YYYY-MM-DD" (operation date)
  type: TxType
  transactionIdentifier: string   // lowercase, "<counterparty>" or "<counterparty> - <bankMemo>"
  transactionRaw: string          // full LIBELLE block, verbatim, newline-joined
  amount: number                  // positive
  direction: 'in' | 'out'
}

type TxType =
  | 'VIR_INST'
  | 'VIR_SEPA'
  | 'VIR_PERM'
  | 'VIREMENT'
  | 'PRLV_SEPA'
  | 'CB'
  | 'FEE'
  | 'OTHER'
```

## `Category`

A budgetary bucket. Owns its matchers directly. Default set ships with the app; user-extensible.

```ts
type Category = {
  id: string
  name: string
  parentId?: string                              // present iff this is a subcategory
  type: 'expense' | 'income' | 'mixed'           // required — see ADR-0006, ADR-0007
  matchers: string[]                             // substrings of transactionIdentifier; lowercase
}

// type ↔ Tx.direction mapping:
//   'expense' → only Txs with direction 'out'
//   'income'  → only Txs with direction 'in'
//   'mixed'   → both directions accepted; the Category aggregates in + out together
```

A Tx is assigned to the Category whose matcher (across all Categories) is the longest substring of `tx.transactionIdentifier`. Length ties broken by Category array order. No match → Uncategorised UI group.

Default categories (see `CONTEXT.md` § Default categories). All ship with `matchers: []`.

```ts
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'rent',          name: 'Rent',          type: 'expense', matchers: [] },
  { id: 'groceries',     name: 'Groceries',     type: 'expense', matchers: [] },
  { id: 'restaurant',    name: 'Restaurant',    type: 'expense', matchers: [] },
  { id: 'subscriptions', name: 'Subscriptions', type: 'expense', matchers: [] },
  { id: 'transport',     name: 'Transport',     type: 'expense', matchers: [] },
  { id: 'salary',        name: 'Salary',        type: 'income',  matchers: [] },
  { id: 'misc',          name: 'Misc',          type: 'mixed',   matchers: [] },
]
```

## `Workspace`

Top-level user state. From v0.5 persisted in Google Drive; before that, in-memory only.

```ts
type Workspace = {
  statements: Record<`${number}-${string}`, StoredStatement>  // key = "YYYY-MM"
  categories: Category[]
}

type StoredStatement = {
  pdfBlob: Blob       // original PDF, kept verbatim
  pdfHash: string     // SHA-256 of the bytes, for duplicate detection
  statement: Statement
}
```

Note: there is no `refinements` field and no `rules` field. Categorisation is matcher-only (see ADR-0006); matchers live inside `Category.matchers`.

## What's implemented today (MVP, post-v0.1)

Only `Statement` and `Tx` are produced by the parser (`src/lib/parsePdf.ts`). `Category` and `Workspace` are shape-defined here; their runtime representation lands in v0.2.
