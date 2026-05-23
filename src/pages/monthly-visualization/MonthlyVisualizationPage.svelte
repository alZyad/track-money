<script lang="ts">
  import { workspace } from '../../lib/persistence/workspace.svelte'
  import { expensePieSlices } from '../../lib/domain/pieData'

  const txs = $derived(workspace.statement?.statement.txs ?? [])
  const slices = $derived(expensePieSlices(txs, workspace.categories))
</script>

<section class="viz">
  <div class="placeholder">
    {#if slices.length === 0}
      No expenses to chart for this period.
    {:else}
      {slices.length} expense categories ready — chart lands in next commit.
    {/if}
  </div>
</section>

<style>
  .viz { display: block; }
  .placeholder {
    padding: 3rem 1rem;
    text-align: center;
    color: var(--ink-soft);
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: 12px;
  }
</style>
