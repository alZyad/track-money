import type { Category } from './types'
import { DEFAULT_CATEGORIES } from './types'

class WorkspaceStore {
  categories: Category[] = $state(structuredClone(DEFAULT_CATEGORIES))

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

  reset() {
    this.categories = structuredClone(DEFAULT_CATEGORIES)
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cat'
}

export const workspace = new WorkspaceStore()
