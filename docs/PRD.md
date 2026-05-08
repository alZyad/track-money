# PRD: track-money

## Problem

I want to understand my monthly cash flow without manually scanning bank statement PDFs. The bank's web UI is slow, doesn't categorize, and doesn't visualize trends across months.

## Users

Solo: me. Single bank account, French personal finances.

## Goals

- Drop a monthly statement PDF → see structured transaction list
- Refine: assign categories, clean up auto-detected labels
- Visualize one month (pie chart by category)
- Visualize across months (category evolution over time)
- Sensitive data stays under user control (own Google Drive, not a third-party server)
- AI-assisted categorization to avoid hand-labelling every line

## Non-goals

- Multi-user / shared accounts
- Banks other than the one in scope (single bank only)
- Mobile app
- Real-time bank API integration (Tink, Bridge, etc.)
- Editing the parsed amounts (only labels/categories are user-editable)

## Pages

1. **Upload + transaction list** — drop one monthly PDF, parse, show all transactions in a table.
2. **Refinement** — assign a category to each transaction. Override auto-fill (rule-based or AI) per-Tx. No label editing, no notes — category only.
3. **Monthly visualization** — pie chart of categories for one month, plus headline numbers (in/out, net).
4. **Global visualization** — multi-month dashboard: category evolution over time, totals, trends.

## Roadmap

- **MVP (now)**: Page 1 only. Parser + table. In-memory only.
- **v0.2**: Page 2. Categorization (manual). Still in-memory.
- **v0.3**: Page 3. Monthly pie chart.
- **v0.4**: Page 4. Multi-month evolution charts (still session-scoped — useful only if user uploads several PDFs in the same session).
- **v0.5**: Google OAuth + Drive storage. First persistence layer. Stores: PDFs, refinements, category taxonomy, per-counterparty rules. Cross-month memory becomes possible.
- **v0.6**: Claude API integration for AI pre-categorization on upload.

## Success

- 100% of transactions in a bank statement parsed correctly (count + totals match the PDF's `TOTAUX` row).
- Categorization persists between sessions.
- Adding a new month doesn't require code changes.
- Page loads + parse < 3s on a normal laptop.

## Open questions

- Categories: fixed taxonomy or user-defined? Hierarchy (parent/child)?
- Auto-categorization rules: regex on counterparty? Per-merchant memory? AI-assisted from the start?
- Same counterparty across months: shared category? Confirm or auto-apply?
- Multi-month storage shape: one blob per month vs unified store?
- Google Drive layout: one JSON file? One per month? Folder?
- Claude integration: client-side (user's API key) or via a tiny proxy?
