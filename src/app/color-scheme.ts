import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

export type ColorScheme = 'light' | 'dark';

export const COLOR_SCHEME_STORAGE_KEY = 'angular-sandbox.color-scheme';

/**
 * The app's light/dark mode. Follows the system setting until the user picks a scheme, which is
 * then remembered in localStorage. Applied as `color-scheme` on `<html>`, which switches the
 * Material 3 system tokens.
 */
@Injectable({ providedIn: 'root' })
export class ColorSchemeService {
  private readonly document = inject(DOCUMENT);
  private readonly systemDark = signal(false);
  private readonly chosen = signal<ColorScheme | null>(readChoice());

  readonly scheme = computed<ColorScheme>(
    () => this.chosen() ?? (this.systemDark() ? 'dark' : 'light'),
  );

  constructor() {
    const query = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    if (query) {
      this.systemDark.set(query.matches);
      query.addEventListener('change', (event) => this.systemDark.set(event.matches));
    }
    effect(() => {
      const chosen = this.chosen();
      // Without a choice, leave `color-scheme: light dark` from styles.scss to follow the system.
      this.document.documentElement.style.colorScheme = chosen ?? '';
    });
  }

  toggle(): void {
    const next: ColorScheme = this.scheme() === 'dark' ? 'light' : 'dark';
    this.chosen.set(next);
    writeChoice(next);
  }
}

function readChoice(): ColorScheme | null {
  try {
    const value = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function writeChoice(scheme: ColorScheme): void {
  try {
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme);
  } catch {
    // Storage can be unavailable (private mode, quota); the choice then lasts for this session.
  }
}
