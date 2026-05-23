<script lang="ts">
  import { workspace } from '../../lib/persistence/workspace.svelte'
  import { expensePieSlices } from '../../lib/domain/pieData'
  import { categorise } from '../../lib/domain/categorise'
  import ExpensePie from './ExpensePie.svelte'
  import PieLegend from './PieLegend.svelte'
  import DrillSection from './DrillSection.svelte'

  const txs = $derived(workspace.statement?.statement.txs ?? [])
  const allSlices = $derived(expensePieSlices(txs, workspace.categories))

  let selectedIds = $state<Set<string>>(new Set())
  let drilledId = $state<string | null>(null)

  // Seed selection to all visible whenever the slice set changes (new statement,
  // recategorisation, etc.). Compares membership so untouched runs are no-ops.
  let lastSig = ''
  $effect(() => {
    const sig = allSlices.map((s) => s.categoryId).join('|')
    if (sig === lastSig) return
    lastSig = sig
    selectedIds = new Set(allSlices.map((s) => s.categoryId))
    drilledId = null
  })

  const visibleSlices = $derived(allSlices.filter((s) => selectedIds.has(s.categoryId)))
  const visibleTotal = $derived(visibleSlices.reduce((acc, s) => acc + s.value, 0))
  const allTotal = $derived(allSlices.reduce((acc, s) => acc + s.value, 0))

  const drilled = $derived.by(() => {
    if (!drilledId) return null
    const slice = allSlices.find((s) => s.categoryId === drilledId)
    if (!slice) return null
    const drillTxs = txs
      .filter((t) => categorise(t, workspace.categories).category.id === drilledId)
      .sort((a, b) => b.date.localeCompare(a.date))
    return { slice, txs: drillTxs }
  })

  function fmtEur(n: number) {
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  }

  function toggle(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
      if (drilledId === id) drilledId = null
    } else {
      next.add(id)
    }
    selectedIds = next
  }

  function onSlice(id: string) {
    drilledId = drilledId === id ? null : id
  }
</script>

{#if allSlices.length === 0}
  <div class="placeholder">No expenses to chart for this period.</div>
{:else}
  <section class="viz">
    <div class="chart">
      <ExpensePie slices={visibleSlices} total={visibleTotal} drilledId={drilledId} onSlice={onSlice} />
      <p class="caption">
        {#if visibleSlices.length === 0}
          No categories selected.
        {:else}
          Showing {fmtEur(visibleTotal)} of {fmtEur(allTotal)} total expenses.
        {/if}
      </p>
    </div>
    <div class="legend-col">
      <PieLegend slices={allSlices} selectedIds={selectedIds} onToggle={toggle} />
    </div>
  </section>
  {#if drilled}
    <DrillSection
      label={drilled.slice.label}
      color={drilled.slice.color}
      txs={drilled.txs}
      onClose={() => (drilledId = null)}
    />
  {/if}
{/if}

<style>
  .viz {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    align-items: start;
  }
  .chart { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
  .caption {
    color: var(--ink-soft);
    font-size: 0.85rem;
    margin: 0;
    text-align: center;
  }
  .legend-col { min-width: 0; }
  .placeholder {
    padding: 3rem 1rem;
    text-align: center;
    color: var(--ink-soft);
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: 12px;
  }
  @media (max-width: 700px) {
    .viz { grid-template-columns: 1fr; }
  }
</style>
