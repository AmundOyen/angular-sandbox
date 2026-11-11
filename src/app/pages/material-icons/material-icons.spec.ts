import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaterialIcons } from './material-icons';

describe('MaterialIcons', () => {
  let fixture: ComponentFixture<MaterialIcons>;
  let element: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(MaterialIcons);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  const toggles = () => [...element.querySelectorAll<HTMLButtonElement>('mat-slide-toggle button')];
  const formValue = () => element.querySelectorAll('.selection')[1].textContent;

  it('shows the list and the input field', () => {
    expect(element.querySelector('material-icon-list .tile')).not.toBeNull();
    expect(element.querySelector('mat-form-field material-icon-input')).not.toBeNull();
  });

  it('shows the icons selected in the list', async () => {
    element.querySelector<HTMLElement>('material-icon-list .tile')!.click();
    await fixture.whenStable();
    expect(element.querySelector('.selected-name')).not.toBeNull();
  });

  it('converts the form value when switching the input to multiple and back', async () => {
    const component = fixture.componentInstance as unknown as {
      control: { setValue(v: unknown): void; value: unknown };
    };
    component.control.setValue('home');
    toggles()[1].click();
    await fixture.whenStable();
    expect(component.control.value).toEqual(['home']);
    expect(formValue()).toContain('"home"');

    toggles()[1].click();
    await fixture.whenStable();
    expect(component.control.value).toBe('home');
  });
});
