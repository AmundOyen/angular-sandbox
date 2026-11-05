import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';

import { App, APP_NAV_ITEMS_STORAGE_KEY } from './app';

@Component({ template: '' })
class Blank {}

const routes: Routes = [
  { path: '', component: Blank, title: 'Home', data: { navIcon: 'home' } },
  { path: 'accordion', component: Blank, title: 'Accordion', data: { navIcon: 'view_agenda' } },
  { path: 'navigator', component: Blank, title: 'Navigator', data: { navIcon: 'drag_indicator' } },
];

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const tile = (label: string) =>
      [...element.querySelectorAll<HTMLElement>('dnd-navigator .tile')].find(
        (el) => el.querySelector('.tile-label')?.textContent?.trim() === label,
      )!;
    return { fixture, element, tile };
  }

  it('renders the toolbar with the title', async () => {
    const { element } = await render();
    expect(element.querySelector('mat-toolbar')?.textContent).toContain('angular-sandbox');
  });

  it('shows a navigator item for each page', async () => {
    const { element } = await render();
    const labels = [...element.querySelectorAll('dnd-navigator .tile-label')].map((el) =>
      el.textContent?.trim(),
    );
    expect(labels).toEqual(['Home', 'Accordion', 'Navigator']);
  });

  it('navigates when an item is clicked and highlights the current page', async () => {
    const { fixture, tile } = await render();
    tile('Accordion').click();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/accordion');
    expect(tile('Accordion').classList).toContain('active');
    expect(tile('Home').classList).not.toContain('active');
  });

  it('restores a saved layout', async () => {
    localStorage.setItem(
      APP_NAV_ITEMS_STORAGE_KEY,
      JSON.stringify([{ kind: 'item', id: '/navigator', label: 'Navigator', icon: 'x' }]),
    );
    const { element } = await render();
    const labels = [...element.querySelectorAll('dnd-navigator .tile-label')].map((el) =>
      el.textContent?.trim(),
    );
    expect(labels).toEqual(['Navigator', 'Home', 'Accordion']);
  });
});
