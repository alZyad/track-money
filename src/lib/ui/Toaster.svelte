<script lang="ts">
  import { toasts } from './toasts.svelte'
</script>

<div class="stack" role="status" aria-live="polite">
  {#each toasts.items as t (t.id)}
    <button class="toast {t.severity}" onclick={() => toasts.dismiss(t.id)} aria-label="Dismiss">
      <span class="msg">{t.message}</span>
    </button>
  {/each}
</div>

<style>
  .stack {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 100;
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    padding: 0.6rem 0.9rem;
    color: var(--ink);
    font-size: 0.85rem;
    max-width: 360px;
    text-align: left;
    cursor: pointer;
    box-shadow: 0 6px 24px rgba(0,0,0,0.4);
  }
  .toast.error { border-color: var(--status-error); }
  .toast.error .msg::before { content: '⚠ '; color: var(--status-error); }
  .toast.warn { border-color: var(--c-yellow-300, var(--status-error)); }
  .toast.warn .msg::before { content: '⚠ '; color: var(--c-yellow-300, var(--status-error)); }
  .toast.info { border-color: var(--accent); }
  .toast.info .msg::before { content: 'ℹ '; color: var(--accent); }
  .msg { display: inline; }
</style>
