import { Component, signal } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DndNavigator } from './dnd-navigator';
import { NavItem, NavNode } from './nav-tree';

@Component({
  imports: [DndNavigator],
  template: `<dnd-navigator
    [(items)]="items"
    [(expanded)]="expanded"
    (itemSelect)="selected.set($event)"
  />`,
})
class Host {
  readonly items = signal<readonly NavNode[]>([
    { kind: 'item', id: 'home', label: 'Home', icon: 'home' },
    {
      kind: 'group',
      id: 'media',
      label: 'Media',
      children: [
        { kind: 'item', id: 'photos', label: 'Photos', icon: 'photo' },
        { kind: 'item', id: 'music', label: 'Music', icon: 'music_note' },
      ],
    },
  ]);
  readonly selected = signal<NavItem | null>(null);
  readonly expanded = signal(false);
}

describe('DndNavigator', () => {
  let fixture: ComponentFixture<Host>;
  let element: HTMLElement;

  const query = (selector: string) => element.querySelector<HTMLElement>(selector)!;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('renders each item with its icon above the label', () => {
    const tile = query('[data-id="home"]');
    expect(tile.children[0].textContent?.trim()).toBe('home');
    expect(tile.children[1].textContent?.trim()).toBe('Home');
  });

  it('expands to a drawer and minimizes back with the toggle button', async () => {
    const navigator = query('dnd-navigator');
    const toggle = () => query('.nav-toggle');
    expect(navigator.classList).not.toContain('drawer');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');

    toggle().click();
    await fixture.whenStable();
    expect(fixture.componentInstance.expanded()).toBe(true);
    expect(navigator.classList).toContain('drawer');
    expect(toggle().getAttribute('aria-label')).toBe('Minimize navigation');

    toggle().click();
    await fixture.whenStable();
    expect(fixture.componentInstance.expanded()).toBe(false);
    expect(navigator.classList).not.toContain('drawer');
  });

  it('follows the expanded state set by the host', async () => {
    fixture.componentInstance.expanded.set(true);
    await fixture.whenStable();
    expect(query('dnd-navigator').classList).toContain('drawer');
    expect(query('.nav-toggle').getAttribute('aria-expanded')).toBe('true');
  });

  it('emits itemSelect on click', () => {
    query('[data-id="home"]').click();
    expect(fixture.componentInstance.selected()?.id).toBe('home');
  });

  it('toggles a group on click', async () => {
    const header = query('[data-drop="group-header"]');
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('[data-id="photos"]')).toBeNull();

    header.click();
    await fixture.whenStable();

    expect(query('[data-drop="group-header"]').getAttribute('aria-expanded')).toBe('true');
    expect(query('[data-id="photos"]').dataset['parent']).toBe('media');
  });

  it('renames a group with F2 and emits the new tree', async () => {
    query('[data-drop="group-header"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'F2' }));
    await fixture.whenStable();

    const input = query('.rename-input') as HTMLInputElement;
    input.value = 'Library';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();

    expect(fixture.componentInstance.items()[1].label).toBe('Library');
    expect(element.querySelector('.rename-input')).toBeNull();
  });

  it('keeps the original name when renaming is cancelled', async () => {
    query('[data-drop="group-header"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'F2' }));
    await fixture.whenStable();

    const input = query('.rename-input') as HTMLInputElement;
    input.value = 'Nope';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(fixture.componentInstance.items()[1].label).toBe('Media');
  });

  describe('deep grouping', () => {
    beforeEach(async () => {
      fixture.componentInstance.items.set([
        {
          kind: 'group',
          id: 'media',
          label: 'Media',
          children: [
            { kind: 'item', id: 'photos', label: 'Photos', icon: 'photo' },
            {
              kind: 'menu',
              id: 'audio',
              label: 'Audio',
              children: [
                { kind: 'item', id: 'music', label: 'Music', icon: 'music_note' },
                { kind: 'item', id: 'podcasts', label: 'Podcasts', icon: 'podcasts' },
              ],
            },
          ],
        },
      ]);
      await fixture.whenStable();
      query('[data-drop="group-header"]').click();
      await fixture.whenStable();
    });

    it('shows a menu trigger that opens the items in a menu', async () => {
      const trigger = query('[data-drop="menu-trigger"]');
      expect(trigger.textContent).toContain('Audio');
      expect(element.querySelector('[data-id="music"]')).toBeNull();

      trigger.click();
      await fixture.whenStable();
      const entry = document.querySelector<HTMLElement>(
        '[data-drop="menu-item"][data-id="music"]',
      )!;
      expect(entry).toBeTruthy();

      entry.click();
      expect(fixture.componentInstance.selected()?.id).toBe('music');
    });

    it('keeps the rail usable while a menu is open and closes it on an outside click', async () => {
      const trigger = query('[data-drop="menu-trigger"]');

      trigger.click();
      await fixture.whenStable();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(document.querySelector('.cdk-overlay-backdrop')).toBeNull();

      query('[data-id="photos"]').click();
      await fixture.whenStable();
      expect(fixture.componentInstance.selected()?.id).toBe('photos');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('toggles the menu with its trigger', async () => {
      const trigger = query('[data-drop="menu-trigger"]');

      trigger.click();
      await fixture.whenStable();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      trigger.click();
      await fixture.whenStable();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('keyboard moves', () => {
    const altKey = (target: HTMLElement, key: string) => {
      const event = new KeyboardEvent('keydown', {
        key,
        altKey: true,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      return event;
    };
    // LiveAnnouncer writes to its live region after a delay, so check what it was asked to say.
    let announce: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce');
    });
    const announced = () => announce.mock.lastCall?.[0];
    const ids = () =>
      fixture.componentInstance
        .items()
        .map((node) =>
          node.kind === 'item' ? node.id : `${node.id}[${node.children.map((c) => c.id)}]`,
        );

    it('advertises the shortcuts on movable tiles', () => {
      expect(query('[data-id="home"]').getAttribute('aria-keyshortcuts')).toContain('Alt+ArrowUp');
      expect(query('[data-drop="group-header"]').getAttribute('aria-keyshortcuts')).toContain(
        'Alt+ArrowRight',
      );
    });

    it('moves the focused item with Alt+ArrowDown and keeps focus on it', async () => {
      const home = query('[data-id="home"]');
      home.focus();
      const event = altKey(home, 'ArrowDown');
      await fixture.whenStable();

      expect(event.defaultPrevented).toBe(true);
      expect(ids()).toEqual(['media[photos,music]', 'home']);
      expect(document.activeElement).toBe(query('[data-id="home"]'));
    });

    it('moves an item into the group above with Alt+ArrowRight and opens the group', async () => {
      fixture.componentInstance.items.update((items) => [items[1], items[0]]);
      await fixture.whenStable();

      altKey(query('[data-id="home"]'), 'ArrowRight');
      await fixture.whenStable();

      expect(ids()).toEqual(['media[photos,music,home]']);
      expect(query('[data-drop="group-header"]').getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(query('[data-id="home"]'));
    });

    it('moves an item out of its group with Alt+ArrowLeft', async () => {
      query('[data-drop="group-header"]').click();
      await fixture.whenStable();

      altKey(query('[data-id="photos"]'), 'ArrowLeft');
      await fixture.whenStable();

      expect(ids()).toEqual(['home', 'music', 'photos']);
      // The group was dissolved by the move, but is still named in the announcement.
      expect(announced()).toBe('Photos moved out of Media');
    });

    it('leaves the tree alone when the node cannot move that way', async () => {
      const event = altKey(query('[data-id="home"]'), 'ArrowUp');
      await fixture.whenStable();

      expect(event.defaultPrevented).toBe(true);
      expect(ids()).toEqual(['home', 'media[photos,music]']);
      expect(announced()).toBe("Home can't move up");
    });

    it('ignores arrow keys without Alt', async () => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      });
      query('[data-id="home"]').dispatchEvent(event);
      await fixture.whenStable();

      expect(event.defaultPrevented).toBe(false);
      expect(ids()).toEqual(['home', 'media[photos,music]']);
    });
  });
});
