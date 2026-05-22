import type { PersistedWorkspace } from './types'
import { SCHEMA_VERSION } from './types'

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
  } catch (e) {
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

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
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
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, mode)
    const store = tx.objectStore(IDB_STORE)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function putPdf(hash: string, blob: Blob): Promise<void> {
  await withStore('readwrite', (s) => s.put(blob, hash))
}

export async function getPdf(hash: string): Promise<Blob | null> {
  const v = await withStore<Blob | undefined>('readonly', (s) => s.get(hash) as IDBRequest<Blob | undefined>)
  return v ?? null
}

export async function deletePdf(hash: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(hash))
}

export async function clearAllPdfs(): Promise<void> {
  await withStore('readwrite', (s) => s.clear())
}

export async function hasPdf(hash: string): Promise<boolean> {
  const v = await withStore<number>('readonly', (s) => s.count(hash))
  return v > 0
}

// --------- Combined wipe ---------

export async function wipeAll(): Promise<void> {
  clearWorkspaceSync()
  try {
    await clearAllPdfs()
  } catch {
    // best effort
  }
}

// --------- Helpers ---------

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

export async function retry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}
