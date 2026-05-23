<script lang="ts">
  import type { Category, Tx } from '../../lib/domain/types'
  import { workspace } from '../../lib/persistence/workspace.svelte'
  import { acceptsDirection } from '../../lib/domain/types'
  import { groupTxsByCategory } from '../../lib/domain/grouping'

  type Props = { txs: Tx[]; panelOpen: boolean; onTogglePanel: () => void }
  let { txs, panelOpen, onTogglePanel }: Props = $props()

  const groups = $derived(groupTxsByCategory(txs, workspace.categories))

  let selected = $state<Set<string>>(new Set())
  function txKey(tx: Tx) {
    return `${tx.date}|${tx.transactionIdentifier}|${tx.amount}|${tx.direction}`
  }
  function toggleSelect(tx: Tx) {
    const k = txKey(tx)
    const next = new Set(selected)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    selected = next
  }
  function clearSelection() {
    selected = new Set()
  }

  let openPickerKey = $state<string | null>(null)
  function togglePicker(tx: Tx) {
    const k = txKey(tx)
    openPickerKey = openPickerKey === k ? null : k
  }

  function pickableCategories(direction: Tx['direction']) {
    return workspace.categories
      .filter((c) => acceptsDirection(c, direction))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  function assign(tx: Tx, category: Category) {
    // Inline picker = add Tx's full identifier as matcher to chosen Category.
    if (!category.matchers.includes(tx.transactionIdentifier)) {
      workspace.addMatcher(category.id, tx.transactionIdentifier)
    }
    openPickerKey = null
  }

  function bulkAssign(category: Category) {
    for (const tx of txs) {
      if (!selected.has(txKey(tx))) continue
      if (!acceptsDirection(category, tx.direction)) continue
      if (!category.matchers.includes(tx.transactionIdentifier)) {
        workspace.addMatcher(category.id, tx.transactionIdentifier)
      }
    }
    clearSelection()
  }

  let bulkPickerOpen = $state(false)
  // Direction(s) present in selection — picker filters to those.
  const bulkDirections = $derived.by<Set<'in' | 'out'>>(() => {
    const out = new Set<'in' | 'out'>()
    for (const tx of txs) {
      if (selected.has(txKey(tx))) out.add(tx.direction)
    }
    return out
  })
  const bulkPickable = $derived.by<Category[]>(() => {
    return workspace.categories
      .filter((c) => {
        // Category must accept every direction present in the selection.
        for (const d of bulkDirections) {
          if (!acceptsDirection(c, d)) return false
        }
        return bulkDirections.size > 0
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  function fmtAmount(n: number) {
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  function fmtDate(iso: string) {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y.slice(2)}`
  }

  let expanded = $state<Set<string>>(new Set())
  function toggleExpand(tx: Tx) {
    const k = txKey(tx)
    const next = new Set(expanded)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    expanded = next
  }

  // Click-outside to close any open picker (inline or bulk).
  function onDocClick(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.closest('.picker-wrap') && !target.closest('.bulk-actions')) {
      openPickerKey = null
      bulkPickerOpen = false
    }
  }

  $effect(() => {
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  })

  const typeLabel: Record<Tx['type'], string> = {
    VIR_INST: 'Instant transfer',
    VIR_SEPA: 'SEPA transfer',
    VIR_PERM: 'Standing order',
    VIREMENT: 'Transfer',
    PRLV_SEPA: 'Direct debit',
    CB: 'Card payment',
    FEE: 'Bank fee',
    OTHER: 'Other',
  }
</script>

<div class="top-bar">
  <div class="bulk-actions">
    {#if selected.size > 0}
      <span class="selected-count">{selected.size} selected</span>
      <button class="bulk-btn" onclick={(e) => { e.stopPropagation(); bulkPickerOpen = !bulkPickerOpen }}>Assign to Category</button>
      <button class="bulk-clear" onclick={clearSelection}>Clear</button>
      {#if bulkPickerOpen}
        <div class="bulk-picker">
          {#if bulkPickable.length === 0}
            <div class="empty">No compatible Categories</div>
          {:else}
            {#each ['expense', 'income', 'mixed'] as t}
              {@const opts = bulkPickable.filter((c) => c.type === t)}
              {#if opts.length}
                <div class="picker-header">{t === 'expense' ? 'Expense' : t === 'income' ? 'Income' : 'Mixed'}</div>
                {#each opts as c (c.id)}
                  <button class="picker-item" onclick={() => { bulkAssign(c); bulkPickerOpen = false }}>{c.name}</button>
                {/each}
              {/if}
            {/each}
          {/if}
        </div>
      {/if}
    {/if}
  </div>
  <button class="panel-toggle" onclick={onTogglePanel}>
    {panelOpen ? 'Close' : 'Open'} rule manager
  </button>
</div>

<div class="groups">
  {#each groups as g (g.key)}
    <section class="group" class:uncat={g.uncategorised}>
      <header class="group-header">
        <span class="group-label">
          {g.label}
          {#if g.uncategorised}
            <span class="dir-tag">{g.type}</span>
          {:else if g.type === 'mixed'}
            <span class="dir-tag">mixed</span>
          {/if}
        </span>
        <span class="group-meta">{g.txs.length} · {fmtAmount(g.totalAbs)} €</span>
      </header>
      <ul class="rows">
        {#each g.txs as tx (txKey(tx))}
          {@const k = txKey(tx)}
          {@const isExpanded = expanded.has(k)}
          <li class="row-wrap" class:selected={selected.has(k)} class:expanded={isExpanded}>
            <div
              class="row"
              role="button"
              tabindex="0"
              onclick={() => toggleExpand(tx)}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(tx) } }}
            >
              <input
                type="checkbox"
                checked={selected.has(k)}
                onchange={() => toggleSelect(tx)}
                onclick={(e) => e.stopPropagation()}
                aria-label="Select Tx"
              />
              <span class="date">{fmtDate(tx.date)}</span>
              <span class="ident">{tx.transactionIdentifier}</span>
              <span class="amount {tx.direction}">
                {tx.direction === 'in' ? '+' : '−'}{fmtAmount(tx.amount)} €
              </span>
              <div class="picker-wrap" onclick={(e) => e.stopPropagation()} role="presentation">
                <button
                  class="pick-btn"
                  onclick={() => togglePicker(tx)}
                  aria-haspopup="listbox"
                  aria-expanded={openPickerKey === k}
                  aria-label="Assign category"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {#if openPickerKey === k}
                  {@const opts = pickableCategories(tx.direction)}
                  {@const primary = tx.direction === 'out' ? 'expense' : 'income'}
                  {@const primaryOpts = opts.filter((c) => c.type === primary)}
                  {@const mixedOpts = opts.filter((c) => c.type === 'mixed')}
                  <div class="picker">
                    {#if primaryOpts.length}
                      <div class="picker-header">{primary === 'expense' ? 'Expense' : 'Income'}</div>
                      {#each primaryOpts as c (c.id)}
                        <button class="picker-item" onclick={() => assign(tx, c)}>{c.name}</button>
                      {/each}
                    {/if}
                    {#if mixedOpts.length}
                      <div class="picker-header">Mixed</div>
                      {#each mixedOpts as c (c.id)}
                        <button class="picker-item" onclick={() => assign(tx, c)}>{c.name}</button>
                      {/each}
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
            {#if isExpanded}
              <div class="details">
                <dl>
                  <dt>Type</dt>
                  <dd>{typeLabel[tx.type]}</dd>
                  <dt>Direction</dt>
                  <dd>{tx.direction === 'in' ? 'Credit (money in)' : 'Debit (money out)'}</dd>
                  <dt>Identifier</dt>
                  <dd class="mono">{tx.transactionIdentifier}</dd>
                  <dt>Raw libellé</dt>
                  <dd class="mono raw">{tx.transactionRaw}</dd>
                </dl>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .top-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    min-height: 38px;
  }
  .bulk-actions {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    position: relative;
    min-height: 38px;
  }
  .bulk-actions:empty::before { content: ''; }
  .selected-count {
    font-size: 0.88rem;
    color: var(--ink-soft);
  }
  .bulk-btn, .bulk-clear {
    background: var(--accent-bg);
    color: var(--ink);
    border: 1px solid var(--border-strong);
    padding: 0.35rem 0.8rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .bulk-clear { background: transparent; color: var(--ink-soft); }
  .panel-toggle {
    background: var(--accent-bg);
    color: var(--ink);
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 0.4rem 0.85rem;
    cursor: pointer;
    font-size: 0.85rem;
    white-space: nowrap;
  }
  .panel-toggle:hover { filter: brightness(1.1); }
  .bulk-picker {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    padding: 0.4rem;
    min-width: 220px;
    z-index: 10;
    max-height: 60vh;
    overflow: auto;
    box-shadow: 0 6px 24px rgba(0,0,0,0.35);
  }
  .empty { color: var(--ink-soft); padding: 0.5rem; font-size: 0.85rem; }

  .groups { display: flex; flex-direction: column; gap: 1.25rem; }
  .group {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    /* overflow visible so row picker dropdowns can escape short groups */
  }
  .group.uncat { border-color: var(--money-out); }
  .group-header {
    padding: 0.7rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--surface-hover);
    border-bottom: 1px solid var(--border);
    border-top-left-radius: 14px;
    border-top-right-radius: 14px;
  }
  .group-label { font-weight: 600; color: var(--ink); display: flex; gap: 0.5rem; align-items: center; }
  .group-meta { color: var(--ink-soft); font-variant-numeric: tabular-nums; font-size: 0.85rem; }
  .dir-tag {
    font-size: 0.65rem;
    text-transform: uppercase;
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    background: var(--accent-bg);
    color: var(--ink-soft);
    letter-spacing: 0.05em;
  }
  .rows { list-style: none; padding: 0; margin: 0; }
  .row-wrap {
    border-bottom: 1px solid var(--border);
  }
  .row-wrap:last-child {
    border-bottom: none;
    border-bottom-left-radius: 14px;
    border-bottom-right-radius: 14px;
    overflow: visible;
  }
  .row-wrap:last-child > .row {
    border-bottom-left-radius: 14px;
    border-bottom-right-radius: 14px;
  }
  .row-wrap.selected > .row { background: var(--accent-bg); }
  .row {
    display: grid;
    grid-template-columns: auto 80px 1fr auto auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.55rem 1rem;
    font-size: 0.88rem;
    cursor: pointer;
  }
  .row:hover { background: var(--surface-hover); }
  .row-wrap.expanded > .row { background: var(--surface-hover); }
  .date { color: var(--ink-soft); font-variant-numeric: tabular-nums; }
  .ident {
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .amount {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 500;
    min-width: 100px;
  }
  .amount.in { color: var(--money-in); }
  .amount.out { color: var(--money-out); }

  .picker-wrap { position: relative; }
  .pick-btn {
    background: var(--surface-hover);
    border: 1px solid var(--border-strong);
    color: var(--ink);
    width: 30px;
    height: 30px;
    border-radius: 6px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .pick-btn:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }
  .picker {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    padding: 0.35rem;
    min-width: 180px;
    z-index: 8;
    max-height: 60vh;
    overflow: auto;
    box-shadow: 0 6px 24px rgba(0,0,0,0.35);
  }
  .picker-header {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-soft);
    padding: 0.4rem 0.6rem 0.2rem;
  }
  .picker-item {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--ink);
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.88rem;
  }
  .picker-item:hover { background: var(--accent-bg); }

  .details {
    padding: 0.7rem 1rem 0.9rem 4rem;
    background: var(--bg);
    border-top: 1px dashed var(--border);
    font-size: 0.83rem;
  }
  .details dl {
    margin: 0;
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 0.3rem 0.75rem;
  }
  .details dt {
    color: var(--ink-soft);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-top: 0.15rem;
  }
  .details dd {
    margin: 0;
    color: var(--ink);
  }
  .details .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.82rem;
  }
  .details .raw {
    white-space: pre-wrap;
    color: var(--ink-soft);
  }
</style>
