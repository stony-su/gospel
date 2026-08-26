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
 *
 * Components built on react-native-svg are absent, and cannot be added. Under
 * jest the package resolves to its TypeScript source, whose barrel reaches a
 * Fabric native component and dies on untransformed react-native internals -
 * and its `.web` entry re-exports the same barrel, so mapping to it changes
 * nothing. That rules out Field, Plot, Axis, Rule, Hatch, ProgressRail,
 * Plate, SunMap and the NutrientBar track.
 *
 * What those components risk getting wrong is their geometry, and that is
 * pure and covered directly in src/theme/__tests__/plot.test.ts and
 * field.test.ts. What is left is declarative markup.
 */

import { fireEvent, render, screen } from '@testing-library/react';

// Imported from their own modules, not the barrel: the barrel also exports
// Screen and Header, which reach expo-router and safe-area-context native
// specs and cannot load in this environment.
import { StatBlock } from '@/ui/data/StatBlock';
import { Check } from '@/ui/controls/Check';
import { Chip } from '@/ui/controls/Chip';
import { Option } from '@/ui/controls/Option';
import { Segmented } from '@/ui/controls/Segmented';
import { Slider } from '@/ui/controls/Slider';
import { Stepper } from '@/ui/controls/Stepper';
import { Disclosure } from '@/ui/layout/Disclosure';
import { Divider } from '@/ui/layout/Divider';
import { Row } from '@/ui/layout/Row';
import { Section } from '@/ui/layout/Section';
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

describe('layout', () => {
  it('renders a section with its label and body', () => {
    render(
      <Section label="Energy" index={1}>
        <Figure>2444 kcal</Figure>
      </Section>,
    );

    expect(screen.getByText('ENERGY')).toBeTruthy();
    expect(screen.getByText('2444 kcal')).toBeTruthy();
  });

  it('renders a row with both sides', () => {
    render(<Row left={<Figure>Iron</Figure>} right={<Figure>18 mg</Figure>} />);

    expect(screen.getByText('Iron')).toBeTruthy();
    expect(screen.getByText('18 mg')).toBeTruthy();
  });

  it('renders a row with no right side', () => {
    render(<Row left={<Figure>Iron</Figure>} />);

    expect(screen.getByText('Iron')).toBeTruthy();
  });

  it('renders a divider', () => {
    const { container } = render(<Divider />);

    expect(container.firstChild).toBeTruthy();
  });
});

describe('controls', () => {
  it('fires an option and shows its meta', () => {
    const onPress = jest.fn();
    render(<Option label="Moderate" meta="x1.35" selected={false} onPress={onPress} />);

    expect(screen.getByText('MODERATE')).toBeTruthy();
    expect(screen.getByText('x1.35')).toBeTruthy();

    fireEvent.click(screen.getByText('MODERATE'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fires a chip', () => {
    const onPress = jest.fn();
    render(<Chip label="Thai" meta="12" selected onPress={onPress} />);

    fireEvent.click(screen.getByText('THAI'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fires a check', () => {
    const onPress = jest.fn();
    render(<Check label="Olive oil" meta="500 ml" checked={false} onPress={onPress} />);

    fireEvent.click(screen.getByText('Olive oil'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('reports the chosen segment', () => {
    const onChange = jest.fn();
    render(
      <Segmented
        options={[
          { value: 7, label: '7 days' },
          { value: 14, label: '14 days' },
        ]}
        value={7}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText('14 DAYS'));
    expect(onChange).toHaveBeenCalledWith(14);
  });

  it('renders a slider with its label and readout', () => {
    render(
      <Slider value={75} min={40} max={140} unit="kg" label="Weight" onChange={() => {}} />,
    );

    expect(screen.getByText('WEIGHT')).toBeTruthy();
    expect(screen.getByDisplayValue('75 kg')).toBeTruthy();
  });

  it('steps within its bounds and refuses to leave them', () => {
    const onChange = jest.fn();
    render(<Stepper value={7} min={7} max={14} unit="days" onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Decrease'));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Increase'));
    expect(onChange).toHaveBeenCalledWith(8);
  });
});

describe('data', () => {
  // NutrientBar, SunMap and DietSpectrum all import react-native-svg and so
  // cannot load here. What they risk getting wrong is arithmetic - the fill
  // fraction, the amount precision, the status precedence - and that is pure
  // and covered in mark.test.tsx.
  it('renders a stat block with its note', () => {
    render(
      <StatBlock label="Energy" value={2444} unit="kcal" note="BMR 1810 x 1.35" />,
    );

    expect(screen.getByText('ENERGY')).toBeTruthy();
    expect(screen.getByDisplayValue('2444')).toBeTruthy();
    expect(screen.getByText('BMR 1810 x 1.35')).toBeTruthy();
  });
});

describe('disclosure', () => {
  it('states what is inside and how much of it, before you open it', () => {
    render(
      <Disclosure label="Ingredients" meta="12">
        <Figure>olive oil</Figure>
      </Disclosure>,
    );

    expect(screen.getByText('INGREDIENTS')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('opens on press', () => {
    render(
      <Disclosure label="Ingredients">
        <Figure>olive oil</Figure>
      </Disclosure>,
    );

    fireEvent.click(screen.getByText('INGREDIENTS'));

    expect(screen.getAllByText('olive oil').length).toBeGreaterThan(0);
  });

  it('starts open when asked to', () => {
    render(
      <Disclosure label="Method" defaultOpen>
        <Figure>step one</Figure>
      </Disclosure>,
    );

    expect(screen.getAllByText('step one').length).toBeGreaterThan(0);
  });

  it('renders without a meta', () => {
    render(
      <Disclosure label="Equipment">
        <Figure>loaf pan</Figure>
      </Disclosure>,
    );

    expect(screen.getByText('EQUIPMENT')).toBeTruthy();
  });
});
