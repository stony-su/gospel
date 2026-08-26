import { formatMass } from '@/ui/data/units';

describe('formatMass', () => {
  it('shows grams below a kilo', () => {
    expect(formatMass(450)).toBe('450 g');
  });

  it('rounds grams rather than showing a fraction of one', () => {
    expect(formatMass(450.7)).toBe('451 g');
  });

  it('switches to kilos at a thousand', () => {
    expect(formatMass(1400)).toBe('1.4 kg');
  });

  it('drops the decimal on a round kilo', () => {
    expect(formatMass(2000)).toBe('2 kg');
  });

  it('handles zero', () => {
    expect(formatMass(0)).toBe('0 g');
  });

  it('renders a dash rather than NaN', () => {
    expect(formatMass(Number.NaN)).toBe('—');
  });
});
