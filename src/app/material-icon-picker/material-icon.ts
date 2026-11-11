/** The Material Symbols categories, as on Google Fonts. */
export const MATERIAL_ICON_CATEGORIES = [
  'Actions',
  'Activities',
  'Android',
  'Audio & Video',
  'Business',
  'Communicate',
  'Hardware',
  'Home',
  'Household',
  'Images',
  'Maps',
  'Privacy',
  'Social',
  'Text',
  'Transit',
  'Travel',
  'UI Actions',
] as const;

export type MaterialIconCategory = (typeof MATERIAL_ICON_CATEGORIES)[number];

export interface MaterialIcon {
  /** The ligature, as used in `<mat-icon>{{ name }}</mat-icon>`, e.g. `arrow_back`. */
  readonly name: string;
  /** Human-readable name, e.g. `Arrow Back`. */
  readonly displayName: string;
  readonly category: MaterialIconCategory;
  /** Other words people search for, e.g. `previous` and `return` for `arrow_back`. */
  readonly aliases: readonly string[];
}

export interface MaterialIconFilter {
  /** Matches the start of words in the display name and aliases. Every word must match. */
  readonly query?: string;
  /** Keeps icons in any of these categories. Empty or missing keeps all categories. */
  readonly categories?: readonly MaterialIconCategory[];
}

/**
 * Filters icons by category and search query. Without a query the original order is kept;
 * with one, the best matches come first: an exact name, then display names that start with the
 * query, then display-name matches, then exact aliases (earlier aliases first), then the rest.
 */
export function filterIcons(
  icons: readonly MaterialIcon[],
  { query = '', categories = [] }: MaterialIconFilter = {},
): MaterialIcon[] {
  const inCategory =
    categories.length === 0 ? icons : icons.filter((icon) => categories.includes(icon.category));
  const phrase = normalize(query);
  if (!phrase) {
    return [...inCategory];
  }
  const words = phrase.split(' ');
  return inCategory
    .map((icon, index) => ({ icon, index, rank: rank(icon, phrase, words) }))
    .filter((match) => match.rank !== null)
    .sort((a, b) => a.rank! - b.rank! || a.index - b.index)
    .map((match) => match.icon);
}

interface SearchText {
  readonly displayName: string;
  readonly displayWords: readonly string[];
  readonly aliases: readonly string[];
  readonly allWords: readonly string[];
}

const searchTextCache = new WeakMap<MaterialIcon, SearchText>();

function searchText(icon: MaterialIcon): SearchText {
  let text = searchTextCache.get(icon);
  if (!text) {
    const displayName = normalize(icon.displayName);
    const displayWords = displayName.split(' ');
    const aliases = icon.aliases.map(normalize);
    const allWords = [...displayWords, ...aliases.flatMap((alias) => alias.split(' '))];
    text = { displayName, displayWords, aliases, allWords };
    searchTextCache.set(icon, text);
  }
  return text;
}

/** Lower rank is a better match; `null` is no match. Ties keep the original order. */
function rank(icon: MaterialIcon, phrase: string, words: readonly string[]): number | null {
  const text = searchText(icon);
  if (text.displayName === phrase) return 0;
  if (text.displayName.startsWith(phrase)) return 1;
  if (words.every((word) => text.displayWords.some((w) => w.startsWith(word)))) return 2;
  // Aliases are ordered by relevance, so an earlier alias ranks higher.
  const alias = text.aliases.indexOf(phrase);
  if (alias >= 0) return 3 + alias / 100;
  if (words.every((word) => text.allWords.some((w) => w.startsWith(word)))) return 4;
  return null;
}

/** `Arrow_back ` → `arrow back`, so names, display names and queries compare alike. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();
}
