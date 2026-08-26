/**
 * The Grocery tab.
 *
 * The list for one cycle, grouped by aisle, with ticks. What appears here is
 * the difference between what the cycle needs and what the pantry still
 * holds, so it genuinely changes from cycle to cycle even though the meals do
 * not.
 *
 * The one-time setup list is kept separate: spices, oil and equipment are a
 * first shop, not a weekly one, and mixing them in would make every list look
 * enormous. The paragraphs that used to explain that are gone - the lists are
 * under separate headings, which says it.
 */

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { GroceryLine } from '@/domain/pantry/types';
import { useGospel, usePantryProjection } from '@/store/useGospel';
import { grade, space, stroke } from '@/theme/tokens';
import { Check, Segmented } from '@/ui/controls';
import { formatMass } from '@/ui/data';
import { Disclosure, Header, Pair, Screen, Tile } from '@/ui/layout';
import { AnimatedNumber, Reveal } from '@/ui/motion';
import { Figure, Label } from '@/ui/text';

function groupByAisle(lines: GroceryLine[]): [string, GroceryLine[]][] {
  const buckets = new Map<string, GroceryLine[]>();
  for (const line of lines) {
    const bucket = buckets.get(line.aisle);
    if (bucket) bucket.push(line);
    else buckets.set(line.aisle, [line]);
  }
  return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export default function GroceryTab() {
  const plan = useGospel((state) => state.plan);
  const checked = useGospel((state) => state.checked);
  const toggleChecked = useGospel((state) => state.toggleChecked);
  const clearChecked = useGospel((state) => state.clearChecked);
  const activeCycle = useGospel((state) => state.activeCycle);
  const setActiveCycle = useGospel((state) => state.setActiveCycle);
  const projection = usePantryProjection();

  const cycle = projection?.cycles[activeCycle];
  const grouped = useMemo(() => groupByAisle(cycle?.lines ?? []), [cycle]);

  if (!plan || !projection || !cycle) {
    return (
      <Screen bottomInset={70}>
        <Header title="Grocery" refButton />
        <Label color={grade[50]}>build a plan to generate a list</Label>
      </Screen>
    );
  }

  const total = cycle.lines.length;
  const done = cycle.lines.filter(
    (line) => checked[`${activeCycle}:${line.ingredientId}`],
  ).length;

  const cycleOptions = projection.cycles
    .slice(0, 8)
    .map((_, index) => ({ value: index, label: String(index + 1) }));

  return (
    <Screen bottomInset={70}>
      <Header
        title="Grocery"
        refButton
        right={<Label>{`cycle ${activeCycle + 1}`}</Label>}
      />

      <Reveal index={0} style={styles.cycle}>
        <Segmented options={cycleOptions} value={activeCycle} onChange={setActiveCycle} />
      </Reveal>

      <Reveal index={1} style={styles.summary}>
        <Pair>
          <Tile label="estimated">
            <AnimatedNumber value={cycle.totalCost} precision={2} prefix="£" color={grade[96]} />
          </Tile>
          <Tile label="ticked">
            <Figure color={grade[96]}>{`${done} / ${total}`}</Figure>
          </Tile>
          {cycle.expiredGrams > 0 && (
            <Tile label="expired" wide>
              <Figure color={grade[96]}>{formatMass(cycle.expiredGrams)}</Figure>
            </Tile>
          )}
        </Pair>
      </Reveal>

      {activeCycle === 0 && projection.oneTimeItems.length > 0 && (
        <Disclosure
          label="One-time setup"
          meta={`${projection.oneTimeItems.length} · £${projection.oneTimeItems
            .reduce((sum, item) => sum + item.cost, 0)
            .toFixed(2)}`}
          index={2}
        >
          {projection.oneTimeItems.map((line) => (
            <Check
              key={line.ingredientId}
              label={line.name}
              meta={`${formatMass(line.gramsToBuy)} · £${line.cost.toFixed(2)}`}
              checked={Boolean(checked[`setup:${line.ingredientId}`])}
              onPress={() => toggleChecked('setup', line.ingredientId)}
            />
          ))}
        </Disclosure>
      )}

      {activeCycle === 0 && projection.equipment.length > 0 && (
        <Disclosure label="Equipment" meta={String(projection.equipment.length)} index={3}>
          {projection.equipment.map((item) => (
            <Check
              key={item}
              label={item.charAt(0).toUpperCase() + item.slice(1)}
              checked={Boolean(checked[`equipment:${item}`])}
              onPress={() => toggleChecked('equipment', item)}
            />
          ))}
        </Disclosure>
      )}

      {grouped.length === 0 ? (
        <Label color={grade[70]} style={styles.nothing}>
          nothing to buy — the pantry covers this cycle
        </Label>
      ) : (
        grouped.map(([aisle, lines], position) => (
          <Disclosure
            key={aisle}
            label={aisle}
            meta={`${lines.length} · £${lines
              .reduce((sum, line) => sum + line.cost, 0)
              .toFixed(2)}`}
            index={4 + position}
          >
            {lines.map((line) => (
              <Check
                key={line.ingredientId}
                label={line.name}
                meta={`${line.packsToBuy > 1 ? `${line.packsToBuy} × ` : ''}${formatMass(
                  line.gramsToBuy / line.packsToBuy,
                )} · £${line.cost.toFixed(2)}`}
                checked={Boolean(checked[`${activeCycle}:${line.ingredientId}`])}
                onPress={() => toggleChecked(activeCycle, line.ingredientId)}
              />
            ))}
          </Disclosure>
        ))
      )}

      {done > 0 && (
        <Reveal index={12}>
          <Label
            color={grade[70]}
            onPress={() => clearChecked(activeCycle)}
            style={styles.clear}
          >
            clear ticks
          </Label>
        </Reveal>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cycle: {
    marginBottom: space.lg,
  },
  summary: {
    marginBottom: space.xl,
  },
  nothing: {
    marginTop: space.lg,
  },
  clear: {
    marginTop: space.md,
    paddingVertical: space.sm,
  },
});
