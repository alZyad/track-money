import type { PersistedWorkspace } from '../domain/types'
import { SCHEMA_VERSION } from '../domain/types'

const LS_KEY = 'track-money:workspace'
const IDB_NAME = 'track-money'
const IDB_STORE = 'pdfs'
const IDB_VERSION = 1

// --------- localStorage Workspace JSON ---------

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'ok'; workspace: PersistedWorkspace }
  | { kind: 'error'; reason: string }

export function loadWorkspaceSync(): LoadResult {
  let raw: string | null
  try {
    raw = localStorage.getItem(LS_KEY)
  } catch {
    return { kind: 'error', reason: 'localStorage read failed' }
  }
  if (raw === null) return { kind: 'empty' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { kind: 'error', reason: 'Saved data is corrupt' }
  }
  if (!isPersistedWorkspace(parsed)) {
    return { kind: 'error', reason: 'Saved data is invalid' }
  }
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    return { kind: 'error', reason: 'Saved data is from an older version' }
  }
  return { kind: 'ok', workspace: parsed }
}

export function saveWorkspaceSync(w: PersistedWorkspace) {
  localStorage.setItem(LS_KEY, JSON.stringify(w))
}

export function clearWorkspaceSync() {
  localStorage.removeItem(LS_KEY)
}

function isPersistedWorkspace(x: unknown): x is PersistedWorkspace {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.schemaVersion === 'number' &&
    Array.isArray(o.categories) &&
    (o.statement === null || typeof o.statement === 'object')
  )
}

// --------- IndexedDB PDF blob store ---------

/**
 * Typed failure modes for IDB ops. `transient` is the only reason worth
 * retrying — quota/unsupported won't fix themselves.
 */
export type IdbFailReason = 'quota' | 'unsupported' | 'transient' | 'unknown'

export type IdbResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: IdbFailReason; error: unknown }

function classifyIdbError(e: unknown): IdbFailReason {
  if (e instanceof DOMException) {
    switch (e.name) {
      case 'QuotaExceededError':
        return 'quota'
      case 'InvalidStateError':
      case 'NotSupportedError':
      case 'SecurityError':
        return 'unsupported'
      case 'TransactionInactiveError':
      case 'AbortError':
      case 'UnknownError':
        return 'transient'
    }
  }
  if (typeof indexedDB === 'undefined') return 'unsupported'
  return 'unknown'
}

function fail<T>(error: unknown): IdbResult<T> {
  return { ok: false, reason: classifyIdbError(error), error }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new DOMException('IndexedDB not available', 'NotSupportedError'))
      return
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<IdbResult<T>> {
  let db: IDBDatabase
  try {
    db = await openDb()
  } catch (e) {
    return fail(e)
  }
  return new Promise<IdbResult<T>>((resolve) => {
    const tx = db.transaction(IDB_STORE, mode)
    const store = tx.objectStore(IDB_STORE)
    const req = fn(store)
    req.onsuccess = () => resolve({ ok: true, value: req.result })
    req.onerror = () => resolve(fail(req.error))
    tx.oncomplete = () => db.close()
    tx.onerror = () => {
      db.close()
      resolve(fail(tx.error))
    }
  })
}

export function putPdf(hash: string, blob: Blob): Promise<IdbResult<void>> {
  return withStore('readwrite', (s) => s.put(blob, hash) as IDBRequest<unknown> as IDBRequest<void>)
}

export async function getPdf(hash: string): Promise<IdbResult<Blob | null>> {
  const r = await withStore<Blob | undefined>('readonly', (s) => s.get(hash) as IDBRequest<Blob | undefined>)
  if (!r.ok) return r
  return { ok: true, value: r.value ?? null }
}

export function deletePdf(hash: string): Promise<IdbResult<void>> {
  return withStore('readwrite', (s) => s.delete(hash) as IDBRequest<unknown> as IDBRequest<void>)
}

export function clearAllPdfs(): Promise<IdbResult<void>> {
  return withStore('readwrite', (s) => s.clear() as IDBRequest<unknown> as IDBRequest<void>)
}

export async function hasPdf(hash: string): Promise<IdbResult<boolean>> {
  const r = await withStore<number>('readonly', (s) => s.count(hash))
  if (!r.ok) return r
  return { ok: true, value: r.value > 0 }
}

// --------- Combined wipe ---------

export async function wipeAll(): Promise<void> {
  clearWorkspaceSync()
  await clearAllPdfs() // best effort; result ignored
}

// --------- Helpers ---------

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

/**
 * Retry a typed-result IDB op. Only retries on `transient` failures —
 * quota/unsupported are permanent, retrying just delays the surfaced error.
 */
export async function retryIdb<T>(
  fn: () => Promise<IdbResult<T>>,
  attempts: number,
): Promise<IdbResult<T>> {
  let last: IdbResult<T> | null = null
  for (let i = 0; i < attempts; i++) {
    last = await fn()
    if (last.ok) return last
    if (last.reason !== 'transient') return last
  }
  return last!
}
