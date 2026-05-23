import { parseStatement } from './parsePdf'
import { sha256Hex, retry } from './storage'
import type { WorkspaceStore } from './workspace.svelte'

export type StorageAdapter = {
  putPdf: (hash: string, blob: Blob) => Promise<void>
  deletePdf: (hash: string) => Promise<void>
}

export type LoadResult =
  | { kind: 'ok' }
  | { kind: 'parse-error'; message: string }
  | { kind: 'ok-backup-failed' }

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
    try { await storage.deletePdf(prev) } catch { /* best effort */ }
  }
  workspace.setStatement({ pdfHash: hash, statement: parsed })

  try {
    await retry(() => storage.putPdf(hash, file), 3)
    return { kind: 'ok' }
  } catch (e) {
    console.error('[loadStatement] backup write failed', e)
    return { kind: 'ok-backup-failed' }
  }
}
