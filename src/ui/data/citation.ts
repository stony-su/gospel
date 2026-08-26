/**
 * Citation formatting.
 *
 * The dataset's `full_citation` is built for a spreadsheet cell, not a page:
 * it repeats the URL inline and often ends with an italicised editorial note
 * explaining which values the source backs. Both are redundant on a
 * references page that already shows the link and is meant to be read rather
 * than audited line by line.
 *
 * Pure string work, kept out of the screen so it can be tested. A regex that
 * silently eats half a citation is exactly the kind of bug that never gets
 * noticed by looking.
 */

import type { SourceRow } from '@/domain/nutrition/types';

/** Trailing `*...*` note the workbook appends to most citations. */
const EDITORIAL = /\s*\*[^*]*\*\s*$/;

const URL_IN_TEXT = /https?:\/\/\S+/g;

/**
 * The citation as it should read on the page.
 *
 * Falls back to the short `citation` when there is no long form. Never
 * returns an empty string: a source with nothing but a URL still shows its
 * identifier rather than a blank line.
 */
export function citationText(source: SourceRow): string {
  const raw = source.full_citation ?? source.citation ?? '';

  const cleaned = raw
    .replace(EDITORIAL, '')
    .replace(URL_IN_TEXT, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (cleaned) return cleaned;
  return source.citation?.trim() || source.source_id;
}

/**
 * The host of a source's URL, for display under the citation.
 *
 * Shows where a reference actually lives without spending three lines on a
 * path. Returns null for a missing or unparseable URL, and the caller must
 * then render the entry as inert - an un-tappable row rather than a link
 * that goes nowhere.
 */
export function hostOf(url: string | null): string | null {
  if (!url) return null;

  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** `[01]`-style index, so the numbering column stays the same width. */
export function referenceIndex(position: number): string {
  return `[${String(position + 1).padStart(2, '0')}]`;
}
