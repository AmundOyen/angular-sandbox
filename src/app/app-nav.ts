import { Routes } from '@angular/router';

import { NavGroupChild, NavItem, NavNode, normalize } from './dnd-navigator';

/** Builds one navigator item per route that has `data.navIcon`. The item id is the page's URL. */
export function navItemsFromRoutes(routes: Routes): NavItem[] {
  return routes.flatMap((route) => {
    const icon: unknown = route.data?.['navIcon'];
    if (typeof icon !== 'string' || route.path === undefined || route.path.includes(':')) {
      return [];
    }
    const label = typeof route.title === 'string' ? route.title : route.path;
    return [{ kind: 'item', id: `/${route.path}`, label, icon }];
  });
}

/** Id of the navigator item for a router URL: its first path segment, e.g. `/accordion?x=1` → `/accordion`. */
export function navIdForUrl(url: string): string {
  const path = url.split(/[?#;(]/, 1)[0];
  return `/${path.split('/').filter(Boolean)[0] ?? ''}`;
}

/**
 * Applies a saved navigator layout to the current pages: the order, groups and menus, and the
 * labels and icons the user gave to items, groups and menus. Saved items for pages that no longer
 * exist are dropped, new pages are appended at the end, and an item without a valid saved label or
 * icon takes it from its page. Returns `pages` if `saved` is not a valid tree.
 */
export function restoreNavLayout(saved: unknown, pages: readonly NavItem[]): NavNode[] {
  if (!Array.isArray(saved)) {
    return [...pages];
  }
  const byId = new Map(pages.map((page) => [page.id, page]));
  const used = new Set<string>();

  const item = (node: unknown): NavItem[] => {
    const page =
      isRecord(node) && typeof node['id'] === 'string' ? byId.get(node['id']) : undefined;
    if (!page || used.has(page.id)) {
      return [];
    }
    used.add(page.id);
    const saved = node as Record<string, unknown>;
    return [
      {
        ...page,
        label: text(saved['label']) ?? page.label,
        icon: text(saved['icon']) ?? page.icon,
      },
    ];
  };

  /** Id, label and optional icon of a saved group or menu, or `null` if they are invalid. */
  const container = (node: Record<string, unknown>) => {
    const id = text(node['id']);
    const label = text(node['label']);
    const icon = text(node['icon']);
    return id && label ? { id, label, ...(icon ? { icon } : {}) } : null;
  };

  const menu = (node: Record<string, unknown>): NavGroupChild[] => {
    const fields = container(node);
    if (!fields || !Array.isArray(node['children'])) {
      return [];
    }
    return [{ kind: 'menu', ...fields, children: node['children'].flatMap(item) }];
  };

  const tree = saved.flatMap<NavNode>((node) => {
    if (isRecord(node) && node['kind'] === 'group' && Array.isArray(node['children'])) {
      const fields = container(node);
      if (!fields) {
        return [];
      }
      const children = node['children'].flatMap<NavGroupChild>((child) =>
        isRecord(child) && child['kind'] === 'menu' ? menu(child) : item(child),
      );
      return [{ kind: 'group', ...fields, children }];
    }
    return item(node);
  });

  const added = pages.filter((page) => !used.has(page.id));
  return normalize([...tree, ...added]);
}

/** `value` if it is a non-blank string. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
