<script lang="ts">
  import type { Tx } from './parsePdf'
  import type { Category, CategoryType } from './types'
  import { workspace } from './workspace.svelte'
  import { allMatches, categorise, validateMatcher } from './categorise'

  type Props = { txs: Tx[]; open: boolean; onClose: () => void }
  let { txs, open, onClose }: Props = $props()

  $effect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.panel')) return
      if (target.closest('.panel-toggle')) return
      onClose()
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  })

  // expand state per Category
  let expanded = $state<Record<string, boolean>>({})
  function toggle(id: string) {
    expanded[id] = !expanded[id]
  }

  // matcher edit state
  let editing = $state<{ catId: string; oldMatcher: string; value: string } | null>(null)
  let addingMatcherTo = $state<string | null>(null)
  let addMatcherValue = $state('')
  let addMatcherError = $state<string | null>(null)

  function startAddMatcher(catId: string) {
    addingMatcherTo = catId
    addMatcherValue = ''
    addMatcherError = null
  }
  function commitAddMatcher() {
    if (!addingMatcherTo) return
    const cat = workspace.categories.find((c) => c.id === addingMatcherTo)
    if (!cat) return
    const v = validateMatcher(addMatcherValue, cat)
    if (!v.ok) {
      addMatcherError = v.reason
      return
    }
    workspace.addMatcher(cat.id, v.matcher)
    addingMatcherTo = null
    addMatcherValue = ''
    addMatcherError = null
  }

  function startEdit(catId: string, m: string) {
    editing = { catId, oldMatcher: m, value: m }
  }
  function commitEdit() {
    if (!editing) return
    const cat = workspace.categories.find((c) => c.id === editing!.catId)
    if (!cat) return
    const v = validateMatcher(editing.value, cat)
    if (!v.ok) return
    workspace.editMatcher(cat.id, editing.oldMatcher, v.matcher)
    editing = null
  }
  function cancelEdit() {
    editing = null
  }

  // category create
  let creating = $state(false)
  let newCatName = $state('')
  let newCatType = $state<CategoryType>('expense')
  function commitCreate() {
    const name = newCatName.trim()
    if (!name) return
    workspace.addCategory(name, newCatType)
    newCatName = ''
    creating = false
  }

  // category rename
  let renaming = $state<{ id: string; value: string } | null>(null)
  function startRename(c: Category) {
    renaming = { id: c.id, value: c.name }
  }
  function commitRename() {
    if (!renaming) return
    const v = renaming.value.trim()
    if (v) workspace.renameCategory(renaming.id, v)
    renaming = null
  }

  function confirmDeleteCategory(c: Category) {
    if (confirm(`Delete Category "${c.name}"? Its matchers will be lost; Txs will re-categorise.`)) {
      workspace.deleteCategory(c.id)
    }
  }

  // matcher metadata
  function matchCount(matcher: string): number {
    let n = 0
    for (const tx of txs) if (tx.transactionIdentifier.includes(matcher)) n++
    return n
  }

  const categoriesSorted = $derived.by<Category[]>(() => {
    const order: Record<Category['type'], number> = { expense: 0, income: 1, mixed: 2 }
    return [...workspace.categories].sort((a, b) => {
      if (a.type !== b.type) return order[a.type] - order[b.type]
      return a.name.localeCompare(b.name)
    })
  })

  type Conflict = {
    tx: Tx
    matches: Array<{ category: Category; matcher: string }>
    winnerCatId: string
  }
  const conflicts = $derived.by<Conflict[]>(() => {
    const out: Conflict[] = []
    for (const tx of txs) {
      const m = allMatches(tx, workspace.categories)
      const distinctCats = new Set(m.map((x) => x.category.id))
      if (distinctCats.size < 2) continue
      const w = categorise(tx, workspace.categories)
      if (w.matcher === null) continue
      out.push({ tx, matches: m, winnerCatId: w.category.id })
    }
    return out
  })
</script>

<aside class="panel" class:open aria-hidden={!open}>
  <header class="panel-head">
    <h2>Rule manager</h2>
    <button class="close" onclick={onClose} aria-label="Close">✕</button>
  </header>

  <div class="panel-body">
    <section class="categories">
      <div class="section-title">
        <span>Categories</span>
        <button class="add-cat" onclick={() => (creating = !creating)}>+ Add category</button>
      </div>

      {#if creating}
        <div class="create-form">
          <input
            type="text"
            placeholder="Category name"
            bind:value={newCatName}
            onkeydown={(e) => e.key === 'Enter' && commitCreate()}
          />
          <label><input type="radio" bind:group={newCatType} value="expense" /> Expense</label>
          <label><input type="radio" bind:group={newCatType} value="income" /> Income</label>
          <label><input type="radio" bind:group={newCatType} value="mixed" /> Mixed</label>
          <button class="primary" onclick={commitCreate}>Create</button>
          <button class="ghost" onclick={() => (creating = false)}>Cancel</button>
        </div>
      {/if}

      <ul class="cat-list">
        {#each categoriesSorted as c (c.id)}
          <li class="cat">
            <div class="cat-head">
              <button class="cat-toggle" onclick={() => toggle(c.id)} aria-expanded={!!expanded[c.id]}>
                {expanded[c.id] ? '▾' : '▸'}
              </button>
              {#if renaming && renaming.id === c.id}
                <input
                  class="rename-input"
                  bind:value={renaming.value}
                  onblur={commitRename}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    else if (e.key === 'Escape') (renaming = null)
                  }}
                />
              {:else}
                <button class="cat-name" onclick={() => startRename(c)}>{c.name}</button>
              {/if}
              <span class="type-tag type-{c.type}">{c.type}</span>
              <span class="m-count">{c.matchers.length}</span>
              <button class="del" onclick={() => confirmDeleteCategory(c)} title="Delete category">🗑</button>
            </div>

            {#if expanded[c.id]}
              <ul class="matchers">
                {#each c.matchers as m (m)}
                  {@const n = matchCount(m)}
                  <li class="matcher">
                    {#if editing && editing.catId === c.id && editing.oldMatcher === m}
                      <input
                        class="m-input"
                        bind:value={editing.value}
                        onblur={commitEdit}
                        onkeydown={(e) => {
                          if (e.key === 'Enter') commitEdit()
                          else if (e.key === 'Escape') cancelEdit()
                        }}
                      />
                    {:else}
                      <button class="m-text" onclick={() => startEdit(c.id, m)}>{m}</button>
                    {/if}
                    <span class="m-meta">
                      {#if n === 0}
                        <span class="zero" title="Matches 0 current Txs">⚠</span>
                      {:else}
                        {n}
                      {/if}
                    </span>
                    <button class="del small" onclick={() => workspace.deleteMatcher(c.id, m)} title="Delete matcher">🗑</button>
                  </li>
                {/each}
                {#if addingMatcherTo === c.id}
                  <li class="matcher adding">
                    <input
                      type="text"
                      placeholder="new matcher"
                      bind:value={addMatcherValue}
                      onkeydown={(e) => {
                        if (e.key === 'Enter') commitAddMatcher()
                        else if (e.key === 'Escape') { addingMatcherTo = null; addMatcherError = null }
                      }}
                    />
                    <button class="primary small" onclick={commitAddMatcher}>Add</button>
                  </li>
                  {#if addMatcherError}
                    <li class="err">{addMatcherError}</li>
                  {/if}
                {:else}
                  <li>
                    <button class="add-m" onclick={() => startAddMatcher(c.id)}>+ add matcher</button>
                  </li>
                {/if}
              </ul>
            {/if}
          </li>
        {/each}
      </ul>
    </section>

    <section class="conflicts">
      <div class="section-title">
        <span>Conflicts</span>
        <span class="m-count">{conflicts.length}</span>
      </div>
      {#if conflicts.length === 0}
        <p class="empty">No conflicts.</p>
      {:else}
        <ul class="conflict-list">
          {#each conflicts as cf (cf.tx.transactionIdentifier + cf.tx.date + cf.tx.amount)}
            <li class="conflict">
              <div class="cf-ident">{cf.tx.transactionIdentifier}</div>
              <ul class="cf-matches">
                {#each cf.matches as h (h.category.id + h.matcher)}
                  <li class:winner={h.category.id === cf.winnerCatId}>
                    <span class="cf-cat">{h.category.name}</span>
                    <span class="cf-arrow">←</span>
                    <span class="cf-m">"{h.matcher}"</span>
                    {#if h.category.id === cf.winnerCatId}
                      <span class="cf-tag">winner</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</aside>

<style>
  .panel {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    width: 380px;
    background: var(--surface);
    border-left: 1px solid var(--border-strong);
    transform: translateX(100%);
    transition: transform 0.2s ease;
    display: flex;
    flex-direction: column;
    z-index: 20;
  }
  .panel.open { transform: translateX(0); }

  .panel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.9rem 1rem;
    border-bottom: 1px solid var(--border);
  }
  .panel-head h2 { margin: 0; font-size: 1rem; font-weight: 600; }
  .close {
    background: transparent;
    border: none;
    color: var(--ink-soft);
    font-size: 1rem;
    cursor: pointer;
  }
  .close:hover { color: var(--ink); }

  .panel-body {
    flex: 1;
    overflow: auto;
    padding: 0.75rem 0.75rem 1.5rem;
  }

  .section-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-soft);
    padding: 0.5rem 0.25rem;
    margin-top: 0.5rem;
  }
  .add-cat {
    background: transparent;
    border: 1px dashed var(--border-strong);
    color: var(--ink-soft);
    border-radius: 6px;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
    font-size: 0.72rem;
    text-transform: none;
    letter-spacing: 0;
  }
  .add-cat:hover { color: var(--ink); border-color: var(--accent); }

  .create-form {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.5rem;
    background: var(--surface-hover);
    border-radius: 8px;
    margin-bottom: 0.5rem;
    font-size: 0.82rem;
  }
  .create-form input[type="text"] {
    flex: 1 1 100%;
    background: var(--bg);
    border: 1px solid var(--border-strong);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.3rem 0.5rem;
    font-size: 0.85rem;
  }
  .create-form label { color: var(--ink-soft); display: flex; gap: 0.25rem; align-items: center; }

  .cat-list { list-style: none; padding: 0; margin: 0; }
  .cat { border-bottom: 1px solid var(--border); }
  .cat:last-child { border-bottom: none; }
  .cat-head {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.25rem;
  }
  .cat-toggle {
    background: transparent;
    border: none;
    color: var(--ink-soft);
    cursor: pointer;
    width: 20px;
    font-size: 0.85rem;
  }
  .cat-name {
    background: transparent;
    border: none;
    color: var(--ink);
    font-size: 0.9rem;
    cursor: text;
    text-align: left;
    flex: 1;
    padding: 0.1rem 0.2rem;
  }
  .cat-name:hover { background: var(--surface-hover); border-radius: 4px; }
  .rename-input {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--accent);
    color: var(--ink);
    border-radius: 4px;
    padding: 0.15rem 0.3rem;
    font-size: 0.9rem;
  }
  .type-tag {
    font-size: 0.62rem;
    text-transform: uppercase;
    padding: 0.1rem 0.35rem;
    border-radius: 999px;
    letter-spacing: 0.04em;
  }
  .type-tag.type-expense { background: var(--type-card-bg); color: var(--type-card-fg); }
  .type-tag.type-income { background: var(--type-transfer-bg); color: var(--type-transfer-fg); }
  .type-tag.type-mixed { background: var(--type-default-bg); color: var(--type-default-fg); }
  .m-count {
    font-variant-numeric: tabular-nums;
    color: var(--ink-soft);
    font-size: 0.78rem;
    min-width: 1.5rem;
    text-align: right;
  }
  .del {
    background: transparent;
    border: none;
    color: var(--ink-soft);
    cursor: pointer;
    font-size: 0.85rem;
    opacity: 0.6;
  }
  .del:hover { opacity: 1; color: var(--money-out); }
  .del.small { font-size: 0.7rem; }

  .matchers {
    list-style: none;
    padding: 0 0 0.5rem 1.7rem;
    margin: 0;
  }
  .matcher {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.2rem 0.25rem;
    font-size: 0.82rem;
  }
  .m-text {
    background: transparent;
    border: none;
    color: var(--ink);
    font-family: monospace;
    font-size: 0.82rem;
    cursor: text;
    text-align: left;
    flex: 1;
    padding: 0.1rem 0.25rem;
    border-radius: 4px;
  }
  .m-text:hover { background: var(--surface-hover); }
  .m-input {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--accent);
    color: var(--ink);
    border-radius: 4px;
    padding: 0.15rem 0.3rem;
    font-size: 0.82rem;
    font-family: monospace;
  }
  .m-meta { font-size: 0.75rem; color: var(--ink-soft); min-width: 1.5rem; text-align: right; }
  .zero { color: var(--status-error); cursor: help; }
  .add-m {
    background: transparent;
    border: 1px dashed var(--border-strong);
    color: var(--ink-soft);
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.75rem;
  }
  .add-m:hover { color: var(--ink); border-color: var(--accent); }
  .matcher.adding input {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--accent);
    color: var(--ink);
    border-radius: 4px;
    padding: 0.2rem 0.4rem;
    font-size: 0.82rem;
    font-family: monospace;
  }
  .err {
    list-style: none;
    color: var(--status-error);
    font-size: 0.75rem;
    padding: 0.2rem 0.25rem;
  }

  .primary {
    background: var(--accent-bg);
    color: var(--ink);
    border: 1px solid var(--accent);
    border-radius: 6px;
    padding: 0.25rem 0.7rem;
    cursor: pointer;
    font-size: 0.82rem;
  }
  .primary.small { padding: 0.15rem 0.5rem; font-size: 0.78rem; }
  .ghost {
    background: transparent;
    border: 1px solid var(--border-strong);
    color: var(--ink-soft);
    border-radius: 6px;
    padding: 0.25rem 0.7rem;
    cursor: pointer;
    font-size: 0.82rem;
  }

  .conflicts { margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 0.5rem; }
  .empty { color: var(--ink-soft); font-size: 0.85rem; padding: 0 0.25rem; }
  .conflict-list { list-style: none; padding: 0; margin: 0; }
  .conflict {
    background: var(--surface-hover);
    border-radius: 8px;
    padding: 0.5rem 0.6rem;
    margin-bottom: 0.5rem;
  }
  .cf-ident {
    font-family: monospace;
    font-size: 0.78rem;
    color: var(--ink);
    margin-bottom: 0.35rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cf-matches { list-style: none; padding: 0; margin: 0; }
  .cf-matches li {
    font-size: 0.78rem;
    color: var(--ink-soft);
    padding: 0.15rem 0;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .cf-matches li.winner { color: var(--ink); }
  .cf-cat { font-weight: 500; }
  .cf-m { font-family: monospace; color: var(--ink); }
  .cf-tag {
    font-size: 0.62rem;
    text-transform: uppercase;
    background: var(--accent-bg);
    padding: 0.05rem 0.35rem;
    border-radius: 999px;
    color: var(--accent);
  }
</style>
