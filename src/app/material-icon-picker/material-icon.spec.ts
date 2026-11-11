import { filterIcons, MATERIAL_ICON_CATEGORIES, MaterialIcon } from './material-icon';
import { MATERIAL_ICONS } from './material-icons.data';

const icon = (
  name: string,
  aliases: string[] = [],
  category: MaterialIcon['category'] = 'Actions',
): MaterialIcon => ({
  name,
  displayName: name
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' '),
  category,
  aliases,
});

describe('MATERIAL_ICONS', () => {
  it('has unique names', () => {
    const names = MATERIAL_ICONS.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeGreaterThan(3500);
  });

  it('gives every icon a display name, a known category and at least one alias', () => {
    for (const i of MATERIAL_ICONS) {
      expect(i.displayName.trim()).not.toBe('');
      expect(MATERIAL_ICON_CATEGORIES).toContain(i.category);
      expect(i.aliases.length, i.name).toBeGreaterThan(0);
    }
  });

  it('uses lower-case aliases that are not the name itself', () => {
    for (const i of MATERIAL_ICONS) {
      for (const alias of i.aliases) {
        expect(alias).toBe(alias.toLowerCase());
        expect(alias).not.toBe(i.name.replaceAll('_', ' '));
      }
    }
  });

  it('includes common icons with sensible metadata', () => {
    const del = MATERIAL_ICONS.find((i) => i.name === 'delete');
    expect(del).toMatchObject({ displayName: 'Delete', category: 'UI Actions' });
    expect(del?.aliases).toContain('trash');
    expect(MATERIAL_ICONS.find((i) => i.name === 'usb')?.displayName).toBe('USB');
    expect(MATERIAL_ICONS.some((i) => i.name === 'expand_more')).toBe(true);
  });
});

describe('filterIcons', () => {
  const icons = [
    icon('home', ['house', 'main'], 'UI Actions'),
    icon('add_home', ['house', 'new'], 'Maps'),
    icon('delete', ['trash', 'bin'], 'UI Actions'),
    icon('auto_delete', ['automatic', 'trash'], 'Actions'),
    icon('restore_from_trash', ['undo'], 'Actions'),
    icon('arrow_back', ['previous'], 'UI Actions'),
  ];
  const names = (result: MaterialIcon[]) => result.map((i) => i.name);

  it('returns all icons in order without a filter', () => {
    expect(names(filterIcons(icons))).toEqual(names(icons));
  });

  it('keeps icons in any of the selected categories', () => {
    expect(names(filterIcons(icons, { categories: ['Maps', 'Actions'] }))).toEqual([
      'add_home',
      'auto_delete',
      'restore_from_trash',
    ]);
  });

  it('matches the start of words in display names and aliases', () => {
    expect(names(filterIcons(icons, { query: 'hou' }))).toEqual(['home', 'add_home']);
    expect(names(filterIcons(icons, { query: 'prev' }))).toEqual(['arrow_back']);
    expect(names(filterIcons(icons, { query: 'ome' }))).toEqual([]);
  });

  it('requires every word to match and ignores case, underscores and extra spaces', () => {
    expect(names(filterIcons(icons, { query: '  Arrow_BACK ' }))).toEqual(['arrow_back']);
    expect(names(filterIcons(icons, { query: 'arrow house' }))).toEqual([]);
  });

  it('ranks exact names, then name prefixes, then names, then exact aliases', () => {
    expect(names(filterIcons(icons, { query: 'delete' }))).toEqual(['delete', 'auto_delete']);
    expect(names(filterIcons(icons, { query: 'home' }))).toEqual(['home', 'add_home']);
    // `restore_from_trash` has "trash" in its name; `delete` has it as its first alias.
    expect(names(filterIcons(icons, { query: 'trash' }))).toEqual([
      'restore_from_trash',
      'delete',
      'auto_delete',
    ]);
  });

  it('combines a query with categories', () => {
    expect(names(filterIcons(icons, { query: 'trash', categories: ['UI Actions'] }))).toEqual([
      'delete',
    ]);
  });
});
