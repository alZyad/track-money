export type Route = 'home' | 'monthly-visualization'

const ROUTES: readonly Route[] = ['home', 'monthly-visualization']

function parseHash(hash: string): Route {
  const id = hash.replace(/^#\/?/, '')
  return (ROUTES as readonly string[]).includes(id) ? (id as Route) : 'home'
}

class RouteStore {
  current: Route = $state(parseHash(typeof window !== 'undefined' ? window.location.hash : ''))

  go(r: Route) {
    this.current = r
    const target = r === 'home' ? '' : `#/${r}`
    if (window.location.hash !== target) {
      // Update without firing hashchange for our own navigation.
      history.replaceState(null, '', target || window.location.pathname + window.location.search)
    }
  }

  bindHashListener() {
    const onChange = () => {
      this.current = parseHash(window.location.hash)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }
}

export const route = new RouteStore()
