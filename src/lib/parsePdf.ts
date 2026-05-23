import type { PdfjsLike } from './pdfTransport'
import { classify, defaultPdfjs, findColumns, groupRows, joinStr, loadItems } from './pdfTransport'
import type { TxType } from './txRules'
import { buildIdentifier, detectType, extractBankMemo, extractCounterparty } from './txRules'

export type { TxType } from './txRules'

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

const DATE_RE = /^\d{2}\.\d{2}$/
const VDATE_RE = /^\d{2}\.\d{2}\.\d{2}$/
const AMOUNT_RE = /^-?\d{1,3}(?:\s\d{3})*(?:,\d{2})\.?$/
const PERIOD_RE = /du\s+(\d{2}\.\d{2}\.\d{4})\s+au\s+(\d{2}\.\d{2}\.\d{4})/

function parseAmount(s: string): number {
  return parseFloat(s.replace(/\s/g, '').replace(',', '.').replace(/\.$/, ''))
}

function parseDate(dd_mm: string, year: number): string {
  const [d, m] = dd_mm.split('.')
  return `${year}-${m}-${d}`
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
