# ADR-0001: Frontend-only SPA

Date: 2026-05-08
Status: Accepted

## Context

Need to parse bank statement PDFs and visualize transactions. Bank data is sensitive — should not transit through a third-party server.

## Decision

Build as a frontend-only single-page app. No backend. PDFs parsed in the browser, never uploaded anywhere.

## Consequences

- Privacy: PDFs never leave the user's machine.
- No persistence across sessions unless we add localStorage / IndexedDB later.
- No multi-device sync.
- Static hosting (GitHub Pages, Netlify, etc.) sufficient.

## Alternatives considered

- **Backend with auth**: rejected — overkill for solo use; introduces a privacy attack surface.
- **Bank API integration (Tink, Bridge)**: rejected — vendor lock-in, paid tiers, requires backend for OAuth.
