<script lang="ts">
  import type { Slice } from '../../lib/domain/pieData'

  type Props = {
    slices: Slice[]
    selectedIds: Set<string>
    onToggle: (categoryId: string) => void
  }
  const { slices, selectedIds, onToggle }: Props = $props()

  function fmtEur(n: number) {
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  }
</script>

<ul class="legend">
  {#each slices as s (s.categoryId)}
    <li>
      <label>
        <input
          type="checkbox"
          checked={selectedIds.has(s.categoryId)}
          onchange={() => onToggle(s.categoryId)}
        />
        <span class="swatch" style="background: {s.color}"></span>
        <span class="label">{s.label}</span>
        <span class="value">{fmtEur(s.value)}</span>
      </label>
    </li>
  {/each}
</ul>

<style>
  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  label {
    display: grid;
    grid-template-columns: auto 14px 1fr auto;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.88rem;
  }
  label:hover { background: var(--surface); }
  input { margin: 0; cursor: pointer; }
  .swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    display: inline-block;
  }
  .label { color: var(--ink); }
  .value {
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
    font-size: 0.82rem;
  }
</style>
