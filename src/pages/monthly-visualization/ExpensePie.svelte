<script lang="ts">
  import { Chart, Svg, Pie, Arc } from 'layerchart'
  import type { Slice } from '../../lib/domain/pieData'

  type Props = {
    slices: Slice[]
    total: number
    drilledId: string | null
    onSlice: (categoryId: string) => void
  }
  const { slices, total, drilledId, onSlice }: Props = $props()

  const SIZE = 320

  function fmtEur(n: number) {
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  }

  let hover: { slice: Slice; pct: number } | null = $state(null)
  let pointer = $state({ x: 0, y: 0 })

  function onMove(e: PointerEvent, slice: Slice) {
    const rect = (e.currentTarget as Element).closest('.wrap')!.getBoundingClientRect()
    pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    hover = { slice, pct: total > 0 ? slice.value / total : 0 }
  }
</script>

<div class="wrap" style="width: {SIZE}px; height: {SIZE}px;">
  {#if slices.length === 0 || total <= 0}
    <svg viewBox="0 0 {SIZE} {SIZE}" width={SIZE} height={SIZE} role="img" aria-label="No data">
      <circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2 - 10} fill="var(--surface)" stroke="var(--border)" stroke-width="1" />
      <text x={SIZE / 2} y={SIZE / 2} text-anchor="middle" dominant-baseline="middle" class="empty">No categories selected</text>
    </svg>
  {:else}
    <Chart data={slices} x="value">
      <Svg center>
        <Pie let:arcs>
          {#each arcs as arc (arc.data.categoryId)}
            <Arc
              startAngle={arc.startAngle}
              endAngle={arc.endAngle}
              outerRadius={SIZE / 2 - 10}
              fill={arc.data.color}
              stroke="white"
              strokeWidth={2}
              class={drilledId === arc.data.categoryId ? 'slice drilled' : 'slice'}
              onclick={() => onSlice(arc.data.categoryId)}
              onpointermove={(e) => onMove(e, arc.data)}
              onpointerleave={() => (hover = null)}
            />
          {/each}
        </Pie>
      </Svg>
    </Chart>
  {/if}
  {#if hover}
    <div class="tooltip" style="left: {pointer.x + 12}px; top: {pointer.y + 12}px;">
      <strong>{hover.slice.label}</strong>
      <div>{fmtEur(hover.slice.value)} ({(hover.pct * 100).toFixed(1)}%)</div>
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  :global(.wrap .slice) {
    cursor: pointer;
    transition: opacity 0.15s;
  }
  :global(.wrap .slice:hover) { opacity: 0.85; }
  :global(.wrap .slice.drilled) { stroke: var(--ink); stroke-width: 3; }
  .empty {
    fill: var(--ink-soft);
    font-size: 14px;
  }
  .tooltip {
    position: absolute;
    pointer-events: none;
    background: var(--ink);
    color: white;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    font-size: 0.8rem;
    white-space: nowrap;
    z-index: 10;
  }
  .tooltip strong { display: block; font-weight: 600; }
</style>
