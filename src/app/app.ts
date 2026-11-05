import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { ColorSchemeService } from './color-scheme';
import { navIdForUrl, navItemsFromRoutes, restoreNavLayout } from './app-nav';
import { DndNavigator, NavItem } from './dnd-navigator';

export const APP_NAV_ITEMS_STORAGE_KEY = 'angular-sandbox.app-nav.items';
export const APP_NAV_EXPANDED_STORAGE_KEY = 'angular-sandbox.app-nav.expanded';

@Component({
  imports: [
    RouterOutlet,
    DndNavigator,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  protected readonly colorScheme = inject(ColorSchemeService);

  protected readonly title = signal('angular-sandbox');
  protected readonly navItems = signal(
    restoreNavLayout(readJson(APP_NAV_ITEMS_STORAGE_KEY), navItemsFromRoutes(this.router.config)),
  );
  protected readonly navExpanded = signal(readStorage(APP_NAV_EXPANDED_STORAGE_KEY) === 'true');

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly activeId = computed(() => navIdForUrl(this.url()));

  constructor() {
    effect(() => writeStorage(APP_NAV_ITEMS_STORAGE_KEY, JSON.stringify(this.navItems())));
    effect(() => writeStorage(APP_NAV_EXPANDED_STORAGE_KEY, String(this.navExpanded())));
  }

  protected navigate(item: NavItem): void {
    void this.router.navigateByUrl(item.id);
  }
}

// Storage can be unavailable (private mode, quota); the layout then lasts for this session only.
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  try {
    return JSON.parse(readStorage(key) ?? 'null');
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
