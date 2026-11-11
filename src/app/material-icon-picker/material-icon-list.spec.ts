import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MaterialIcon } from './material-icon';
import { MaterialIconList, MaterialIconValue } from './material-icon-list';

const ICONS: MaterialIcon[] = [
  { name: 'home', displayName: 'Home', category: 'UI Actions', aliases: ['house'] },
  { name: 'delete', displayName: 'Delete', category: 'UI Actions', aliases: ['trash'] },
  { name: 'map', displayName: 'Map', category: 'Maps', aliases: ['location'] },
  { name: 'star', displayName: 'Star', category: 'UI Actions', aliases: ['favorite'] },
];

@Component({
  imports: [MaterialIconList, ReactiveFormsModule],
  template: `
    <material-icon-list
      [icons]="icons"
      [multiple]="multiple()"
      [formControl]="control"
      (iconSelect)="picked.push($event.name)"
    />
  `,
})
class Host {
  readonly icons = ICONS;
  readonly multiple = signal(false);
  readonly control = new FormControl<MaterialIconValue>(null);
  readonly picked: string[] = [];
}

describe('MaterialIconList', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let element: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  const tiles = () => [...element.querySelectorAll<HTMLElement>('.tile')];
  const labels = () => tiles().map((t) => t.querySelector('.label')?.textContent?.trim());
  const tile = (name: string) => element.querySelector<HTMLElement>(`[id$="-${name}"]`)!;
  const grid = () => element.querySelector<HTMLElement>('cdk-virtual-scroll-viewport')!;
  const search = () => element.querySelector<HTMLInputElement>('input[type="search"]')!;
  const key = (target: HTMLElement, key: string) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

  async function type(text: string): Promise<void> {
    search().value = text;
    search().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('shows the icons with their display names', () => {
    expect(labels()).toEqual(['Home', 'Delete', 'Map', 'Star']);
    expect(tile('home').querySelector('mat-icon')?.textContent).toBe('home');
    expect(element.querySelector('.count')?.textContent).toContain('4 icons');
  });

  it('searches display names and aliases', async () => {
    await type('trash');
    expect(labels()).toEqual(['Delete']);
    await type('nothing like this');
    expect(element.querySelector('.empty')?.textContent).toContain('No icons match');
  });

  it('filters by the selected categories', async () => {
    const maps = [...element.querySelectorAll<HTMLElement>('mat-chip-option')].find(
      (chip) => chip.textContent?.trim() === 'Maps',
    )!;
    maps.querySelector<HTMLElement>('button')!.click();
    await fixture.whenStable();
    expect(labels()).toEqual(['Map']);
  });

  it('selects one icon at a time and updates the form control', async () => {
    tile('home').click();
    tile('delete').click();
    await fixture.whenStable();
    expect(host.control.value).toBe('delete');
    expect(host.picked).toEqual(['home', 'delete']);
    expect(tile('delete').getAttribute('aria-selected')).toBe('true');
    expect(tile('home').getAttribute('aria-selected')).toBe('false');
  });

  it('toggles several icons with multiple', async () => {
    host.multiple.set(true);
    await fixture.whenStable();
    tile('home').click();
    tile('star').click();
    tile('home').click();
    await fixture.whenStable();
    expect(host.control.value).toEqual(['star']);
    expect(grid().getAttribute('aria-multiselectable')).toBe('true');
  });

  it('shows the value written by the form control', async () => {
    host.control.setValue('map');
    await fixture.whenStable();
    expect(tile('map').classList).toContain('selected');
  });

  it('moves with the arrow keys and selects with Enter in the grid', async () => {
    grid().dispatchEvent(new FocusEvent('focus'));
    key(grid(), 'ArrowRight');
    key(grid(), 'ArrowRight');
    key(grid(), 'ArrowLeft');
    await fixture.whenStable();
    expect(grid().getAttribute('aria-activedescendant')).toMatch(/-delete$/);
    key(grid(), 'Enter');
    await fixture.whenStable();
    expect(host.control.value).toBe('delete');
  });

  it('navigates from the search field without taking Space', async () => {
    await type('trash');
    expect(labels()).toEqual(['Delete']);
    expect(key(search(), ' ')).toBe(true); // not prevented: types a space
    expect(key(search(), 'ArrowRight')).toBe(true); // moves the text cursor until an icon is active
    key(search(), 'ArrowDown');
    key(search(), 'Enter');
    await fixture.whenStable();
    expect(host.control.value).toBe('delete');
  });

  it('ignores clicks when the control is disabled', async () => {
    host.control.disable();
    await fixture.whenStable();
    tile('home').click();
    expect(host.control.value).toBeNull();
    expect(grid().getAttribute('aria-disabled')).toBe('true');
  });
});
