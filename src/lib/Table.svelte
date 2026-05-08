<script lang="ts">
  import type { Tx } from './parsePdf'

  type Props = { txs: Tx[] }
  let { txs }: Props = $props()

  const typeLabel: Record<Tx['type'], string> = {
    VIR_INST: 'Instant',
    VIR_SEPA: 'SEPA',
    VIR_PERM: 'Standing',
    VIREMENT: 'Transfer',
    PRLV_SEPA: 'Direct debit',
    CB: 'Card',
    FEE: 'Fee',
    OTHER: 'Other',
  }

  function fmtAmount(n: number) {
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function fmtDate(iso: string) {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y.slice(2)}`
  }
</script>

<div class="wrap">
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Identifier</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>
      {#each txs as tx (tx.date + tx.transactionIdentifier + tx.amount)}
        <tr>
          <td class="date">{fmtDate(tx.date)}</td>
          <td><span class="badge type-{tx.type}">{typeLabel[tx.type]}</span></td>
          <td class="cp" title={tx.transactionRaw}>{tx.transactionIdentifier}</td>
          <td class="num {tx.direction}">
            {tx.direction === 'in' ? '+' : '−'}{fmtAmount(tx.amount)} €
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  thead th {
    text-align: left;
    padding: 0.875rem 1rem;
    font-weight: 500;
    color: var(--ink-soft);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border);
    background: var(--surface-hover);
  }
  thead th.num {
    text-align: right;
  }
  tbody td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    color: var(--ink);
  }
  tbody tr:last-child td {
    border-bottom: none;
  }
  tbody tr:hover {
    background: var(--surface-hover);
  }
  .date {
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .cp {
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    font-weight: 500;
  }
  .num.in {
    color: var(--accent-mint);
  }
  .num.out {
    color: var(--accent-blush);
  }
  .badge {
    display: inline-block;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 500;
    background: var(--accent-lavender-soft);
    color: var(--accent-lavender);
  }
  .badge.type-CB { background: rgba(244,201,168,0.18); color: var(--accent-peach); }
  .badge.type-VIR_INST,
  .badge.type-VIR_SEPA,
  .badge.type-VIREMENT { background: rgba(184,224,207,0.2); color: var(--accent-mint); }
  .badge.type-PRLV_SEPA,
  .badge.type-VIR_PERM { background: rgba(241,192,204,0.2); color: var(--accent-blush); }
  .badge.type-FEE { background: rgba(255,255,255,0.06); color: var(--ink-soft); }
</style>
