<script lang="ts">
  import Toaster from './lib/ui/Toaster.svelte'
  import HomePage from './pages/home/HomePage.svelte'
  import { workspace, persistWorkspace } from './lib/persistence/workspace.svelte'
  import { hasPdf, loadWorkspaceSync, wipeAll } from './lib/persistence/storage'
  import { toasts } from './lib/ui/toasts.svelte'

  let booted = $state(false)

  // ----- Boot hydration -----
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
  })
</script>

<main>
  <HomePage />
</main>

<Toaster />

<style>
  main {
    max-width: 960px;
    margin: 0 auto;
    padding: 4rem 1.5rem 6rem;
  }
</style>
