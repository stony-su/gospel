/**
 * Citation formatting.
 *
 * Exercised against the real dataset as well as synthetic rows, because the
 * shapes that matter are the ones the workbook actually produces.
 */

import { dataset } from '@/data/nutrition';
import type { SourceRow } from '@/domain/nutrition/types';
import { citationText, hostOf, referenceIndex } from '@/ui/data/citation';

const row = (over: Partial<SourceRow>): SourceRow => ({
  source_id: 'TEST',
  citation: 'Short citation',
  url: null,
  year: null,
  full_citation: null,
  ...over,
});

describe('citationText', () => {
  it('strips the trailing editorial note', () => {
    const text = citationText(
      row({ full_citation: 'Institute of Medicine. DRI. 2005. *Source of the AMDRs.*' }),
    );

    expect(text).toBe('Institute of Medicine. DRI. 2005.');
  });

  it('strips an inlined url', () => {
    const text = citationText(
      row({ full_citation: 'NASEM. Sodium and Potassium. 2019. https://example.org/a/b' }),
    );

    expect(text).toBe('NASEM. Sodium and Potassium. 2019.');
  });

  it('falls back to the short citation when there is no long form', () => {
    expect(citationText(row({ full_citation: null }))).toBe('Short citation');
  });

  it('never returns empty, even when the long form is only a url', () => {
    const text = citationText(row({ full_citation: 'https://example.org', citation: 'Fallback' }));

    expect(text).toBe('Fallback');
  });

  it('leaves every real dataset citation non-empty and free of markup', () => {
    for (const source of dataset.sources) {
      const text = citationText(source);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/https?:\/\//);
      expect(text).not.toMatch(/\*$/);
    }
  });
});

describe('hostOf', () => {
  it('drops the scheme, path and www', () => {
    expect(hostOf('https://www.canada.ca/en/health-canada/services')).toBe('canada.ca');
  });

  it('returns null for a missing url so the entry renders inert', () => {
    expect(hostOf(null)).toBeNull();
  });

  it('returns null rather than throwing on a malformed url', () => {
    expect(hostOf('not a url')).toBeNull();
  });

  it('resolves a host for every source in the dataset', () => {
    for (const source of dataset.sources) {
      expect(hostOf(source.url)).not.toBeNull();
    }
  });
});

describe('referenceIndex', () => {
  it('pads to a fixed width so the column does not shift', () => {
    expect(referenceIndex(0)).toBe('[01]');
    expect(referenceIndex(19)).toBe('[20]');
  });
});
