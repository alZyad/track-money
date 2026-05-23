<script lang="ts">
  import Toaster from './lib/ui/Toaster.svelte'
  import HomePage from './pages/home/HomePage.svelte'
  import Upload from './lib/ui/Upload.svelte'
  import { workspace, persistWorkspace } from './lib/persistence/workspace.svelte'
  import { deletePdf, hasPdf, loadWorkspaceSync, putPdf, wipeAll } from './lib/persistence/storage'
  import { loadStatement } from './lib/persistence/loadStatement'
  import { toasts } from './lib/ui/toasts.svelte'
  import { route, type Route } from './lib/routing/route.svelte'

  const storage = { putPdf, deletePdf }

  let booted = $state(false)
  let loading = $state(false)
  let error: string | null = $state(null)
  let replaceMode = $state(false)

  $effect(() => {
    if (booted) return
    booted = true
    const result = loadWorkspaceSync()
    if (result.kind === 'ok') {
      workspace.hydrate(result.workspace)
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
    route.bindHashListener()
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
  const tabs: { id: Route; label: string }[] = [
    { id: 'home', label: 'Refinement' },
    { id: 'monthly-visualization', label: 'Monthly' },
  ]
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

    <nav class="tabs" aria-label="Views">
      {#each tabs as t}
        <button
          class="tab"
          class:active={route.current === t.id}
          onclick={() => route.go(t.id)}
        >{t.label}</button>
      {/each}
    </nav>

    {#if route.current === 'home'}
      <HomePage />
    {:else if route.current === 'monthly-visualization'}
      <div class="page-placeholder">Monthly visualization — coming next commit.</div>
    {/if}
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
  .tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 1.5rem;
  }
  .tab {
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--ink-soft);
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    margin-bottom: -1px;
    transition: color 0.15s, border-color 0.15s;
  }
  .tab:hover { color: var(--ink); }
  .tab.active {
    color: var(--ink);
    border-bottom-color: var(--accent);
  }
  .page-placeholder {
    padding: 3rem 1rem;
    text-align: center;
    color: var(--ink-soft);
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: 12px;
  }
</style>
