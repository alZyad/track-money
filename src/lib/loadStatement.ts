import { parseStatement } from './parsePdf'
import { retryIdb, sha256Hex } from './storage'
import type { IdbFailReason, IdbResult } from './storage'
import type { WorkspaceStore } from './workspace.svelte'

export type StorageAdapter = {
  putPdf: (hash: string, blob: Blob) => Promise<IdbResult<void>>
  deletePdf: (hash: string) => Promise<IdbResult<void>>
}

export type LoadResult =
  | { kind: 'ok' }
  | { kind: 'parse-error'; message: string }
  | { kind: 'ok-backup-failed'; reason: IdbFailReason }

/**
 * Choreographs ingestion of a new Statement PDF:
 *   parse → hash → drop previous backup → commit to workspace → write blob backup.
 *
 * Workspace state is committed before the backup write, so a backup failure
 * never blocks the user from seeing their parsed Statement.
 */
export async function loadStatement(
  file: File,
  workspace: WorkspaceStore,
  storage: StorageAdapter,
): Promise<LoadResult> {
  let parsed
  let hash: string
  try {
    const buf = await file.arrayBuffer()
    parsed = await parseStatement(new Uint8Array(buf))
    hash = await sha256Hex(buf)
  } catch (e) {
    return { kind: 'parse-error', message: e instanceof Error ? e.message : String(e) }
  }

  const prev = workspace.statement?.pdfHash
  if (prev && prev !== hash) {
    await storage.deletePdf(prev) // best effort; result ignored
  }
  workspace.setStatement({ pdfHash: hash, statement: parsed })

  const r = await retryIdb(() => storage.putPdf(hash, file), 3)
  if (r.ok) return { kind: 'ok' }
  console.error('[loadStatement] backup write failed', r.reason, r.error)
  return { kind: 'ok-backup-failed', reason: r.reason }
}
