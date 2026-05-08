# ADR-0005: In-memory until Drive; Drive is the only persistence layer

Date: 2026-05-08
Status: Accepted

## Context

Roadmap calls for: persistent multi-month storage, Google OAuth + Drive integration, Claude-based AI pre-categorization. The MVP doesn't need any of these.

Earlier draft of this ADR proposed `localStorage` as a stop-gap for refinements. Rejected: the user explicitly wants Drive to be the *single* persistence layer. Pre-Drive, all state is ephemeral.

## Decision

- **Pre-v0.5: in-memory only.** Statements, refinements, category taxonomy, and counterparty rules live in memory for the duration of the session. Refresh = clean slate. No `localStorage`, no `IndexedDB`, no cookies.
- **v0.5: Google Drive.** When integration lands, Drive holds: input PDFs, parsed + refined transactions, user-defined category taxonomy, per-counterparty mapping rules. Drive is the source of truth.
- **v0.6: Claude API for pre-categorization** (open: client-side with user's API key vs minimal proxy — future ADR).

Until Drive lands, code should not assume any persistence. The refinement model is storage-agnostic.

## Consequences

- MVP ships without auth, without storage, without external API calls.
- No data migration story between localStorage and Drive (we just don't have localStorage).
- Cross-month features (counterparty memory, multi-month viz) only become meaningful in v0.5+.
- Demo / first-time use: user uploads, plays with one statement, closes the tab, data is gone. Acceptable for early iteration.

## Alternatives considered

- **localStorage stop-gap**: rejected — user wants Drive as the single source of truth, and a stop-gap creates a migration tax later.
- **IndexedDB**: rejected — same reason, plus more complexity than localStorage.
- **Pick everything now**: rejected — premature; design space is wide.
