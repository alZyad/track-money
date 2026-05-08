# track-money

Frontend-only web app that parses bank statement PDFs (French "Relevé de compte" format, e.g. BNP Paribas, Société Générale, Crédit Agricole) and visualizes in/out transfers.

Stack: Svelte 5 + TypeScript + Vite, `pdfjs-dist` for PDF parsing.

## Documentation map

- `CONTEXT.md` — domain language (terms, relationships, invariants).
- `docs/PRD.md` — product spec and roadmap.
- `docs/data-model.md` — TypeScript shapes for every entity.
- `docs/processes.md` — algorithms (Tx identity, identifier derivation, rule matching, upload conflict).
- `docs/adr/` — architectural decisions.
- `.scratch/open-questions.md` — unresolved design threads. Read this to resume a paused grilling session.

## Agent skills

### Issue tracker

Issues live in GitHub Issues at `alZyad/track-money`. Use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at repo root. See `docs/agents/domain.md`.
