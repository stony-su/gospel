/**
 * Render smoke tests for the src/ui layer.
 *
 * The domain suite proves the numbers are right and the bundler proves every
 * import resolves, but neither executes a component. These render the real
 * components through react-native-web into jsdom, which runs the actual
 * component bodies - hooks, style objects, formatting and all - and fails on
 * anything that would throw on a device.
 *
 * Animation is stubbed to its settled state by src/test/reanimatedMock.ts, so
 * what these assert is where a component comes to rest.
 */

import { render, screen } from '@testing-library/react';

import { Display, Figure, Heading, Label, Prose, Title } from '@/ui/text';

describe('text registers', () => {
  it('renders every register', () => {
    render(
      <>
        <Display>2444</Display>
        <Figure>18 mg</Figure>
        <Figure small>452 µg</Figure>
        <Prose>A sentence, which the app has few of.</Prose>
      </>,
    );

    expect(screen.getByText('2444')).toBeTruthy();
    expect(screen.getByText('18 mg')).toBeTruthy();
    expect(screen.getByText('452 µg')).toBeTruthy();
    expect(screen.getByText('A sentence, which the app has few of.')).toBeTruthy();
  });

  it('uppercases title, heading and label at the component', () => {
    render(
      <>
        <Title>Nutrition</Title>
        <Heading>Energy</Heading>
        <Label>per day</Label>
      </>,
    );

    expect(screen.getByText('NUTRITION')).toBeTruthy();
    expect(screen.getByText('ENERGY')).toBeTruthy();
    expect(screen.getByText('PER DAY')).toBeTruthy();
  });

  it('leaves non-string children alone rather than throwing on them', () => {
    render(
      <Title>
        <Figure>2444</Figure>
      </Title>,
    );

    expect(screen.getByText('2444')).toBeTruthy();
  });
});
