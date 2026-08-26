/**
 * Type register relationships.
 *
 * The sizes themselves are a design choice and not worth pinning, but the
 * relationships between them are load-bearing: Header picks the compact title
 * for long headings precisely because it is smaller, and a future edit that
 * quietly made them equal would silently reintroduce the overlap it was added
 * to fix.
 */

import { registers } from '@/theme/tokens';

describe('title registers', () => {
  it('makes the compact title smaller than the full one', () => {
    expect(registers.titleCompact.fontSize).toBeLessThan(registers.title.fontSize);
  });

  it('keeps the compact title above the label register, so it still reads as a title', () => {
    expect(registers.titleCompact.fontSize).toBeGreaterThan(registers.label.fontSize);
  });
});

describe('the register scale', () => {
  it('orders display, title and figure by descending size', () => {
    expect(registers.display.fontSize).toBeGreaterThan(registers.title.fontSize);
    expect(registers.title.fontSize).toBeGreaterThan(registers.figure.fontSize);
    expect(registers.figure.fontSize).toBeGreaterThan(registers.figureSmall.fontSize);
  });

  it('keeps every line height even, so text centres cleanly against a rule', () => {
    for (const [name, register] of Object.entries(registers)) {
      expect({ name, remainder: register.lineHeight % 2 }).toEqual({ name, remainder: 0 });
    }
  });

  it('gives every register more leading than its own size', () => {
    for (const [name, register] of Object.entries(registers)) {
      expect({ name, leads: register.lineHeight > register.fontSize }).toEqual({
        name,
        leads: true,
      });
    }
  });
});
