import { CdkDropList } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Accordion, PANEL_ORDER_STORAGE_KEY } from './accordion';

describe('Accordion', () => {
  let component: Accordion;
  let fixture: ComponentFixture<Accordion>;

  async function render(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Accordion],
    }).compileComponents();

    fixture = TestBed.createComponent(Accordion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  function panelIds(): (string | null)[] {
    const panels = (fixture.nativeElement as HTMLElement).querySelectorAll('mat-expansion-panel');
    return Array.from(panels, (panel) => panel.getAttribute('data-panel-id'));
  }

  beforeEach(() => localStorage.clear());

  it('should create', async () => {
    await render();
    expect(component).toBeTruthy();
  });

  it('should render three panels with the first expanded', async () => {
    await render();
    const panels = (fixture.nativeElement as HTMLElement).querySelectorAll('mat-expansion-panel');
    expect(panels.length).toBe(3);
    expect(panels[0].classList).toContain('mat-expanded');
    expect(panels[1].classList).not.toContain('mat-expanded');
  });

  it('should restore the panel order from local storage', async () => {
    localStorage.setItem(
      PANEL_ORDER_STORAGE_KEY,
      JSON.stringify(['settings', 'profile', 'orders']),
    );
    await render();
    expect(panelIds()).toEqual(['settings', 'profile', 'orders']);
  });

  it('should fall back to the default order when storage is invalid', async () => {
    localStorage.setItem(PANEL_ORDER_STORAGE_KEY, 'not json');
    await render();
    expect(panelIds()).toEqual(['profile', 'orders', 'settings']);
  });

  it('should reorder panels on drop and save the order', async () => {
    await render();
    fixture.debugElement
      .query(By.directive(CdkDropList))
      .triggerEventHandler('cdkDropListDropped', { previousIndex: 0, currentIndex: 2 });
    await fixture.whenStable();

    expect(panelIds()).toEqual(['orders', 'settings', 'profile']);
    expect(JSON.parse(localStorage.getItem(PANEL_ORDER_STORAGE_KEY) ?? '[]')).toEqual([
      'orders',
      'settings',
      'profile',
    ]);
  });
});
