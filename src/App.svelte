<script lang="ts">
  import Upload from './lib/Upload.svelte'
  import Table from './lib/Table.svelte'
  import { parseStatement, type Statement } from './lib/parsePdf'

  let file: File | null = $state(null)
  let statement: Statement | null = $state(null)
  let loading = $state(false)
  let error: string | null = $state(null)

  async function handleFile(f: File) {
    file = f
    statement = null
    error = null
    loading = true
    try {
      statement = await parseStatement(f)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
      console.error(e)
    } finally {
      loading = false
    }
  }

  function fmtEur(n: number) {
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  }

  function reset() {
    file = null
    statement = null
    error = null
  }
</script>

<main>
  <header>
    <h1>PDF Parser</h1>
    <p class="subtitle">Drop a bank statement, get the transactions.</p>
  </header>

  {#if !file}
    <Upload onFile={handleFile} />
  {:else}
    <div class="file-info">
      <span class="dot"></span>
      <span class="name">{file.name}</span>
      <span class="size">{(file.size / 1024).toFixed(1)} KB</span>
      <button class="reset" onclick={reset}>Replace</button>
    </div>

    {#if loading}
      <div class="status">Parsing…</div>
    {:else if error}
      <div class="status error">Error: {error}</div>
    {:else if statement}
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

      <Table txs={statement.txs} />
    {/if}
  {/if}
</main>

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
