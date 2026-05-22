<script lang="ts">
  type Props = { onFile: (f: File) => void }
  let { onFile }: Props = $props()

  let dragging = $state(false)
  let input: HTMLInputElement

  function pickFile(files: FileList | null) {
    if (!files || files.length === 0) return
    const f = files[0]
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) return
    onFile(f)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    dragging = false
    pickFile(e.dataTransfer?.files ?? null)
  }
</script>

<div
  class="dropzone"
  class:dragging
  role="button"
  tabindex="0"
  ondragover={(e) => { e.preventDefault(); dragging = true }}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
  onclick={() => input.click()}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && input.click()}
>
  <div class="icon" aria-hidden="true">
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
      <path d="M14 3v6h6"/>
      <path d="M12 18v-6"/>
      <path d="M9 15l3-3 3 3"/>
    </svg>
  </div>
  <p class="primary">Drop your PDF here</p>
  <p class="secondary">or <span class="link">browse</span> from your computer</p>

  <input
    bind:this={input}
    type="file"
    accept="application/pdf,.pdf"
    onchange={(e) => pickFile((e.currentTarget as HTMLInputElement).files)}
    hidden
  />
</div>

<style>
  .dropzone {
    border: 2px dashed var(--border-strong);
    background: var(--surface);
    border-radius: 20px;
    padding: 3rem 1.5rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.18s ease;
    color: var(--ink-soft);
  }
  .dropzone:hover {
    background: var(--surface-hover);
    border-color: var(--accent);
  }
  .dropzone.dragging {
    background: var(--accent-bg);
    border-color: var(--accent);
    transform: scale(1.01);
  }
  .icon {
    color: var(--accent);
    margin-bottom: 0.875rem;
    display: flex;
    justify-content: center;
  }
  .primary {
    color: var(--ink);
    font-weight: 500;
    font-size: 1.05rem;
    margin: 0 0 0.25rem;
  }
  .secondary {
    margin: 0;
    font-size: 0.9rem;
  }
  .link {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
