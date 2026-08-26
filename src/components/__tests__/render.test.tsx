/**
 * Render smoke tests.
 *
 * The domain suite proves the numbers are right and the bundler proves every
 * import resolves, but neither executes a component. These render the real
 * components through react-native-web into jsdom, which runs the actual
 * component bodies - hooks, style objects, formatting and all - and fails on
 * anything that would throw on a device.
 *
 * Components built on react-native-svg are absent: the package resolves to its
 * native TypeScript source under jest, and forcing its web build through the
 * resolver costs more than it proves. Their real risk is the geometry, which is
 * pure and tested directly in src/theme/__tests__/twine.test.ts; what remains
 * is declarative markup.
 */

import { render, screen } from '@testing-library/react';

import { NutrientBar } from '@/components/charts/NutrientBar';
import { DietSpectrum } from '@/components/DietSpectrum';
import { InstrumentSlider } from '@/components/primitives/InstrumentSlider';
import { Chip, CheckRow, OptionRow, Segmented } from '@/components/primitives/Choice';
import { Body, Doctrine, Eyebrow, Readout, Title } from '@/components/primitives/Text';

describe('typographic primitives', () => {
  it('renders each register', () => {
    render(
      <>
        <Doctrine>Let science be my gospel</Doctrine>
        <Title>Nutrition</Title>
        <Body>Body copy</Body>
        <Eyebrow>label</Eyebrow>
        <Readout>2444</Readout>
      </>,
    );

    expect(screen.getByText('Let science be my gospel')).toBeTruthy();
    expect(screen.getByText('2444')).toBeTruthy();
    // Eyebrows uppercase their content at the component, not in CSS.
    expect(screen.getByText('LABEL')).toBeTruthy();
  });
});

describe('NutrientBar', () => {
  it('shows both intake and target when the nutrient is measured', () => {
    render(
      <NutrientBar
        name="Protein"
        unit="g"
        target={95}
        achieved={88}
        coverage="measured"
      />,
    );
    expect(screen.getByText('Protein')).toBeTruthy();
    expect(screen.getByText('93%')).toBeTruthy();
  });

  it('says so plainly when a nutrient cannot be measured', () => {
    render(
      <NutrientBar
        name="Vitamin B12"
        unit="ug"
        target={2.4}
        achieved={null}
        coverage="awaiting_fdc"
      />,
    );
    expect(screen.getByText('AWAITING FDC')).toBeTruthy();
  });

  it('renders an over-limit nutrient with its warning', () => {
    render(
      <NutrientBar
        name="Iron"
        unit="mg"
        target={48.6}
        achieved={48.6}
        coverage="measured"
        ulValue={45}
        overUl
      />,
    );
    expect(screen.getByText(/Over upper limit/)).toBeTruthy();
  });

  it('survives a zero target without dividing by it', () => {
    render(
      <NutrientBar
        name="Carbohydrate"
        unit="g"
        target={0}
        achieved={0}
        coverage="measured"
      />,
    );
    expect(screen.getByText('Carbohydrate')).toBeTruthy();
  });
});

describe('onboarding controls', () => {
  it('renders the diet spectrum with its active anchor', () => {
    render(<DietSpectrum position={3} onChange={() => {}} />);
    // The active anchor names the heading and marks the axis, so it appears twice.
    expect(screen.getAllByText('IIFYM')).toHaveLength(2);
  });

  it('renders every anchor label on the spectrum axis', () => {
    render(<DietSpectrum position={0} onChange={() => {}} />);
    expect(screen.getByText('VEGAN')).toBeTruthy();
    expect(screen.getByText('CARNIVOROUS')).toBeTruthy();
  });

  it('renders the slider readout and its bounds', () => {
    render(
      <InstrumentSlider
        value={78}
        onChange={() => {}}
        min={35}
        max={200}
        unit="kg"
        minLabel="35 kg"
        maxLabel="200 kg"
      />,
    );
    expect(screen.getByText('78')).toBeTruthy();
    expect(screen.getByText('35 KG')).toBeTruthy();
  });

  it('formats a slider value when given a formatter', () => {
    render(
      <InstrumentSlider
        value={90}
        onChange={() => {}}
        min={10}
        max={180}
        format={(value) => `${value} min`}
      />,
    );
    expect(screen.getByText('90 min')).toBeTruthy();
  });

  it('renders selection controls', () => {
    render(
      <>
        <OptionRow label="Male" selected onPress={() => {}} />
        <Chip label="Italian" meta="52" selected={false} onPress={() => {}} />
        <Segmented
          options={[
            { value: 7, label: 'Weekly' },
            { value: 28, label: 'Month' },
          ]}
          value={7}
          onChange={() => {}}
        />
        <CheckRow label="Sour cream" meta="£1.26" checked onPress={() => {}} />
      </>,
    );

    expect(screen.getByText('Male')).toBeTruthy();
    expect(screen.getByText('Italian')).toBeTruthy();
    expect(screen.getByText('WEEKLY')).toBeTruthy();
    expect(screen.getByText('Sour cream')).toBeTruthy();
  });
});
