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

import { fireEvent, render, screen } from '@testing-library/react';

import { AnimatedNumber, MorphText, Press, Reveal } from '@/ui/motion';
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

describe('motion primitives', () => {
  it('reveals its children', () => {
    render(
      <Reveal index={2}>
        <Figure>revealed</Figure>
      </Reveal>,
    );

    expect(screen.getByText('revealed')).toBeTruthy();
  });

  it('renders an animated number at its settled value', () => {
    render(<AnimatedNumber value={2444} suffix=" kcal" />);

    expect(screen.getByDisplayValue('2444 kcal')).toBeTruthy();
  });

  it('honours precision on an animated number', () => {
    render(<AnimatedNumber value={1.35} precision={2} prefix="x" />);

    expect(screen.getByDisplayValue('x1.35')).toBeTruthy();
  });

  it('renders morphing text in the requested register', () => {
    render(<MorphText variant="label">temperate</MorphText>);

    expect(screen.getByText('TEMPERATE')).toBeTruthy();
  });

  it('fires a press', () => {
    const onPress = jest.fn();
    render(
      <Press onPress={onPress} accessibilityLabel="pick">
        <Figure>tap me</Figure>
      </Press>,
    );

    fireEvent.click(screen.getByText('tap me'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('still renders its children when selected', () => {
    render(
      <Press onPress={() => {}} selected accessibilityLabel="chosen">
        <Figure>chosen</Figure>
      </Press>,
    );

    expect(screen.getByText('chosen')).toBeTruthy();
  });

  it('does not fire when disabled', () => {
    const onPress = jest.fn();
    render(
      <Press onPress={onPress} disabled accessibilityLabel="inert">
        <Figure>inert</Figure>
      </Press>,
    );

    fireEvent.click(screen.getByText('inert'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
