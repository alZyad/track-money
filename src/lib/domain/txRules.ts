/**
 * Domain rules for turning raw LIBELLE text into Transaction semantics:
 * type detection, counterparty extraction, bank memo extraction, identifier
 * derivation. Pure functions over strings — no PDF concepts here.
 */

export type TxType =
  | 'VIR_INST'
  | 'VIR_SEPA'
  | 'VIR_PERM'
  | 'VIREMENT'
  | 'PRLV_SEPA'
  | 'CB'
  | 'FEE'
  | 'OTHER'

export function detectType(line: string): TxType {
  if (line.startsWith('VIR INST')) return 'VIR_INST'
  if (line.startsWith('VIR SEPA')) return 'VIR_SEPA'
  if (line.startsWith('VIR.PERMANENT') || line.startsWith('VIR PERMANENT')) return 'VIR_PERM'
  if (line.startsWith('VIREMENT')) return 'VIREMENT'
  if (line.startsWith('PRLV SEPA') || line.startsWith('PRLV')) return 'PRLV_SEPA'
  if (line.startsWith('CB ')) return 'CB'
  if (line.startsWith('COTISATION') || line.startsWith('ASSURANCE MOYEN')) return 'FEE'
  return 'OTHER'
}

export function extractCounterparty(firstLine: string, type: TxType): string {
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

export function extractBankMemo(lines: string[], type: TxType): string | undefined {
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

export function buildIdentifier(counterparty: string, bankMemo?: string): string {
  const raw = bankMemo ? `${counterparty} - ${bankMemo}` : counterparty
  return raw.toLowerCase()
}
