import { Component, signal } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { DndNavigator } from './dnd-navigator';
import type { NavEditDialog } from './nav-edit-dialog';
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

  describe('editing', () => {
    afterEach(() => TestBed.inject(MatDialog).closeAll());

    /** The dialog is loaded lazily, so it opens a few ticks after the request. */
    const waitForDialog = async () => {
      const dialog = await vi.waitFor(() => {
        const element = document.querySelector<HTMLElement>('nav-edit-dialog');
        expect(element).not.toBeNull();
        return element!;
      });
      await fixture.whenStable();
      return dialog;
    };

    const openDialog = async () => {
      query('[data-drop="group-header"]').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F2' }),
      );
      return waitForDialog();
    };

    it('opens a dialog with F2 and saves the new label and icon', async () => {
      const dialog = await openDialog();
      expect(dialog.querySelector('h2')?.textContent).toContain('Edit group');
      const label = dialog.querySelector<HTMLInputElement>('input[formcontrolname="label"]')!;
      expect(label.value).toBe('Media');

      label.value = 'Library';
      label.dispatchEvent(new Event('input'));
      // The icon field is covered by its own tests; set its value through the form.
      expect(dialog.querySelector('material-icon-input')).not.toBeNull();
      const { form } = TestBed.inject(MatDialog).openDialogs[0].componentInstance as NavEditDialog;
      form.controls.icon.setValue('star');

      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      // afterClosed emits once the close animation has finished.
      await vi.waitFor(() =>
        expect(fixture.componentInstance.items()[1]).toEqual(
          expect.objectContaining({ label: 'Library', icon: 'star' }),
        ),
      );
      await fixture.whenStable();
      expect(query('[data-drop="group-header"] mat-icon').textContent?.trim()).toBe('star');
    });

    it('opens the dialog on double-click', async () => {
      query('[data-drop="group-header"]').dispatchEvent(new MouseEvent('dblclick'));
      expect(await waitForDialog()).not.toBeNull();
    });

    it('keeps the group unchanged when the dialog is cancelled', async () => {
      const dialog = await openDialog();
      const label = dialog.querySelector<HTMLInputElement>('input[formcontrolname="label"]')!;
      label.value = 'Nope';
      label.dispatchEvent(new Event('input'));
      dialog.querySelector<HTMLButtonElement>('button[mat-dialog-close]')!.click();
      await fixture.whenStable();

      expect(fixture.componentInstance.items()[1].label).toBe('Media');
    });

    it('does not save an empty label', async () => {
      const dialog = await openDialog();
      const label = dialog.querySelector<HTMLInputElement>('input[formcontrolname="label"]')!;
      label.value = '  ';
      label.dispatchEvent(new Event('input'));
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await fixture.whenStable();

      expect(document.querySelector('nav-edit-dialog')).not.toBeNull();
      expect(fixture.componentInstance.items()[1].label).toBe('Media');
    });

    const dialogForm = () =>
      (TestBed.inject(MatDialog).openDialogs[0].componentInstance as NavEditDialog).form;

    it('edits an item with F2', async () => {
      query('[data-id="home"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'F2' }));
      const dialog = await waitForDialog();
      expect(dialog.querySelector('h2')?.textContent).toContain('Edit item');
      expect(dialogForm().getRawValue()).toEqual({ label: 'Home', icon: 'home' });

      dialogForm().setValue({ label: 'Start', icon: 'rocket' });
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();

      await vi.waitFor(() =>
        expect(fixture.componentInstance.items()[0]).toEqual({
          kind: 'item',
          id: 'home',
          label: 'Start',
          icon: 'rocket',
        }),
      );
      await fixture.whenStable();
      expect(query('[data-id="home"] .tile-label').textContent?.trim()).toBe('Start');
      expect(query('[data-id="home"] .tile-icon').textContent?.trim()).toBe('rocket');
    });

    it('edits an item on double-click', async () => {
      query('[data-id="home"]').dispatchEvent(new MouseEvent('dblclick'));
      expect((await waitForDialog()).querySelector('h2')?.textContent).toContain('Edit item');
    });

    it('requires an icon for an item', async () => {
      query('[data-id="home"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'F2' }));
      const dialog = await waitForDialog();
      dialogForm().controls.icon.setValue(null);
      dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await fixture.whenStable();

      expect(dialog.textContent).toContain('Choose an icon');
      expect(fixture.componentInstance.items()[0]).toEqual(
        expect.objectContaining({ icon: 'home' }),
      );
    });
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
