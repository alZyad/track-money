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

## `Refinement`

User's category assignment for a Tx. Mutable. Layered on top of the Tx.

```ts
type Refinement = {
  txId: string         // SHA1 — see docs/processes.md § Tx identity
  categoryId: string
}
```

## `Category`

A budgetary bucket. Default set ships with the app; user-extensible.

```ts
type Category = {
  id: string
  name: string
  parentId?: string              // present iff this is a subcategory
  type?: 'expense' | 'income'    // omit for "either"
}

// type ↔ Tx.direction mapping:
//   'expense' → only Txs with direction 'out'
//   'income'  → only Txs with direction 'in'
```

Default categories (see `CONTEXT.md` § Default categories for semantics):

```ts
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'rent',          name: 'Rent',          type: 'expense' },
  { id: 'groceries',     name: 'Groceries' },
  { id: 'restaurant',    name: 'Restaurant' },
  { id: 'subscriptions', name: 'Subscriptions' },
  { id: 'transport',     name: 'Transport' },
  { id: 'salary',        name: 'Salary',        type: 'income' },
  { id: 'other',         name: 'Other' },
]
```

## `CounterpartyRule`

Learned mapping from a `transactionIdentifier` substring to a Category.

```ts
type CounterpartyRule = {
  transactionIdentifierMatcher: string  // substring of identifier; default = full identifier
  categoryId: string
}
```

## `Workspace`

Top-level user state. From v0.5 persisted in Google Drive; before that, in-memory only.

```ts
type Workspace = {
  statements: Record<`${number}-${string}`, StoredStatement>  // key = "YYYY-MM"
  refinements: Refinement[]
  categories: Category[]
  rules: CounterpartyRule[]
}

type StoredStatement = {
  pdfBlob: Blob       // original PDF, kept verbatim
  pdfHash: string     // SHA-256 of the bytes, for duplicate detection
  statement: Statement
}
```

## What's implemented today (MVP)

Only `Statement` and `Tx` are produced by the parser (`src/lib/parsePdf.ts`). The other types are shape-defined here but have no runtime equivalent until v0.2+.
