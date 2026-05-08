# ADR-0003: pdfjs-dist with positional row reconstruction

Date: 2026-05-08
Status: Accepted

## Context

Bank "Relevé de compte" PDFs (French statement format, e.g. BNP Paribas, Société Générale, Crédit Agricole) have a 5-column transaction table (DATE | LIBELLE | VALEUR | DEBIT | CREDIT). Naive text extraction (concatenating `getTextContent` items in stream order) returns text **column-streamed**, not row-ordered: all libellé blocks emerge first, then a flat list of dates and amounts at the bottom of the page. Line-by-line parsing cannot recover the rows.

## Decision

Use `pdfjs-dist` with **positional reconstruction**:

1. For each page, call `getTextContent()` and read `transform[4]` (x) and `transform[5]` (y) for each item.
2. Group items by Y coordinate (within tolerance ~2px) → reconstructs visual rows.
3. Within each row, sort items by X.
4. Detect column boundaries from the header row ("DATE", "LIBELLE", "VALEUR", "DEBIT", "CREDIT") — use midpoints between header X positions as bucket thresholds.
5. Multi-line libellé blocks: rows with no DATE column are continuation rows of the previous transaction.

## Consequences

- Robust against the column-streamed extraction order.
- Tied to the specific bank's PDF layout: works because columns are vertically aligned and the header is detectable. A redesign of the PDF layout breaks this.
- Slightly heavier than naive text extraction (~3KB extra in parser logic).

## Alternatives considered

- **Naive `getTextContent` joining**: rejected — produces unrecoverably scrambled output for this PDF.
- **OCR (Tesseract)**: rejected — slow, error-prone, overkill for a text PDF.
- **Server-side parser (e.g. `pdfplumber` in Python)**: rejected — violates ADR-0001 (frontend-only).
- **PDF → HTML conversion lib**: rejected — adds another dependency without solving the column ordering issue.
