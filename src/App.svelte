<script lang="ts">
  import Upload from './lib/Upload.svelte'
  import RefinementPage from './lib/RefinementPage.svelte'
  import SidePanel from './lib/SidePanel.svelte'
  import Toaster from './lib/Toaster.svelte'
  import { workspace, persistWorkspace } from './lib/workspace.svelte'
  import {
    deletePdf,
    hasPdf,
    loadWorkspaceSync,
    putPdf,
    wipeAll,
  } from './lib/storage'
  import { loadStatement } from './lib/loadStatement'
  import { toasts } from './lib/toasts.svelte'

  const storage = { putPdf, deletePdf }

  let loading = $state(false)
  let error: string | null = $state(null)
  let panelOpen = $state(false)
  let replaceMode = $state(false)
  let booted = $state(false)

  // ----- Boot hydration -----
  $effect(() => {
    if (booted) return
    booted = true
    const result = loadWorkspaceSync()
    if (result.kind === 'ok') {
      workspace.hydrate(result.workspace)
      // Best-effort backup check (async; doesn't block hydration).
      const s = result.workspace.statement
      if (s) {
        hasPdf(s.pdfHash).then((r) => {
          if (!r.ok) toasts.warn('PDF backup could not be verified.')
          else if (!r.value) toasts.warn('PDF backup missing — data loaded but archive is gone.')
        })
      }
    } else if (result.kind === 'error') {
      void wipeAll().finally(() => {
        toasts.error(`Saved data couldn't be loaded (${result.reason}). Starting fresh.`)
      })
    }
    persistWorkspace(workspace)
  })

  async function handleFile(f: File) {
    error = null
    loading = true
    const result = await loadStatement(f, workspace, storage)
    loading = false
    if (result.kind === 'parse-error') {
      error = result.message
      return
    }
    replaceMode = false
    if (result.kind === 'ok-backup-failed') {
      const msg = result.reason === 'quota'
        ? 'Statement loaded — PDF backup skipped (browser storage full).'
        : result.reason === 'unsupported'
          ? 'Statement loaded — PDF backup unavailable (IndexedDB blocked).'
          : 'Statement loaded but PDF backup could not be saved.'
      toasts.error(msg)
    }
  }

  function fmtEur(n: number) {
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  }

  const statement = $derived(workspace.statement?.statement ?? null)
  const showUpload = $derived(replaceMode || statement === null)
</script>

<main>
  <header>
    <h1>PDF Parser</h1>
    <p class="subtitle">Drop a bank statement, get the transactions.</p>
  </header>

  {#if showUpload}
    {#if loading}
      <div class="status">Parsing…</div>
    {:else}
      <Upload onFile={handleFile} />
      {#if replaceMode && statement}
        <div class="cancel-row">
          <button class="ghost" onclick={() => (replaceMode = false)}>Cancel — keep current statement</button>
        </div>
      {/if}
      {#if error}
        <div class="status error">Error: {error}</div>
      {/if}
    {/if}
  {:else if statement}
    <div class="file-info">
      <span class="dot"></span>
      <span class="name">{statement.periodStart} → {statement.periodEnd}</span>
      <span class="size">{statement.txs.length} txs</span>
      <button class="reset" onclick={() => (replaceMode = true)}>Replace</button>
    </div>

    <section class="summary">
      <div class="card">
        <span class="label">Period</span>
        <span class="value small">{statement.periodStart} → {statement.periodEnd}</span>
      </div>
      <div class="card">
        <span class="label">Old balance</span>
        <span class="value">{fmtEur(statement.oldBalance)}</span>
      </div>
      <div class="card">
        <span class="label">New balance</span>
        <span class="value">{fmtEur(statement.newBalance)}</span>
      </div>
      <div class="card">
        <span class="label">Transactions</span>
        <span class="value">{statement.txs.length}</span>
      </div>
    </section>

    <RefinementPage
      txs={statement.txs}
      panelOpen={panelOpen}
      onTogglePanel={() => (panelOpen = !panelOpen)}
    />
    <SidePanel txs={statement.txs} open={panelOpen} onClose={() => (panelOpen = false)} />
  {/if}
</main>

<Toaster />

<style>
  main {
    max-width: 960px;
    margin: 0 auto;
    padding: 4rem 1.5rem 6rem;
  }
  header {
    text-align: center;
    margin-bottom: 2.5rem;
  }
  h1 {
    font-size: 2.25rem;
    font-weight: 600;
    color: var(--ink);
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;
  }
  .subtitle {
    color: var(--ink-soft);
    margin: 0;
    font-size: 1rem;
  }
  .file-info {
    margin-bottom: 1.5rem;
    padding: 0.875rem 1.125rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9rem;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--status-ok);
  }
  .name { color: var(--ink); font-weight: 500; }
  .size { color: var(--ink-soft); }
  .reset {
    margin-left: auto;
    background: transparent;
    border: 1px solid var(--border-strong);
    color: var(--ink-soft);
    padding: 0.35rem 0.85rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.82rem;
    transition: all 0.15s;
  }
  .reset:hover {
    color: var(--ink);
    border-color: var(--accent);
  }
  .cancel-row {
    text-align: center;
    margin-top: 0.75rem;
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--border-strong);
    color: var(--ink-soft);
    padding: 0.4rem 0.85rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .ghost:hover { color: var(--ink); border-color: var(--accent); }
  .status {
    padding: 1rem;
    text-align: center;
    color: var(--ink-soft);
  }
  .status.error {
    color: var(--status-error);
  }
  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.875rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink-soft);
  }
  .value {
    color: var(--ink);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .value.small { font-size: 0.85rem; font-weight: 400; }
</style>
