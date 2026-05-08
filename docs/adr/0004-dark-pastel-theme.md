# ADR-0004: Dark mode only with pastel accents

Date: 2026-05-08
Status: Accepted

## Context

Solo personal-finance tool. User wanted a calm, low-eye-strain UI rather than stark monochrome.

## Decision

- Dark mode only (`color-scheme: dark only`).
- Cream-on-near-black ink for low contrast fatigue.
- Pastel accents (lavender, mint, peach, blush) for type badges and direction colors:
  - mint = `in`
  - blush = `out`
  - lavender = neutral / generic accent
  - peach = card payments

## Consequences

- No theme toggle to maintain.
- All accent colors are token-defined in `src/app.css` (`--accent-*`), so swapping is one-file.
- Light-mode users (rare for solo tool) are out of scope.

## Alternatives considered

- **Light + dark with `prefers-color-scheme`**: rejected — user explicitly wanted dark-only.
- **High-contrast monochrome**: rejected — boring for a personal tool.
