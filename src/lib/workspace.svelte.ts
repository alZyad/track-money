import type { Category, PersistedStatement, PersistedWorkspace } from './types'
import { DEFAULT_CATEGORIES, SCHEMA_VERSION } from './types'
import { saveWorkspaceSync } from './storage'

export class WorkspaceStore {
  categories: Category[] = $state(structuredClone(DEFAULT_CATEGORIES))
  statement: PersistedStatement | null = $state(null)

  /** When false, mutations don't auto-persist (used during initial hydration). */
  private persistEnabled = false

  enablePersistence() {
    this.persistEnabled = true
  }

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

  private persist() {
    if (!this.persistEnabled) return
    try {
      saveWorkspaceSync(this.snapshot())
    } catch (e) {
      // Quota / unavailable. Surface upstream if needed; for now swallow.
      console.error('[workspace] localStorage write failed', e)
    }
  }

  addCategory(name: string, type: Category['type']) {
    const id = slugify(name) + '-' + Math.random().toString(36).slice(2, 6)
    this.categories.push({ id, name, type, matchers: [] })
    this.persist()
  }

  renameCategory(id: string, name: string) {
    const c = this.categories.find((c) => c.id === id)
    if (c) {
      c.name = name
      this.persist()
    }
  }

  deleteCategory(id: string) {
    const i = this.categories.findIndex((c) => c.id === id)
    if (i >= 0) {
      this.categories.splice(i, 1)
      this.persist()
    }
  }

  addMatcher(categoryId: string, matcher: string) {
    const c = this.categories.find((c) => c.id === categoryId)
    if (c && !c.matchers.includes(matcher)) {
      c.matchers.push(matcher)
      this.persist()
    }
  }

  editMatcher(categoryId: string, oldMatcher: string, newMatcher: string) {
    const c = this.categories.find((c) => c.id === categoryId)
    if (!c) return
    const i = c.matchers.indexOf(oldMatcher)
    if (i >= 0 && !c.matchers.includes(newMatcher)) {
      c.matchers[i] = newMatcher
      this.persist()
    }
  }

  deleteMatcher(categoryId: string, matcher: string) {
    const c = this.categories.find((c) => c.id === categoryId)
    if (!c) return
    const i = c.matchers.indexOf(matcher)
    if (i >= 0) {
      c.matchers.splice(i, 1)
      this.persist()
    }
  }

  setStatement(s: PersistedStatement | null) {
    this.statement = s
    this.persist()
  }

  resetCategoriesToDefault() {
    this.categories = structuredClone(DEFAULT_CATEGORIES)
    this.persist()
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cat'
}

export const workspace = new WorkspaceStore()
