// pdfjs is imported lazily inside parseStatement so we can pick the
// browser build (main) vs Node build (legacy) at runtime.
type PdfjsLike = {
  getDocument: (src: { data: ArrayBuffer | Uint8Array }) => {
    promise: Promise<{
      numPages: number
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str?: string; transform: number[]; width?: number }> }>
      }>
    }>
  }
}

export type TxType =
  | 'VIR_INST'
  | 'VIR_SEPA'
  | 'VIR_PERM'
  | 'VIREMENT'
  | 'PRLV_SEPA'
  | 'CB'
  | 'FEE'
  | 'OTHER'

export type Tx = {
  date: string
  type: TxType
  transactionIdentifier: string
  transactionRaw: string
  amount: number
  direction: 'in' | 'out'
}

export type Statement = {
  periodStart: string
  periodEnd: string
  oldBalance: number
  newBalance: number
  txs: Tx[]
}

type Item = { str: string; x: number; y: number; w: number }

const DATE_RE = /^\d{2}\.\d{2}$/
const VDATE_RE = /^\d{2}\.\d{2}\.\d{2}$/
const AMOUNT_RE = /^-?\d{1,3}(?:\s\d{3})*(?:,\d{2})\.?$/
const PERIOD_RE = /du\s+(\d{2}\.\d{2}\.\d{4})\s+au\s+(\d{2}\.\d{2}\.\d{4})/

async function loadItems(pdfjs: PdfjsLike, buf: ArrayBuffer | Uint8Array): Promise<Item[][]> {
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const pages: Item[][] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const tc = await page.getTextContent()
    const items: Item[] = tc.items
      .map((it: any) => ({
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

function groupRows(items: Item[], yTol = 2): Item[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: Item[][] = []
  for (const it of sorted) {
    const last = rows[rows.length - 1]
    if (last && Math.abs(last[0].y - it.y) <= yTol) last.push(it)
    else rows.push([it])
  }
  return rows.map((r) => r.sort((a, b) => a.x - b.x))
}

function findColumns(rows: Item[][]) {
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

type Cols = NonNullable<ReturnType<typeof findColumns>>

function classify(row: Item[], cols: Cols) {
  const buckets = {
    date: [] as Item[],
    lib: [] as Item[],
    val: [] as Item[],
    deb: [] as Item[],
    cred: [] as Item[],
  }
  // Column LEFT edges. The LIBELLE header label is right-shifted from the
  // actual LIBELLE column start (data sits well left of the label), so we use
  // a narrow DATE column and let LIBELLE fill the gap up to VALEUR.
  const DATE_RIGHT = cols.date + 30
  for (const it of row) {
    if (it.x < DATE_RIGHT) buckets.date.push(it)
    else if (it.x < cols.val) buckets.lib.push(it)
    else if (it.x < cols.deb) buckets.val.push(it)
    else if (it.x < cols.cred) buckets.deb.push(it)
    else buckets.cred.push(it)
  }
  return buckets
}

function joinStr(items: Item[]) {
  return items.map((i) => i.str).join(' ').trim()
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/\s/g, '').replace(',', '.').replace(/\.$/, ''))
}

function parseDate(dd_mm: string, year: number): string {
  const [d, m] = dd_mm.split('.')
  return `${year}-${m}-${d}`
}

function detectType(line: string): TxType {
  if (line.startsWith('VIR INST')) return 'VIR_INST'
  if (line.startsWith('VIR SEPA')) return 'VIR_SEPA'
  if (line.startsWith('VIR.PERMANENT') || line.startsWith('VIR PERMANENT')) return 'VIR_PERM'
  if (line.startsWith('VIREMENT')) return 'VIREMENT'
  if (line.startsWith('PRLV SEPA') || line.startsWith('PRLV')) return 'PRLV_SEPA'
  if (line.startsWith('CB ')) return 'CB'
  if (line.startsWith('COTISATION') || line.startsWith('ASSURANCE MOYEN')) return 'FEE'
  return 'OTHER'
}

function extractCounterparty(firstLine: string, type: TxType): string {
  switch (type) {
    case 'VIR_INST':
      return firstLine.replace(/^VIR INST\s*/, '').trim() || firstLine
    case 'VIR_SEPA':
      return firstLine.replace(/^VIR SEPA\s*/, '').trim()
    case 'VIR_PERM':
      return firstLine.replace(/^VIR\.?PERMANENT\s*/, '').trim()
    case 'VIREMENT':
      return firstLine.replace(/^VIREMENT\s*/, '').trim()
    case 'PRLV_SEPA':
      return firstLine.replace(/^PRLV\s*SEPA\s*/, '').trim()
    case 'CB':
      return firstLine.replace(/^CB\s*/, '').replace(/\s+\d{2}\/\d{2}\/\d{2}$/, '').trim()
    default:
      return firstLine
  }
}

const KNOWN_LABELS = /^(REF\.CLIENT|ID\.CREANCIER|REF\.MANDAT|NATURE DU PAIEMENT|CREANCIER INITIAL|LIBELLE):/

function extractBankMemo(lines: string[], type: TxType): string | undefined {
  for (const line of lines) {
    const m = line.match(/^LIBELLE:(.+)$/)
    if (m) return m[1].trim()
  }
  if (type === 'CB' || type === 'FEE' || type === 'OTHER') return undefined
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    if (KNOWN_LABELS.test(line)) continue
    return line.trim()
  }
  return undefined
}

function buildIdentifier(counterparty: string, bankMemo?: string): string {
  const raw = bankMemo ? `${counterparty} - ${bankMemo}` : counterparty
  return raw.toLowerCase()
}

async function defaultPdfjs(): Promise<PdfjsLike> {
  const g = globalThis as { process?: { versions?: { node?: string } } }
  const isNode = !!g.process?.versions?.node
  const mod = isNode
    ? await import('pdfjs-dist/legacy/build/pdf.mjs' as string)
    : await import('pdfjs-dist')
  return mod as unknown as PdfjsLike
}

export async function parseStatement(
  input: File | ArrayBuffer | Uint8Array,
  pdfjs?: PdfjsLike,
): Promise<Statement> {
  const buf = input instanceof File ? await input.arrayBuffer() : input
  const lib = pdfjs ?? (await defaultPdfjs())
  const pages = await loadItems(lib, buf)

  let periodStart = ''
  let periodEnd = ''
  let year = new Date().getFullYear()
  for (const items of pages) {
    const text = items.map((i) => i.str).join(' ')
    const m = text.match(PERIOD_RE)
    if (m) {
      periodStart = m[1]
      periodEnd = m[2]
      year = parseInt(m[2].slice(-4), 10)
      break
    }
  }

  type RawRow = { date?: string; lib: string; val?: string; deb?: number; cred?: number; y: number }
  const rawRows: RawRow[] = []

  for (const items of pages) {
    const rows = groupRows(items)
    const cols = findColumns(rows)
    if (!cols) continue

    for (const row of rows) {
      const b = classify(row, cols)
      const dateStr = joinStr(b.date)
      const valStr = joinStr(b.val)
      const libStr = joinStr(b.lib)
      const debStr = joinStr(b.deb)
      const credStr = joinStr(b.cred)

      const isDate = DATE_RE.test(dateStr)
      const isVal = VDATE_RE.test(valStr)

      if (!isDate && !libStr) continue
      if (libStr === 'LIBELLE' || libStr.startsWith('ECRITURES')) continue
      if (libStr.includes('ANCIEN SOLDE') || libStr.includes('SOLDE EN EUROS') || libStr.includes('TOTAUX')) continue
      if (libStr.startsWith('Page ')) continue

      rawRows.push({
        date: isDate ? dateStr : undefined,
        lib: libStr,
        val: isVal ? valStr : undefined,
        deb: AMOUNT_RE.test(debStr) ? parseAmount(debStr) : undefined,
        cred: AMOUNT_RE.test(credStr) ? parseAmount(credStr) : undefined,
        y: row[0]?.y ?? 0,
      })
    }
  }

  const txs: Tx[] = []
  let current: { row: RawRow; lines: string[] } | null = null

  const flush = () => {
    if (!current) return
    const r = current.row
    if (!r.date || !r.val || (r.deb == null && r.cred == null)) {
      current = null
      return
    }
    const firstLine = current.lines[0] ?? ''
    const type = detectType(firstLine)
    const bankMemo = extractBankMemo(current.lines, type)
    const counterparty = extractCounterparty(firstLine, type)
    const amount = (r.deb ?? r.cred)!
    txs.push({
      date: parseDate(r.date, year),
      type,
      transactionRaw: current.lines.join('\n'),
      transactionIdentifier: buildIdentifier(counterparty, bankMemo),
      amount,
      direction: r.deb != null ? 'out' : 'in',
    })
    current = null
  }

  for (const r of rawRows) {
    if (r.date) {
      flush()
      current = { row: r, lines: r.lib ? [r.lib] : [] }
    } else if (current) {
      if (r.lib) current.lines.push(r.lib)
    }
  }
  flush()

  let oldBalance = 0
  let newBalance = 0
  for (const items of pages) {
    const rows = groupRows(items)
    const cols = findColumns(rows)
    if (!cols) continue
    for (const row of rows) {
      const b = classify(row, cols)
      const lib = joinStr(b.lib)
      const cred = joinStr(b.cred)
      if (lib.includes('ANCIEN SOLDE') && AMOUNT_RE.test(cred)) oldBalance = parseAmount(cred)
      if (lib.includes('SOLDE EN EUROS') && AMOUNT_RE.test(cred)) newBalance = parseAmount(cred)
    }
  }

  return { periodStart, periodEnd, oldBalance, newBalance, txs }
}
