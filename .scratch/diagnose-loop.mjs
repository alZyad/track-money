// Node harness: run parseStatement against example PDF.
// Usage: npx tsx .scratch/diagnose-loop.mjs [path-to-pdf]
import { readFile } from 'node:fs/promises'

const pdfPath = process.argv[2] || 'example/MONCOMPTE_01017395514_20260430.pdf'
const bytes = await readFile(pdfPath)

const { parseStatement } = await import('../src/lib/parsePdf.ts')
const stmt = await parseStatement(new Uint8Array(bytes))

const sumIn = stmt.txs.filter((t) => t.direction === 'in').reduce((s, t) => s + t.amount, 0)
const sumOut = stmt.txs.filter((t) => t.direction === 'out').reduce((s, t) => s + t.amount, 0)
const reconstructedBalance = stmt.oldBalance + sumIn - sumOut

console.log(JSON.stringify({
  periodStart: stmt.periodStart,
  periodEnd: stmt.periodEnd,
  oldBalance: stmt.oldBalance,
  newBalance: stmt.newBalance,
  txCount: stmt.txs.length,
  sumIn: +sumIn.toFixed(2),
  sumOut: +sumOut.toFixed(2),
  reconstructedBalance: +reconstructedBalance.toFixed(2),
  balanceMatches: Math.abs(reconstructedBalance - stmt.newBalance) < 0.01,
}, null, 2))
