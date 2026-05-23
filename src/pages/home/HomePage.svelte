<script lang="ts">
  import RefinementPage from './RefinementPage.svelte'
  import SidePanel from './SidePanel.svelte'
  import { workspace } from '../../lib/persistence/workspace.svelte'

  let panelOpen = $state(false)
  const txs = $derived(workspace.statement?.statement.txs ?? [])
</script>

<RefinementPage
  txs={txs}
  panelOpen={panelOpen}
  onTogglePanel={() => (panelOpen = !panelOpen)}
/>
<SidePanel txs={txs} open={panelOpen} onClose={() => (panelOpen = false)} />
