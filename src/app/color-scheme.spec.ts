import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { COLOR_SCHEME_STORAGE_KEY, ColorSchemeService } from './color-scheme';

describe('ColorSchemeService', () => {
  let systemDark: boolean;
  let changeListener: ((event: { matches: boolean }) => void) | undefined;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.colorScheme = '';
    systemDark = false;
    changeListener = undefined;
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' && systemDark,
      addEventListener: (_: string, listener: typeof changeListener) => (changeListener = listener),
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  function create(): ColorSchemeService {
    const service = TestBed.inject(ColorSchemeService);
    TestBed.tick();
    return service;
  }

  const htmlScheme = () => TestBed.inject(DOCUMENT).documentElement.style.colorScheme;

  it('follows the system setting when nothing is chosen', () => {
    systemDark = true;
    const service = create();
    expect(service.scheme()).toBe('dark');
    expect(htmlScheme()).toBe('');

    changeListener?.({ matches: false });
    expect(service.scheme()).toBe('light');
  });

  it('toggles, applies and remembers the choice', () => {
    const service = create();
    service.toggle();
    TestBed.tick();

    expect(service.scheme()).toBe('dark');
    expect(htmlScheme()).toBe('dark');
    expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe('dark');

    service.toggle();
    TestBed.tick();
    expect(htmlScheme()).toBe('light');
  });

  it('restores a saved choice over the system setting', () => {
    systemDark = true;
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, 'light');
    const service = create();
    expect(service.scheme()).toBe('light');
    expect(htmlScheme()).toBe('light');
  });
});
