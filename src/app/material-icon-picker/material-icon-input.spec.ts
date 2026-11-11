import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';

import { MaterialIcon } from './material-icon';
import { MaterialIconInput } from './material-icon-input';
import { MaterialIconValue } from './material-icon-list';

const ICONS: MaterialIcon[] = [
  { name: 'home', displayName: 'Home', category: 'UI Actions', aliases: ['house'] },
  { name: 'delete', displayName: 'Delete', category: 'UI Actions', aliases: ['trash'] },
  { name: 'star', displayName: 'Star', category: 'UI Actions', aliases: ['favorite'] },
];

@Component({
  imports: [MatFormFieldModule, MaterialIconInput, ReactiveFormsModule],
  template: `
    <mat-form-field>
      <mat-label>Icon</mat-label>
      <material-icon-input [icons]="icons" [multiple]="multiple()" [formControl]="control" />
    </mat-form-field>
  `,
})
class Host {
  readonly icons = ICONS;
  readonly multiple = signal(false);
  readonly control = new FormControl<MaterialIconValue>(null, Validators.required);
}

describe('MaterialIconInput', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let element: HTMLElement;
  let overlay: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
    await fixture.whenStable();
  });

  const input = () => element.querySelector<HTMLInputElement>('material-icon-input input')!;
  const panel = () => overlay.querySelector<HTMLElement>('.material-icon-input-panel');
  const labels = () =>
    [...overlay.querySelectorAll('.tile .label')].map((l) => l.textContent?.trim());
  const key = (key: string) =>
    input().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

  async function type(text: string): Promise<void> {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('labels the input through the form field', () => {
    const label = element.querySelector('label');
    expect(label?.getAttribute('for')).toBe(input().id);
    expect(input().getAttribute('role')).toBe('combobox');
  });

  it('opens the grid when typing and searches it', async () => {
    expect(panel()).toBeNull();
    await type('trash');
    expect(panel()).not.toBeNull();
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(labels()).toEqual(['Delete']);
  });

  it('selects with the keyboard, closes and shows the icon in single mode', async () => {
    await type('fav');
    key('ArrowDown');
    key('Enter');
    await fixture.whenStable();
    expect(host.control.value).toBe('star');
    expect(panel()).toBeNull();
    expect(input().value).toBe('Star');
    expect(element.querySelector('.selected-icon')?.textContent).toBe('star');
  });

  it('acts on what was typed even before the grid re-renders', async () => {
    await type('h');
    input().value = 'trash';
    input().dispatchEvent(new Event('input'));
    key('ArrowDown');
    key('Enter');
    await fixture.whenStable();
    expect(host.control.value).toBe('delete');
  });

  it('keeps the grid open and shows chips with multiple', async () => {
    host.multiple.set(true);
    host.control.setValue([]);
    await fixture.whenStable();
    await type('house');
    key('ArrowDown');
    key('Enter');
    await type('trash');
    key('ArrowDown');
    key('Enter');
    await fixture.whenStable();
    expect(host.control.value).toEqual(['home', 'delete']);
    expect(panel()).not.toBeNull();
    const chips = [...element.querySelectorAll('mat-chip')].map((c) => c.textContent);
    expect(chips.length).toBe(2);
    expect(chips[0]).toContain('Home');
  });

  it('removes the last chip with Backspace in an empty field', async () => {
    host.multiple.set(true);
    host.control.setValue(['home', 'star']);
    await fixture.whenStable();
    key('Backspace');
    await fixture.whenStable();
    expect(host.control.value).toEqual(['home']);
  });

  it('closes with Escape without changing the value', async () => {
    host.control.setValue('home');
    await type('star');
    key('Escape');
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(host.control.value).toBe('home');
    expect(input().value).toBe('Home');
  });

  it('clears the value with the clear button', async () => {
    host.control.setValue('home');
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('button.clear')!.click();
    await fixture.whenStable();
    expect(host.control.value).toBeNull();
  });

  it('shows the error state once touched', async () => {
    input().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    input().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.control.touched).toBe(true);
    expect(element.querySelector('mat-form-field')?.classList).toContain('mat-form-field-invalid');
  });

  it('does not open when disabled', async () => {
    host.control.disable();
    await fixture.whenStable();
    expect(input().disabled).toBe(true);
    key('ArrowDown');
    await fixture.whenStable();
    expect(panel()).toBeNull();
  });
});
