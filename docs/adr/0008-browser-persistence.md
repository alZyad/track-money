# ADR-0008: Browser persistence (hybrid localStorage + IndexedDB) for v0.2.1

Date: 2026-05-22
Status: Accepted (partially supersedes ADR-0005 for the pre-v0.5 era)

## Context

ADR-0005 stated: pre-v0.5 is in-memory only, with no `localStorage` /
IndexedDB stop-gap. The rationale was that Drive should be the *single*
persistence layer and stop-gaps create migration tax.

Since then v0.2 (Refinement page) shipped. Without persistence, every
browser refresh wipes the manually-built matchers + category taxonomy. The
app is unusable between sessions, well before v0.5 (Drive) is in scope.

Drive integration is several versions away. Closing the gap requires a
browser-only persistence layer for v0.2.1.

The user constraint: **one storage layer at a time, never both at once**.
v0.2.1 browser storage is fully replaced at v0.5 via a one-shot migration.
Syncing between the two is out of scope.

## Decision

Introduce a hybrid browser persistence model:

- **`localStorage["track-money:workspace"]`** — single JSON blob holding the
  full Workspace (categories with their matchers, the single current
  Statement with its parsed Txs, plus `pdfHash` pointing into IDB,
  `schemaVersion: 1`). Sync read on app boot. Immediate write on every
  mutation. Small payloads (~10-50 KB per Statement) mean writes are
  fast enough not to need debouncing.
- **IndexedDB object store `pdfs`** — write-once archive of the raw PDF
  bytes, keyed by `pdfHash`. Used solely as backup for re-parse / export
  scenarios. Not read at app boot; the parsed Txs in the Workspace JSON
  drive normal operation.

Only one Statement is ever persisted. New upload **replaces** the previous
one in both stores atomically (localStorage first, then IDB delete + write
of the new blob). Categories and matchers survive replacements.

PDF blob writes retry **2 times** on failure; persistent failure surfaces
as a toast but does not block the upload — the parsed Statement still
hydrates from the Workspace JSON.

### Boot policy

- Empty → first-run flow.
- Valid JSON + `schemaVersion === 1` → hydrate.
- Corrupt JSON or `schemaVersion` mismatch → **wipe both stores + toast**.
  No migration code until a real schema-v2 exists with users on v1.
- Valid JSON but IDB blob missing → hydrate the Statement normally + toast
  warning. The backup is gone but the app still works.

### No user-facing reset

A "clear all data" button isn't shipped. Starting fresh = uploading a new
Statement, which replaces wholesale.

### Toast system

A small toast queue + `<Toaster />` component is introduced as part of
v0.2.1 because multiple persistence flows need to surface non-blocking
errors. Severities: error / warn / info; auto-dismiss ~4s; click to
dismiss early.

### Persistence status indicator

Reserved top-right slot. Surfaces "persistence healthy / write failing /
backup missing" state. Detailed design deferred — captured in
`.scratch/open-questions.md`.

## Consequences

- **Data model split.** `Workspace.statement` becomes singular and nullable
  (replacing `Workspace.statements: Record<…>`). `StoredStatement.pdfBlob`
  is removed from the in-memory shape — the blob lives in IDB, referenced
  by `pdfHash`. `schemaVersion: number` is added to the persisted shape.
- **v0.5 migration** is one-way and one-shot: on first successful Drive
  auth, drain localStorage + IDB into Drive, then disable browser writes.
  Concurrency between the two layers is explicitly out of scope.
- **No multi-statement persistence pre-v0.5.** Combined with v0.4 staying
  session-scoped, multi-month visualisations only get cross-session memory
  when Drive lands.
- **ADR-0005 supersession.** The "no localStorage stop-gap" line in
  ADR-0005 is overruled for the pre-Drive era. Drive remains the
  long-term source of truth.

## Alternatives considered

- **localStorage only** (PDFs base64-encoded). Rejected: 5 MB origin
  quota means ~25-40 statements before failure; sync writes on
  base64-encoded blobs would jank the main thread. Quota headroom and
  Blob-native storage make IDB the right home for binary.
- **IndexedDB only** (Workspace + PDFs both in IDB). Rejected: sync
  hydration of Workspace at boot is meaningfully simpler with
  localStorage, and the user explicitly likes the inspectable JSON for
  dev. Worth the small cross-store complexity since the stores have
  different access patterns (hot/cold).
- **Keep ADR-0005's in-memory rule until Drive lands.** Rejected: too
  long without persistence to be usable between sessions.
- **Migrate-on-version-bump from the start.** Rejected as premature.
  Wipe-on-mismatch is honest about the lack of real users on v1.
