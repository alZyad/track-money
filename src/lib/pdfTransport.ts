/**
 * Transport layer for the French bank-statement PDF format. Concerned with
 * pdfjs item loading and positional reconstruction of rows/columns. Knows
 * nothing about Transaction semantics (type detection, counterparty
 * extraction, etc.) — that lives in `txRules.ts`.
 */

export type PdfjsLike = {
  getDocument: (src: { data: ArrayBuffer | Uint8Array }) => {
    promise: Promise<{
      numPages: number
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str?: string; transform: number[]; width?: number }> }>
      }>
    }>
  }
}

export type Item = { str: string; x: number; y: number; w: number }

export type Columns = {
  date: number
  lib: number
  val: number
  deb: number
  cred: number
}

/** Cell buckets for a single positional row, sliced by column boundaries. */
export type RowBuckets = {
  date: Item[]
  lib: Item[]
  val: Item[]
  deb: Item[]
  cred: Item[]
}

export async function loadItems(
  pdfjs: PdfjsLike,
  buf: ArrayBuffer | Uint8Array,
): Promise<Item[][]> {
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const pages: Item[][] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const tc = await page.getTextContent()
    const items: Item[] = tc.items
      .map((it: { str?: string; transform: number[]; width?: number }) => ({
        str: (it.str ?? '').trim(),
        x: it.transform[4],
        y: it.transform[5],
        w: it.width ?? 0,
      }))
      .filter((it: Item) => it.str.length > 0)
    pages.push(items)
  }
  return pages
}

export function groupRows(items: Item[], yTol = 2): Item[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: Item[][] = []
  for (const it of sorted) {
    const last = rows[rows.length - 1]
    if (last && Math.abs(last[0].y - it.y) <= yTol) last.push(it)
    else rows.push([it])
  }
  return rows.map((r) => r.sort((a, b) => a.x - b.x))
}

export function findColumns(rows: Item[][]): Columns | null {
  for (const row of rows) {
    const text = row.map((i) => i.str).join('|')
    if (
      text.includes('DATE') &&
      text.includes('LIBELLE') &&
      text.includes('VALEUR') &&
      text.includes('DEBIT') &&
      text.includes('CREDIT')
    ) {
      const find = (label: string) => row.find((i) => i.str === label)?.x ?? -1
      return {
        date: find('DATE'),
        lib: find('LIBELLE'),
        val: find('VALEUR'),
        deb: find('DEBIT'),
        cred: find('CREDIT'),
      }
    }
  }
  return null
}

export function classify(row: Item[], cols: Columns): RowBuckets {
  const b: RowBuckets = { date: [], lib: [], val: [], deb: [], cred: [] }
  // The LIBELLE header label is right-shifted from the actual LIBELLE column
  // start (data sits well left of the label), so we use a narrow DATE column
  // and let LIBELLE fill the gap up to VALEUR.
  const DATE_RIGHT = cols.date + 30
  for (const it of row) {
    if (it.x < DATE_RIGHT) b.date.push(it)
    else if (it.x < cols.val) b.lib.push(it)
    else if (it.x < cols.deb) b.val.push(it)
    else if (it.x < cols.cred) b.deb.push(it)
    else b.cred.push(it)
  }
  return b
}

export function joinStr(items: Item[]): string {
  return items.map((i) => i.str).join(' ').trim()
}

export async function defaultPdfjs(): Promise<PdfjsLike> {
  const g = globalThis as { process?: { versions?: { node?: string } } }
  const isNode = !!g.process?.versions?.node
  const mod = isNode
    ? await import('pdfjs-dist/legacy/build/pdf.mjs' as string)
    : await import('pdfjs-dist')
  return mod as unknown as PdfjsLike
}
