<script lang="ts">
  import type { Tx } from '../../lib/domain/types'

  type Props = {
    label: string
    color: string
    txs: Tx[]
    onClose: () => void
  }
  const { label, color, txs, onClose }: Props = $props()

  function fmtEur(n: number) {
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  }

  function fmtDate(d: string) {
    return d
  }

  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const total = $derived(
    txs.reduce((acc, t) => acc + (t.direction === 'out' ? t.amount : -t.amount), 0)
  )
</script>

<section class="drill">
  <header>
    <span class="swatch" style="background: {color}"></span>
    <h3>{label}</h3>
    <span class="total">Net {fmtEur(total)} · {txs.length} txs</span>
    <button class="close" type="button" aria-label="Close" onclick={onClose}>×</button>
  </header>
  <ul>
    {#each txs as tx (tx.date + '|' + tx.transactionIdentifier + '|' + tx.amount + '|' + tx.direction)}
      <li>
        <span class="date">{fmtDate(tx.date)}</span>
        <span class="ident">{tx.transactionIdentifier}</span>
        <span class="amount {tx.direction}">
          {tx.direction === 'in' ? '+' : '−'}{fmtEur(tx.amount)}
        </span>
      </li>
    {/each}
  </ul>
</section>

<style>
  .drill {
    margin-top: 2rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem 1.25rem 1.25rem;
  }
  header {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border);
  }
  .swatch { width: 12px; height: 12px; border-radius: 3px; }
  h3 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--ink); }
  .total {
    color: var(--ink-soft);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  .close {
    background: transparent;
    border: none;
    color: var(--ink-soft);
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
    padding: 0 0.25rem;
  }
  .close:hover { color: var(--ink); }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  li {
    display: grid;
    grid-template-columns: 90px 1fr auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.45rem 0.25rem;
    font-size: 0.88rem;
    border-radius: 6px;
  }
  li:hover { background: var(--bg); }
  .date { color: var(--ink-soft); font-variant-numeric: tabular-nums; }
  .ident { color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .amount {
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }
  .amount.in { color: var(--status-ok); }
  .amount.out { color: var(--ink); }
</style>
