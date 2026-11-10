import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NAV_EXPERIMENTAL_STORAGE_KEY, NAV_ITEMS_STORAGE_KEY, Navigator } from './navigator';

describe('Navigator', () => {
  let fixture: ComponentFixture<Navigator>;

  async function render(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Navigator],
    }).compileComponents();

    fixture = TestBed.createComponent(Navigator);
    await fixture.whenStable();
  }

  function labels(): (string | undefined)[] {
    const element = fixture.nativeElement as HTMLElement;
    return [...element.querySelectorAll('dnd-navigator .tile-label')].map((el) =>
      el.textContent?.trim(),
    );
  }

  beforeEach(() => localStorage.clear());

  it('renders the navigator with the default items', async () => {
    await render();
    expect(labels()).toContain('Home');
    expect(labels()).toContain('Media');
  });

  it('restores the tree from local storage', async () => {
    localStorage.setItem(
      NAV_ITEMS_STORAGE_KEY,
      JSON.stringify([{ kind: 'item', id: 'only', label: 'Only item', icon: 'star' }]),
    );
    await render();
    expect(labels()).toEqual(['Only item']);
  });

  it('falls back to the default items when storage is invalid', async () => {
    localStorage.setItem(NAV_ITEMS_STORAGE_KEY, 'not json');
    await render();
    expect(labels()).toContain('Home');
  });

  it('toggles the experimental flag and remembers it', async () => {
    await render();
    const element = fixture.nativeElement as HTMLElement;
    const navigator = element.querySelector('dnd-navigator')!;
    expect(navigator.classList).not.toContain('experimental');

    element.querySelector<HTMLButtonElement>('mat-slide-toggle button')!.click();
    await fixture.whenStable();
    expect(navigator.classList).toContain('experimental');
    expect(localStorage.getItem(NAV_EXPERIMENTAL_STORAGE_KEY)).toBe('true');
  });
});
