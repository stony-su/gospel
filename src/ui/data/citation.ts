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

import { dataset } from '@/data/nutrition';
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

/**
 * The canonical reference ordering.
 *
 * The references page and every bracketed number that points at it must agree
 * on which source is [03]. Deriving both from one sorted list is what makes
 * that true by construction rather than by two call sites happening to sort
 * the same way.
 */
export const orderedSources: SourceRow[] = [...dataset.sources].sort((a, b) =>
  a.source_id.localeCompare(b.source_id),
);

const POSITIONS = new Map(orderedSources.map((source, index) => [source.source_id, index]));

/**
 * The `[NN]` label for a source id, or null if the id is not in the dataset.
 *
 * Returning null rather than a placeholder matters: a citation pointing at a
 * reference that does not exist should disappear, not render as [00].
 */
export function referenceLabelFor(sourceId: string): string | null {
  const position = POSITIONS.get(sourceId);
  return position === undefined ? null : referenceIndex(position);
}
