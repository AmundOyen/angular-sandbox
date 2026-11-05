import { Routes } from '@angular/router';

import { NavItem, NavNode, normalize } from './dnd-navigator';

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
 * Applies a saved navigator layout (order, groups, group names) to the current pages.
 * Labels and icons always come from `pages`; saved items for pages that no longer exist are
 * dropped, and new pages are appended at the end. Returns `pages` if `saved` is not a valid tree.
 */
export function restoreNavLayout(saved: unknown, pages: readonly NavItem[]): NavNode[] {
  if (!Array.isArray(saved)) {
    return [...pages];
  }
  const byId = new Map(pages.map((page) => [page.id, page]));
  const used = new Set<string>();
  const take = (node: unknown): NavItem[] => {
    const id = isRecord(node) ? node['id'] : undefined;
    const page = typeof id === 'string' ? byId.get(id) : undefined;
    if (!page || used.has(page.id)) {
      return [];
    }
    used.add(page.id);
    return [page];
  };

  const tree = saved.flatMap<NavNode>((node) => {
    if (isRecord(node) && node['kind'] === 'group' && Array.isArray(node['children'])) {
      const { id, label } = node;
      if (typeof id !== 'string' || typeof label !== 'string') {
        return [];
      }
      return [{ kind: 'group', id, label, children: node['children'].flatMap(take) }];
    }
    return take(node);
  });

  const added = pages.filter((page) => !used.has(page.id));
  return normalize([...tree, ...added]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
