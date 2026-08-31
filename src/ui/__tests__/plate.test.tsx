/**
 * Plate renders a photograph in colour.
 *
 * This file exists because the component used to do the opposite. It ran every
 * image through a Rec. 709 luma matrix in react-native-svg, which had two
 * consequences: food photography arrived on screen grey, and the component
 * could not be render-tested at all, because react-native-svg resolves to its
 * native TypeScript source under Jest and dies on untransformed internals.
 *
 * Dropping the filter fixed both. The assertions below are what stops it
 * coming back by accident: no svg, no colour matrix, no CSS filter.
 */

import { render, screen } from '@testing-library/react';

import { Plate } from '@/ui/data/Plate';

const URI = 'https://example.invalid/carbonara.jpg';
const source = { uri: URI };

describe('Plate', () => {
  it('draws the photograph', () => {
    const { container } = render(
      <Plate source={source} width={200} height={120} accessibilityLabel="Carbonara" />,
    );

    expect(screen.getByLabelText('Carbonara')).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(URI);
    expect(container.innerHTML).toContain(URI);
  });

  it('applies no colour filter', () => {
    const { container } = render(
      <Plate source={source} width={200} height={120} accessibilityLabel="Carbonara" />,
    );

    // The greyscale implementation put an feColorMatrix inside an <svg><defs>.
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('feColorMatrix')).toBeNull();
    // And nothing may reach the same result through CSS instead.
    expect(container.innerHTML).not.toMatch(/grayscale|saturate|luminosity/i);
  });

  it('keeps the same footprint when there is no photograph', () => {
    // A missing photograph must not shift the layout around it, which is the
    // whole reason the fallback exists rather than rendering nothing.
    const withPhoto = render(<Plate source={source} width={200} height={120} />);
    const framed = withPhoto.container.firstElementChild as HTMLElement;
    expect(framed.style.width).toBe('200px');
    expect(framed.style.height).toBe('120px');
    withPhoto.unmount();

    const without = render(
      <Plate source={null} width={200} height={120} fallbackLabel="no photograph" />,
    );
    const empty = without.container.firstElementChild as HTMLElement;

    expect(empty.style.width).toBe('200px');
    expect(empty.style.height).toBe('120px');
    // The Label register renders uppercase.
    expect(screen.getByText(/no photograph/i)).toBeTruthy();
  });
});
