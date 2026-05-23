<script lang="ts">
  import type { Slice } from '../../lib/domain/pieData'

  type Props = {
    slices: Slice[]
    total: number
    drilledId: string | null
    onSlice: (categoryId: string) => void
  }
  const { slices, total, drilledId, onSlice }: Props = $props()

  const SIZE = 320
  const CX = SIZE / 2
  const CY = SIZE / 2
  const R = 150

  function fmtEur(n: number) {
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  }

  type Arc = { slice: Slice; d: string; midAngle: number; pct: number }
  const arcs = $derived.by<Arc[]>(() => {
    if (slices.length === 0 || total <= 0) return []
    if (slices.length === 1) {
      // Single slice: can't express full circle as one path arc. Caller renders <circle>.
      return [{ slice: slices[0], d: '', midAngle: Math.PI, pct: 1 }]
    }
    let acc = 0
    const out: Arc[] = []
    for (const s of slices) {
      const start = (acc / total) * Math.PI * 2
      acc += s.value
      const end = (acc / total) * Math.PI * 2
      const large = end - start > Math.PI ? 1 : 0
      const p1 = { x: CX + R * Math.sin(start), y: CY - R * Math.cos(start) }
      const p2 = { x: CX + R * Math.sin(end), y: CY - R * Math.cos(end) }
      const d = `M ${CX} ${CY} L ${p1.x} ${p1.y} A ${R} ${R} 0 ${large} 1 ${p2.x} ${p2.y} Z`
      out.push({ slice: s, d, midAngle: (start + end) / 2, pct: s.value / total })
    }
    return out
  })

  let hover: Arc | null = $state(null)
  let pointer = $state({ x: 0, y: 0 })

  function onKey(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSlice(id)
    }
  }

  function onMove(e: MouseEvent, a: Arc) {
    const rect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
    pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    hover = a
  }
</script>

<div class="wrap">
  <svg viewBox="0 0 {SIZE} {SIZE}" width={SIZE} height={SIZE} role="img" aria-label="Expense breakdown">
    {#if slices.length === 0 || total <= 0}
      <circle cx={CX} cy={CY} r={R} fill="var(--surface)" stroke="var(--border)" stroke-width="1" />
      <text x={CX} y={CY} text-anchor="middle" dominant-baseline="middle" class="empty">No categories selected</text>
    {:else if slices.length === 1}
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill={slices[0].color}
        stroke="white"
        stroke-width="2"
        class="slice"
        class:drilled={drilledId === slices[0].categoryId}
        onclick={() => onSlice(slices[0].categoryId)}
        onkeydown={(e) => onKey(e, slices[0].categoryId)}
        onmousemove={(e) => onMove(e, arcs[0])}
        onmouseleave={() => (hover = null)}
        role="button"
        tabindex="0"
      />
    {:else}
      {#each arcs as a (a.slice.categoryId)}
        <path
          d={a.d}
          fill={a.slice.color}
          stroke="white"
          stroke-width="2"
          class="slice"
          class:drilled={drilledId === a.slice.categoryId}
          onclick={() => onSlice(a.slice.categoryId)}
          onkeydown={(e) => onKey(e, a.slice.categoryId)}
          onmousemove={(e) => onMove(e, a)}
          onmouseleave={() => (hover = null)}
          role="button"
          tabindex="0"
          aria-label="{a.slice.label}: {fmtEur(a.slice.value)} ({Math.round(a.pct * 100)}%)"
        />
      {/each}
    {/if}
  </svg>
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
  svg { display: block; }
  .slice {
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s;
    transform-origin: center;
    transform-box: fill-box;
  }
  .slice:hover { opacity: 0.85; }
  .slice.drilled { stroke: var(--ink); stroke-width: 3; }
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
