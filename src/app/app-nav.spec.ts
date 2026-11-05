import { Routes } from '@angular/router';

import { navIdForUrl, navItemsFromRoutes, restoreNavLayout } from './app-nav';
import { NavItem } from './dnd-navigator';

const page = (id: string, label = id, icon = 'star'): NavItem => ({
  kind: 'item',
  id,
  label,
  icon,
});

describe('navItemsFromRoutes', () => {
  it('creates an item per route with a nav icon, using the URL as id and the title as label', () => {
    const routes: Routes = [
      { path: '', title: 'Home', data: { navIcon: 'home' } },
      { path: 'about', title: 'About', data: { navIcon: 'info' } },
      { path: 'hidden', title: 'Hidden' },
      { path: 'user/:id', title: 'User', data: { navIcon: 'person' } },
      { path: '**', redirectTo: '' },
    ];
    expect(navItemsFromRoutes(routes)).toEqual([
      page('/', 'Home', 'home'),
      page('/about', 'About', 'info'),
    ]);
  });
});

describe('navIdForUrl', () => {
  it('maps a URL to the id of its top-level page', () => {
    expect(navIdForUrl('/')).toBe('/');
    expect(navIdForUrl('/accordion')).toBe('/accordion');
    expect(navIdForUrl('/accordion/details?tab=1#top')).toBe('/accordion');
    expect(navIdForUrl('/image-mask;x=1')).toBe('/image-mask');
  });
});

describe('restoreNavLayout', () => {
  const pages = [page('/', 'Home'), page('/a', 'A'), page('/b', 'B'), page('/c', 'C')];

  it('returns the pages when nothing valid is saved', () => {
    expect(restoreNavLayout(null, pages)).toEqual(pages);
    expect(restoreNavLayout({ not: 'a tree' }, pages)).toEqual(pages);
  });

  it('keeps the saved order and groups, and takes labels and icons from the pages', () => {
    const saved = [
      page('/c', 'Old label', 'old_icon'),
      { kind: 'group', id: 'g1', label: 'My group', children: [page('/b'), page('/')] },
      page('/a'),
    ];
    expect(restoreNavLayout(saved, pages)).toEqual([
      page('/c', 'C'),
      {
        kind: 'group',
        id: 'g1',
        label: 'My group',
        children: [page('/b', 'B'), page('/', 'Home')],
      },
      page('/a', 'A'),
    ]);
  });

  it('drops removed pages, appends new pages and ungroups groups left with one item', () => {
    const saved = [
      { kind: 'group', id: 'g1', label: 'G', children: [page('/gone'), page('/b')] },
      page('/a'),
      page('/a'),
      'junk',
    ];
    expect(restoreNavLayout(saved, pages)).toEqual([
      page('/b', 'B'),
      page('/a', 'A'),
      page('/', 'Home'),
      page('/c', 'C'),
    ]);
  });
});
