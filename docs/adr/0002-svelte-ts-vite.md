# ADR-0002: Svelte 5 + TypeScript + Vite

Date: 2026-05-08
Status: Accepted

## Context

Need a frontend stack for a 2-page app (upload + visualization) with charts. Want lightweight, but with real component model and type safety. User pushed back on React as overkill.

## Decision

- **Svelte 5** with runes (`$state`, `$props`) — small bundle, reactive without virtual DOM, components without React-style ceremony.
- **TypeScript** — type safety on the parser (transaction model, refs).
- **Vite** — zero-config bundling, fast HMR.

## Consequences

- Smaller learning surface than React for a 2-page app.
- Charts: any plain JS lib drops in via `<canvas>` / `<svg>` — no framework wrapper needed.
- Smaller community than React; fewer pre-built components.

## Alternatives considered

- **React + Vite**: rejected — adds VDOM overhead and JSX ceremony for no benefit at this size.
- **Plain HTML + JS**: rejected — user wants 2 pages and external chart libs, plain DOM state mgmt would get awkward fast.
- **Alpine.js**: rejected — fine for sprinkled interactivity, awkward for table rendering + page routing.
- **SvelteKit**: rejected — SSR/routing not needed for a 2-page client-only SPA.
