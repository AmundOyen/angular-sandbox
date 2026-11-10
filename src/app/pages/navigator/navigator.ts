import { JsonPipe } from '@angular/common';
import { Component, computed, effect, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggle } from '@angular/material/slide-toggle';

import { DndNavigator, NavItem, NavNode } from '../../dnd-navigator';

export const NAV_ITEMS_STORAGE_KEY = 'angular-sandbox.navigator.items';
export const NAV_EXPANDED_STORAGE_KEY = 'angular-sandbox.navigator.expanded';
export const NAV_EXPERIMENTAL_STORAGE_KEY = 'angular-sandbox.navigator.experimental';

export const DEFAULT_NAV_ITEMS: readonly NavNode[] = [
  { kind: 'item', id: 'home', label: 'Home', icon: 'home' },
  { kind: 'item', id: 'inbox', label: 'Inbox', icon: 'inbox' },
  {
    kind: 'group',
    id: 'group-media',
    label: 'Media',
    children: [
      { kind: 'item', id: 'photos', label: 'Photos', icon: 'photo_library' },
      { kind: 'item', id: 'music', label: 'Music', icon: 'library_music' },
      { kind: 'item', id: 'videos', label: 'Videos', icon: 'movie' },
    ],
  },
  { kind: 'item', id: 'calendar', label: 'Calendar', icon: 'calendar_month' },
  { kind: 'item', id: 'contacts', label: 'Contacts', icon: 'contacts' },
  { kind: 'item', id: 'files', label: 'Files', icon: 'folder_copy' },
  { kind: 'item', id: 'analytics', label: 'Analytics', icon: 'insights' },
  { kind: 'item', id: 'settings', label: 'Settings', icon: 'settings' },
];

@Component({
  imports: [DndNavigator, JsonPipe, MatButtonModule, MatIconModule, MatSlideToggle],
  selector: 'app-navigator',
  styleUrl: './navigator.scss',
  templateUrl: './navigator.html',
})
export class Navigator {
  protected readonly items = signal(loadItems());
  protected readonly navExpanded = signal(readStorage(NAV_EXPANDED_STORAGE_KEY) === 'true');
  protected readonly experimental = signal(readStorage(NAV_EXPERIMENTAL_STORAGE_KEY) === 'true');
  protected readonly active = signal<NavItem | null>(null);
  protected readonly activeId = computed(() => this.active()?.id ?? null);

  constructor() {
    effect(() => writeStorage(NAV_ITEMS_STORAGE_KEY, JSON.stringify(this.items())));
    effect(() => writeStorage(NAV_EXPANDED_STORAGE_KEY, String(this.navExpanded())));
    effect(() => writeStorage(NAV_EXPERIMENTAL_STORAGE_KEY, String(this.experimental())));
  }

  protected reset(): void {
    this.items.set(DEFAULT_NAV_ITEMS);
  }
}

function loadItems(): readonly NavNode[] {
  try {
    const stored = readStorage(NAV_ITEMS_STORAGE_KEY);
    const value: unknown = stored ? JSON.parse(stored) : null;
    return Array.isArray(value) ? (value as NavNode[]) : DEFAULT_NAV_ITEMS;
  } catch {
    return DEFAULT_NAV_ITEMS;
  }
}

// Storage can be unavailable (private mode, quota); the tree then lasts for this session only.
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore: see readStorage.
  }
}
