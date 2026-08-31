/**
 * Who to credit for the recipe library, derived from the library itself.
 *
 * Nearly every photograph in the app is CC BY-SA or CC BY, and both licences
 * require the author and the licence to be named. The recipe screen does that
 * at the point of use; this is the complete list, so the obligation is met
 * whether or not a reader ever opens a particular dish.
 *
 * Computed from recipes.json rather than written down, for the same reason the
 * nutrition references are: a hand-kept credits page drifts, and a credits
 * page that has drifted is a licence breach rather than a typo.
 */

import { recipes } from '@/data/recipes';

export interface LibrarySource {
  id: string;
  name: string;
  what: string;
  license: string;
  url: string;
  /** How many of the hundred recipes this source is behind. */
  count: number;
}

export interface PhotographCredit {
  slug: string;
  dish: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}

const scraped = recipes.filter((recipe) => recipe.method_source.kind === 'wikibooks');
const authored = recipes.filter((recipe) => recipe.method_source.kind === 'authored');
const described = recipes.filter((recipe) => recipe.description.length > 0);

/** The upstream sources, most-used first. */
export const librarySources: LibrarySource[] = [
  {
    id: 'commons',
    name: 'Wikimedia Commons',
    what: 'dish photographs',
    license: 'per file, listed below',
    url: 'https://commons.wikimedia.org/',
    count: recipes.length,
  },
  {
    id: 'wikibooks',
    name: 'Wikibooks Cookbook',
    what: 'ingredients and method',
    license: 'CC BY-SA 4.0',
    url: 'https://en.wikibooks.org/wiki/Cookbook:Table_of_Contents',
    count: scraped.length,
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    what: 'dish descriptions',
    license: 'CC BY-SA 4.0',
    url: 'https://en.wikipedia.org/',
    count: described.length,
  },
  {
    id: 'fdc',
    name: 'USDA FoodData Central',
    what: 'ingredient nutrient panels',
    license: 'public domain',
    url: 'https://fdc.nal.usda.gov/',
    count: recipes.length,
  },
  {
    id: 'authored',
    name: 'Written for Gospel',
    what: 'ingredients and method, where no permitted source publishes one',
    license: 'part of this app',
    url: '',
    count: authored.length,
  },
].filter((source) => source.count > 0);

/** Every photograph, alphabetically by dish. */
export const photographCredits: PhotographCredit[] = recipes
  .map((recipe) => ({
    slug: recipe.slug,
    dish: recipe.name,
    author: recipe.image.author,
    license: recipe.image.license,
    licenseUrl: recipe.image.license_url,
    sourceUrl: recipe.image.source_url,
  }))
  .sort((a, b) => a.dish.localeCompare(b.dish));

/** Distinct licences in use, most common first - a summary line for the page. */
export const licenceSummary: { license: string; count: number }[] = (() => {
  const counts = new Map<string, number>();
  for (const credit of photographCredits) {
    counts.set(credit.license, (counts.get(credit.license) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([license, count]) => ({ license, count }))
    .sort((a, b) => b.count - a.count);
})();
