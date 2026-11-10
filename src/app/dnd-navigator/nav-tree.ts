/** A single navigable entry, rendered as an icon above a label. */
export interface NavItem {
  readonly kind: 'item';
  readonly id: string;
  readonly label: string;
  /** Material icon ligature name, e.g. `home`. */
  readonly icon: string;
}

/**
 * A trigger inside a group that opens its items in a menu (experimental "deep grouping").
 * Menus only live inside groups and never nest.
 */
export interface NavMenu {
  readonly kind: 'menu';
  readonly id: string;
  readonly label: string;
  readonly children: readonly NavItem[];
}

/** A node that can sit inside a group. */
export type NavGroupChild = NavItem | NavMenu;

/** An expandable group of items and menus. Groups only live at the root and never nest. */
export interface NavGroup {
  readonly kind: 'group';
  readonly id: string;
  readonly label: string;
  readonly children: readonly NavGroupChild[];
}

export type NavNode = NavItem | NavGroup | NavMenu;

/** Where a dragged node should end up. */
export type DropTarget =
  /** Next to another node, at the root, inside a group or inside a menu. */
  | { readonly kind: 'before' | 'after'; readonly refId: string }
  /**
   * On top of an item: both items are merged into a new group (for a root item) or into a new
   * menu (for an item inside a group, when menus are allowed).
   */
  | { readonly kind: 'combine'; readonly refId: string }
  /** Appended to an existing group or menu. */
  | { readonly kind: 'into'; readonly groupId: string }
  /** Appended to the root list. */
  | { readonly kind: 'root-end' };

export interface NodeLocation {
  readonly node: NavNode;
  /** Id of the containing group or menu, or `null` when the node is at the root. */
  readonly parentId: string | null;
  readonly index: number;
}

export type GroupFactory = (items: readonly NavItem[]) => NavGroup;
export type MenuFactory = (items: readonly NavItem[]) => NavMenu;

export interface DropOptions {
  /** Whether dropping an item on an item inside a group creates a menu. Defaults to `false`. */
  readonly allowMenus?: boolean;
}

export interface MoveOptions extends DropOptions {
  readonly groupFactory?: GroupFactory;
  readonly menuFactory?: MenuFactory;
}

export const createGroup: GroupFactory = (children) => ({
  kind: 'group',
  id: `group-${crypto.randomUUID()}`,
  label: 'Group',
  children,
});

export const createMenu: MenuFactory = (children) => ({
  kind: 'menu',
  id: `menu-${crypto.randomUUID()}`,
  label: 'Menu',
  children,
});

export function findNode(nodes: readonly NavNode[], id: string): NodeLocation | null {
  return findIn(nodes, id, null);
}

function findIn(
  nodes: readonly NavNode[],
  id: string,
  parentId: string | null,
): NodeLocation | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.id === id) {
      return { node, parentId, index: i };
    }
    if (node.kind !== 'item') {
      const found = findIn(node.children, id, node.id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/** Ids of the groups and menus that contain `id`, innermost first. */
export function ancestorIds(nodes: readonly NavNode[], id: string): string[] {
  const ids: string[] = [];
  let parentId = findNode(nodes, id)?.parentId ?? null;
  while (parentId) {
    ids.push(parentId);
    parentId = findNode(nodes, parentId)?.parentId ?? null;
  }
  return ids;
}

/** Whether dropping `dragId` on `target` is allowed. */
export function canDrop(
  nodes: readonly NavNode[],
  dragId: string,
  target: DropTarget,
  options: DropOptions = {},
): boolean {
  const dragged = findNode(nodes, dragId);
  if (!dragged) {
    return false;
  }
  const kind = dragged.node.kind;
  /** Whether the dragged node may live directly inside a container of this kind. */
  const fits = (container: 'root' | 'group' | 'menu') =>
    container === 'root'
      ? kind !== 'menu'
      : container === 'group'
        ? kind !== 'group'
        : kind === 'item';
  const containerOf = (location: NodeLocation) =>
    location.parentId === null
      ? 'root'
      : (findNode(nodes, location.parentId)!.node.kind as 'group' | 'menu');

  switch (target.kind) {
    case 'root-end':
      return fits('root');
    case 'into': {
      const container = findNode(nodes, target.groupId)?.node;
      return (
        !!container &&
        container.kind !== 'item' &&
        target.groupId !== dragId &&
        fits(container.kind)
      );
    }
    case 'combine': {
      const ref = findNode(nodes, target.refId);
      if (kind !== 'item' || !ref || ref.node.kind !== 'item' || target.refId === dragId) {
        return false;
      }
      const container = containerOf(ref);
      return container === 'root' || (container === 'group' && !!options.allowMenus);
    }
    case 'before':
    case 'after': {
      const ref = findNode(nodes, target.refId);
      return !!ref && target.refId !== dragId && fits(containerOf(ref));
    }
  }
}

/**
 * Moves `dragId` to `target` and returns a new tree. The input is never mutated.
 * Groups and menus that end up with a single item are unwrapped, and empty ones are removed.
 * Returns the original array when the drop isn't allowed.
 */
export function moveNode(
  nodes: readonly NavNode[],
  dragId: string,
  target: DropTarget,
  options: MoveOptions = {},
): readonly NavNode[] {
  const dragged = findNode(nodes, dragId);
  if (!dragged || !canDrop(nodes, dragId, target, options)) {
    return nodes;
  }
  const without = removeNode(nodes, dragId);
  return normalize(
    insertNode(
      without,
      dragged.node,
      target,
      options.groupFactory ?? createGroup,
      options.menuFactory ?? createMenu,
    ),
  );
}

/** Returns a copy of `nodes` with the label of the group or menu `id` replaced. */
export function renameGroup(
  nodes: readonly NavNode[],
  id: string,
  label: string,
): readonly NavNode[] {
  return nodes.map((node) => renameIn(node, id, label));
}

function renameIn<T extends NavNode>(node: T, id: string, label: string): T {
  if (node.kind === 'item') {
    return node;
  }
  if (node.id === id) {
    return { ...node, label };
  }
  if (node.kind === 'group') {
    return { ...node, children: node.children.map((child) => renameIn(child, id, label)) };
  }
  return node;
}

/**
 * Cleans up the tree after a change:
 * - menus with a single item are replaced by that item, and empty menus are removed;
 * - groups with a single item are ungrouped, and empty groups are removed. A group whose only
 *   child is a menu is kept, since menus can't live at the root;
 * - menus at the root (which only invalid data can produce) are replaced by their items.
 */
export function normalize(nodes: readonly NavNode[]): NavNode[] {
  return nodes.flatMap<NavNode>((node) => {
    if (node.kind === 'item') {
      return [node];
    }
    if (node.kind === 'menu') {
      return [...node.children];
    }
    const children = node.children.flatMap<NavGroupChild>((child) =>
      child.kind === 'menu' && child.children.length < 2 ? [...child.children] : [child],
    );
    if (children.length > 1 || children[0]?.kind === 'menu') {
      return [{ ...node, children }];
    }
    return children;
  });
}

function removeNode(nodes: readonly NavNode[], id: string): NavNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => (node.kind === 'item' ? node : removeChild(node, id)));
}

function removeChild<T extends NavGroup | NavMenu>(node: T, id: string): T {
  const children = (node.children as readonly NavGroupChild[])
    .filter((child) => child.id !== id)
    .map((child) => (child.kind === 'menu' ? removeChild(child, id) : child));
  return { ...node, children };
}

/** Applies `update` to the children of the group or menu `id`, wherever it is in the tree. */
function updateChildren(
  nodes: NavNode[],
  id: string,
  update: (children: NavNode[]) => NavNode[],
): NavNode[] {
  return nodes.map((node) => {
    if (node.kind === 'item') {
      return node;
    }
    if (node.id === id) {
      return { ...node, children: update([...node.children]) } as NavNode;
    }
    return { ...node, children: updateChildren([...node.children], id, update) } as NavNode;
  });
}

function insertNode(
  nodes: NavNode[],
  dragged: NavNode,
  target: DropTarget,
  groupFactory: GroupFactory,
  menuFactory: MenuFactory,
): NavNode[] {
  if (target.kind === 'root-end') {
    return [...nodes, dragged];
  }

  if (target.kind === 'into') {
    return updateChildren(nodes, target.groupId, (children) => [...children, dragged]);
  }

  const ref = findNode(nodes, target.refId);
  if (!ref) {
    return [...nodes, dragged];
  }

  const replaceOrInsert = (list: NavNode[]): NavNode[] => {
    const result = [...list];
    if (target.kind === 'combine') {
      const pair = [ref.node as NavItem, dragged as NavItem];
      result[ref.index] = ref.parentId === null ? groupFactory(pair) : menuFactory(pair);
    } else {
      result.splice(ref.index + (target.kind === 'before' ? 0 : 1), 0, dragged);
    }
    return result;
  };

  return ref.parentId === null
    ? replaceOrInsert(nodes)
    : updateChildren(nodes, ref.parentId, replaceOrInsert);
}
