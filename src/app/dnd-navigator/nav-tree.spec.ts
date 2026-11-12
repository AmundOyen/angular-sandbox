import {
  ancestorIds,
  canDrop,
  GroupFactory,
  keyboardTarget,
  MenuFactory,
  MoveDirection,
  moveNode,
  NavGroup,
  NavGroupChild,
  NavItem,
  NavMenu,
  NavNode,
  normalize,
  editGroup,
  editNode,
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

  it('edits the label and icon of a group, and removes the icon again', () => {
    const tree: NavNode[] = [item('a'), group('g', 'b', 'c')];
    const edited = editGroup(tree, 'g', { label: 'Tools', icon: 'build' });
    expect(edited[1]).toEqual(expect.objectContaining({ label: 'Tools', icon: 'build' }));
    const cleared = editGroup(edited, 'g', { icon: null });
    expect(cleared[1].label).toBe('Tools');
    expect('icon' in cleared[1]).toBe(false);
  });

  it('edits an item at the root, in a group and in a menu, keeping its icon for null', () => {
    const tree: NavNode[] = [item('a'), deepGroup('g', 'b', menu('m', 'c', 'd'))];
    const atRoot = editNode(tree, 'a', { label: 'A', icon: null });
    expect(atRoot[0]).toEqual({ kind: 'item', id: 'a', label: 'A', icon: 'circle' });

    const inGroup = editNode(tree, 'b', { icon: 'star' }) as [NavNode, NavGroup];
    expect(inGroup[1].children[0]).toEqual(expect.objectContaining({ id: 'b', icon: 'star' }));

    const inMenu = editNode(tree, 'd', { label: 'D' }) as [NavNode, NavGroup];
    const m = inMenu[1].children[1] as NavMenu;
    expect(m.children[1]).toEqual(expect.objectContaining({ id: 'd', label: 'D' }));
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

  describe('keyboard moves', () => {
    const tree = [
      item('a'),
      deepGroup('g', 'x', menu('m', 'p', 'q'), 'y'),
      item('b'),
      group('h', 'u', 'v'),
    ];
    const move = (id: string, direction: MoveDirection) => {
      const target = keyboardTarget(tree, id, direction);
      return target ? shape(moveNode(tree, id, target, { groupFactory: fixedGroup })) : null;
    };

    it('moves past the previous and next sibling', () => {
      expect(move('b', 'up')).toEqual(['a', 'b', 'g[x,m[p,q],y]', 'h[u,v]']);
      expect(move('a', 'down')).toEqual(['g[x,m[p,q],y]', 'a', 'b', 'h[u,v]']);
      expect(move('q', 'up')).toEqual(['a', 'g[x,m[q,p],y]', 'b', 'h[u,v]']);
      expect(move('x', 'down')).toEqual(['a', 'g[m[p,q],x,y]', 'b', 'h[u,v]']);
    });

    it('moves out of a group or menu at either end', () => {
      expect(move('x', 'up')).toEqual(['a', 'x', 'g[m[p,q],y]', 'b', 'h[u,v]']);
      expect(move('y', 'down')).toEqual(['a', 'g[x,m[p,q]]', 'y', 'b', 'h[u,v]']);
      // The menu is left with one item and unwraps.
      expect(move('p', 'up')).toEqual(['a', 'g[x,p,q,y]', 'b', 'h[u,v]']);
    });

    it('moves into the group or menu above', () => {
      expect(move('b', 'in')).toEqual(['a', 'g[x,m[p,q],y,b]', 'h[u,v]']);
      expect(move('y', 'in')).toEqual(['a', 'g[x,m[p,q,y]]', 'b', 'h[u,v]']);
    });

    it('combines with the item above into a group or menu', () => {
      expect(keyboardTarget([item('a'), item('b')], 'b', 'in')).toEqual({
        kind: 'combine',
        refId: 'a',
      });
      expect(keyboardTarget(tree, 'v', 'in')).toEqual({ kind: 'combine', refId: 'u' });
    });

    it('moves out of the containing group or menu', () => {
      expect(move('u', 'out')).toEqual(['a', 'g[x,m[p,q],y]', 'b', 'v', 'u']);
      expect(move('q', 'out')).toEqual(['a', 'g[x,p,q,y]', 'b', 'h[u,v]']);
    });

    it.each([
      ['the first root node up', 'a', 'up'],
      ['the last root node down', 'h', 'down'],
      ['a root node out', 'b', 'out'],
      ['the first root node in', 'a', 'in'],
      ['a group into a group', 'h', 'in'],
      ['an item in a menu in (menus never nest)', 'q', 'in'],
      ['a menu out to the root', 'm', 'out'],
      ['an unknown node', 'nope', 'up'],
    ] as const)('rejects moving %s', (_, id, direction) => {
      expect(keyboardTarget(tree, id, direction)).toBeNull();
    });

    it('rejects moving a menu out of either end of its group', () => {
      const menuFirst = [deepGroup('g', menu('m', 'p', 'q'), 'x')];
      const menuLast = [deepGroup('g', 'x', menu('m', 'p', 'q'))];
      expect(keyboardTarget(menuFirst, 'm', 'up')).toBeNull();
      expect(keyboardTarget(menuLast, 'm', 'down')).toBeNull();
    });
  });
});

function findMenuLabel(nodes: readonly NavNode[]): string | undefined {
  const group = nodes[0];
  return group.kind === 'group' ? group.children.find((c) => c.kind === 'menu')?.label : undefined;
}
