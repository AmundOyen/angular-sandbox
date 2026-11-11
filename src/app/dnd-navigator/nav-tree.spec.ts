import {
  ancestorIds,
  canDrop,
  GroupFactory,
  MenuFactory,
  moveNode,
  NavGroupChild,
  NavItem,
  NavNode,
  normalize,
  renameGroup,
} from './nav-tree';

const item = (id: string): NavItem => ({ kind: 'item', id, label: id, icon: 'circle' });

const group = (id: string, ...children: string[]): NavNode => ({
  kind: 'group',
  id,
  label: id,
  children: children.map(item),
});

const fixedGroup: GroupFactory = (children) => ({
  kind: 'group',
  id: 'new',
  label: 'Group',
  children,
});

const menu = (id: string, ...children: string[]): NavGroupChild => ({
  kind: 'menu',
  id,
  label: id,
  children: children.map(item),
});

/** A group whose children are given as ids (items) or ready-made nodes (menus). */
const deepGroup = (id: string, ...children: (string | NavGroupChild)[]): NavNode => ({
  kind: 'group',
  id,
  label: id,
  children: children.map((child) => (typeof child === 'string' ? item(child) : child)),
});

const fixedMenu: MenuFactory = (children) => ({ kind: 'menu', id: 'm', label: 'Menu', children });

/** Compact representation of a tree: `['a', 'g[b,m[c,d]]']`. */
const shape = (nodes: readonly NavNode[]): string[] =>
  nodes.map((node) =>
    node.kind === 'item' ? node.id : `${node.id}[${shape(node.children).join(',')}]`,
  );

describe('nav-tree', () => {
  describe('reordering at the root', () => {
    const tree = [item('a'), item('b'), item('c'), group('g', 'x', 'y')];

    it('moves an item before another item', () => {
      expect(shape(moveNode(tree, 'c', { kind: 'before', refId: 'a' }))).toEqual([
        'c',
        'a',
        'b',
        'g[x,y]',
      ]);
    });

    it('moves an item after another item', () => {
      expect(shape(moveNode(tree, 'a', { kind: 'after', refId: 'b' }))).toEqual([
        'b',
        'a',
        'c',
        'g[x,y]',
      ]);
    });

    it('moves an item to the end', () => {
      expect(shape(moveNode(tree, 'a', { kind: 'root-end' }))).toEqual(['b', 'c', 'g[x,y]', 'a']);
    });

    it('moves a whole group', () => {
      expect(shape(moveNode(tree, 'g', { kind: 'before', refId: 'a' }))).toEqual([
        'g[x,y]',
        'a',
        'b',
        'c',
      ]);
    });

    it('does not mutate the input', () => {
      const snapshot = JSON.stringify(tree);
      moveNode(tree, 'a', { kind: 'combine', refId: 'b' }, { groupFactory: fixedGroup });
      moveNode(tree, 'x', { kind: 'root-end' });
      expect(JSON.stringify(tree)).toBe(snapshot);
    });
  });

  describe('grouping', () => {
    it('combines two root items into a new group at the target position', () => {
      const tree = [item('a'), item('b'), item('c')];
      expect(
        shape(moveNode(tree, 'c', { kind: 'combine', refId: 'a' }, { groupFactory: fixedGroup })),
      ).toEqual(['new[a,c]', 'b']);
    });

    it('adds an item to an existing group', () => {
      const tree = [item('a'), group('g', 'x', 'y')];
      expect(shape(moveNode(tree, 'a', { kind: 'into', groupId: 'g' }))).toEqual(['g[x,y,a]']);
    });

    it('inserts an item at a specific position inside a group', () => {
      const tree = [item('a'), group('g', 'x', 'y')];
      expect(shape(moveNode(tree, 'a', { kind: 'before', refId: 'y' }))).toEqual(['g[x,a,y]']);
    });

    it('reorders items within a group', () => {
      const tree = [group('g', 'x', 'y', 'z')];
      expect(shape(moveNode(tree, 'z', { kind: 'before', refId: 'x' }))).toEqual(['g[z,x,y]']);
    });
  });

  describe('moving out of groups', () => {
    it('moves an item from a group to the root', () => {
      const tree = [item('a'), group('g', 'x', 'y', 'z')];
      expect(shape(moveNode(tree, 'y', { kind: 'before', refId: 'a' }))).toEqual([
        'y',
        'a',
        'g[x,z]',
      ]);
    });

    it('ungroups a group that is left with a single item', () => {
      const tree = [item('a'), group('g', 'x', 'y'), item('b')];
      expect(shape(moveNode(tree, 'x', { kind: 'root-end' }))).toEqual(['a', 'y', 'b', 'x']);
    });

    it('moves between groups and ungroups the source when needed', () => {
      const tree = [group('g1', 'a', 'b'), group('g2', 'x', 'y')];
      expect(shape(moveNode(tree, 'a', { kind: 'after', refId: 'x' }))).toEqual(['b', 'g2[x,a,y]']);
    });

    it('lets the last-but-one item combine with a root item', () => {
      const tree = [group('g', 'a', 'b'), item('c')];
      expect(
        shape(moveNode(tree, 'a', { kind: 'combine', refId: 'c' }, { groupFactory: fixedGroup })),
      ).toEqual(['b', 'new[c,a]']);
    });

    it('keeps a two-item group intact when an item is dropped back into it', () => {
      const tree = [group('g', 'a', 'b')];
      expect(shape(moveNode(tree, 'a', { kind: 'into', groupId: 'g' }))).toEqual(['g[b,a]']);
    });
  });

  describe('invalid drops', () => {
    const tree = [item('a'), group('g', 'x', 'y'), group('h', 'p', 'q')];

    it.each([
      ['a group into a group', 'g', { kind: 'into', groupId: 'h' }],
      ['a group next to a grouped item', 'g', { kind: 'before', refId: 'p' }],
      ['a group onto an item', 'g', { kind: 'combine', refId: 'a' }],
      ['an item onto a group', 'a', { kind: 'combine', refId: 'g' }],
      ['an item onto itself', 'a', { kind: 'combine', refId: 'a' }],
      ['an item next to itself', 'a', { kind: 'before', refId: 'a' }],
      ['an unknown item', 'nope', { kind: 'root-end' }],
    ] as const)('rejects %s', (_, dragId, target) => {
      expect(canDrop(tree, dragId, target)).toBe(false);
      expect(moveNode(tree, dragId, target)).toBe(tree);
    });
  });

  it('normalize unwraps single-item groups and removes empty ones', () => {
    const tree: NavNode[] = [group('g', 'a'), { kind: 'group', id: 'e', label: 'e', children: [] }];
    expect(shape(normalize(tree))).toEqual(['a']);
  });

  it('renames a group', () => {
    const tree = [item('a'), group('g', 'x', 'y')];
    const renamed = renameGroup(tree, 'g', 'Tools');
    expect(renamed[1].label).toBe('Tools');
    expect(tree[1].label).toBe('g');
  });

  describe('deep grouping (menus)', () => {
    const withMenu = { menuFactory: fixedMenu };

    it('creates a menu when an item is dropped on an item inside a group', () => {
      const tree = [item('a'), group('g', 'x', 'y')];
      expect(shape(moveNode(tree, 'a', { kind: 'combine', refId: 'y' }, withMenu))).toEqual([
        'g[x,m[y,a]]',
      ]);
    });

    it('uses the default menu factory', () => {
      const tree = [item('a'), group('g', 'x', 'y')];
      const [result] = moveNode(tree, 'a', { kind: 'combine', refId: 'y' });
      const created = result.kind === 'group' ? result.children[1] : undefined;
      expect(created?.kind).toBe('menu');
      expect(created?.id).toMatch(/^menu-/);
      expect(created?.label).toBe('Menu');
    });

    it('creates a menu from two items of the same group', () => {
      const tree = [group('g', 'x', 'y', 'z')];
      expect(shape(moveNode(tree, 'z', { kind: 'combine', refId: 'x' }, withMenu))).toEqual([
        'g[m[x,z],y]',
      ]);
    });

    it('keeps a group whose only child is a menu', () => {
      const tree = [group('g', 'x', 'y')];
      expect(shape(moveNode(tree, 'x', { kind: 'combine', refId: 'y' }, withMenu))).toEqual([
        'g[m[y,x]]',
      ]);
    });

    it('appends to a menu', () => {
      const tree = [item('a'), deepGroup('g', 'x', menu('m', 'p', 'q'))];
      expect(shape(moveNode(tree, 'a', { kind: 'into', groupId: 'm' }))).toEqual(['g[x,m[p,q,a]]']);
    });

    it('reorders inside a menu', () => {
      const tree = [deepGroup('g', 'x', menu('m', 'p', 'q', 'r'))];
      expect(shape(moveNode(tree, 'r', { kind: 'before', refId: 'p' }))).toEqual(['g[x,m[r,p,q]]']);
    });

    it('moves an item out of a menu and unwraps a menu left with one item', () => {
      const tree = [item('a'), deepGroup('g', 'x', menu('m', 'p', 'q'))];
      expect(shape(moveNode(tree, 'p', { kind: 'root-end' }))).toEqual(['a', 'g[x,q]', 'p']);
    });

    it('moves a whole menu between groups', () => {
      const tree = [deepGroup('g', 'x', 'y', menu('m', 'p', 'q')), group('h', 'u', 'v')];
      expect(shape(moveNode(tree, 'm', { kind: 'after', refId: 'u' }))).toEqual([
        'g[x,y]',
        'h[u,m[p,q],v]',
      ]);
    });

    it('lists the containers of a node', () => {
      const tree = [deepGroup('g', 'x', menu('m', 'p', 'q'))];
      expect(ancestorIds(tree, 'p')).toEqual(['m', 'g']);
      expect(ancestorIds(tree, 'g')).toEqual([]);
    });

    it('renames a menu', () => {
      const tree = [deepGroup('g', 'x', menu('m', 'p', 'q'))];
      const renamed = renameGroup(tree, 'm', 'Tools');
      expect(findMenuLabel(renamed)).toBe('Tools');
      expect(findMenuLabel(tree)).toBe('m');
    });

    it('normalize flattens menus at the root, which only invalid data can produce', () => {
      const tree = [menu('m', 'p', 'q')];
      expect(shape(normalize(tree))).toEqual(['p', 'q']);
    });

    describe('invalid drops', () => {
      const tree = [item('a'), deepGroup('g', 'x', menu('m', 'p', 'q')), group('h', 'u', 'v')];

      it.each([
        ['a menu at the root', 'm', { kind: 'before', refId: 'a' }],
        ['a menu at the root end', 'm', { kind: 'root-end' }],
        ['a menu into a menu', 'm', { kind: 'into', groupId: 'm' }],
        ['a menu next to a menu item', 'm', { kind: 'before', refId: 'p' }],
        ['a group into a menu', 'h', { kind: 'into', groupId: 'm' }],
        ['an item onto a menu item (no nested menus)', 'a', { kind: 'combine', refId: 'p' }],
        ['an item onto a menu trigger', 'a', { kind: 'combine', refId: 'm' }],
        ['a menu onto an item', 'm', { kind: 'combine', refId: 'u' }],
      ] as const)('rejects %s', (_, dragId, target) => {
        expect(canDrop(tree, dragId, target)).toBe(false);
      });
    });
  });
});

function findMenuLabel(nodes: readonly NavNode[]): string | undefined {
  const group = nodes[0];
  return group.kind === 'group' ? group.children.find((c) => c.kind === 'menu')?.label : undefined;
}
