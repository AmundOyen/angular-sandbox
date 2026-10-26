import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Accordion } from './accordion';

describe('Accordion', () => {
  let component: Accordion;
  let fixture: ComponentFixture<Accordion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Accordion],
    }).compileComponents();

    fixture = TestBed.createComponent(Accordion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render three panels with the first expanded', () => {
    const panels = (fixture.nativeElement as HTMLElement).querySelectorAll('mat-expansion-panel');
    expect(panels.length).toBe(3);
    expect(panels[0].classList).toContain('mat-expanded');
    expect(panels[1].classList).not.toContain('mat-expanded');
  });
});
