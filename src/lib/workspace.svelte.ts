import type { Category, PersistedStatement, PersistedWorkspace } from './types'
import { DEFAULT_CATEGORIES, SCHEMA_VERSION } from './types'
import { saveWorkspaceSync } from './storage'

export class WorkspaceStore {
  categories: Category[] = $state(structuredClone(DEFAULT_CATEGORIES))
  statement: PersistedStatement | null = $state(null)

  hydrate(w: PersistedWorkspace) {
    this.categories = w.categories
    this.statement = w.statement
  }

  snapshot(): PersistedWorkspace {
    return {
      schemaVersion: SCHEMA_VERSION,
      statement: this.statement,
      categories: this.categories,
    }
  }

  addCategory(name: string, type: Category['type']) {
    const id = slugify(name) + '-' + Math.random().toString(36).slice(2, 6)
    this.categories.push({ id, name, type, matchers: [] })
  }

  renameCategory(id: string, name: string) {
    const c = this.categories.find((c) => c.id === id)
    if (c) c.name = name
  }

  deleteCategory(id: string) {
    const i = this.categories.findIndex((c) => c.id === id)
    if (i >= 0) this.categories.splice(i, 1)
  }

  addMatcher(categoryId: string, matcher: string) {
    const c = this.categories.find((c) => c.id === categoryId)
    if (c && !c.matchers.includes(matcher)) c.matchers.push(matcher)
  }

  editMatcher(categoryId: string, oldMatcher: string, newMatcher: string) {
    const c = this.categories.find((c) => c.id === categoryId)
    if (!c) return
    const i = c.matchers.indexOf(oldMatcher)
    if (i >= 0 && !c.matchers.includes(newMatcher)) c.matchers[i] = newMatcher
  }

  deleteMatcher(categoryId: string, matcher: string) {
    const c = this.categories.find((c) => c.id === categoryId)
    if (!c) return
    const i = c.matchers.indexOf(matcher)
    if (i >= 0) c.matchers.splice(i, 1)
  }

  setStatement(s: PersistedStatement | null) {
    this.statement = s
  }

  resetCategoriesToDefault() {
    this.categories = structuredClone(DEFAULT_CATEGORIES)
  }
}

/**
 * Wires a Workspace store to localStorage. Every reactive change to the
 * snapshot (categories, matchers, statement) writes the new JSON. Svelte
 * batches synchronous mutations so a single user action == a single write.
 *
 * Returns a teardown function (rarely needed — persistence is app-lifetime).
 */
export function persistWorkspace(store: WorkspaceStore): () => void {
  return $effect.root(() => {
    $effect(() => {
      try {
        saveWorkspaceSync(store.snapshot())
      } catch (e) {
        console.error('[workspace] localStorage write failed', e)
      }
    })
  })
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cat'
}

export const workspace = new WorkspaceStore()
