import {
  ConnectedPosition,
  createFlexibleConnectedPositionStrategy,
  createOverlayRef,
  createRepositionScrollStrategy,
  OverlayRef,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  booleanAttribute,
  Component,
  computed,
  DoCheck,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  OnDestroy,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { ControlValueAccessor, FormGroupDirective, NgControl, NgForm } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { ErrorStateMatcher } from '@angular/material/core';
import { MAT_FORM_FIELD, MatFormFieldControl } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';

import { MaterialIcon, MaterialIconCategory } from './material-icon';
import { MaterialIconList, MaterialIconValue, toNames } from './material-icon-list';
import { MATERIAL_ICONS } from './material-icons.data';

let nextId = 0;

const PANEL_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
];

/**
 * A form field control that opens the icon grid in an overlay below the field. Typing searches;
 * the selected icon (or, with `multiple`, chips for each icon) shows in the field. Use it inside
 * `<mat-form-field>` with `formControl` or `ngModel`; the value is a name or an array of names.
 *
 * Keyboard: typing or ArrowDown opens the grid, arrow keys move, Enter selects, Escape closes,
 * and Backspace in an empty field removes the last chip.
 */
@Component({
  imports: [MatButtonModule, MatChipsModule, MatIconModule, MaterialIconList],
  selector: 'material-icon-input',
  styleUrl: './material-icon-input.scss',
  templateUrl: './material-icon-input.html',
  providers: [{ provide: MatFormFieldControl, useExisting: MaterialIconInput }],
  host: {
    class: 'material-icon-input',
    '[class.material-icon-input-multiple]': 'multiple()',
    '(focusin)': 'onFocusIn()',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class MaterialIconInput
  implements ControlValueAccessor, MatFormFieldControl<MaterialIconValue>, DoCheck, OnDestroy
{
  readonly multiple = input(false, { transform: booleanAttribute });
  readonly icons = input<readonly MaterialIcon[]>(MATERIAL_ICONS);
  readonly placeholder = input('Search icons');
  readonly required = input(false, { transform: booleanAttribute });
  readonly disabledInput = input(false, { alias: 'disabled', transform: booleanAttribute });
  /** Category filter of the grid; the user can change it in the overlay. */
  readonly categories = model<readonly MaterialIconCategory[]>([]);

  /** Id of the text input, which the form field's label points to. */
  readonly id = `material-icon-input-${nextId++}`;
  readonly controlType = 'material-icon-input';
  readonly ngControl = inject(NgControl, { optional: true, self: true });

  private readonly formField = inject(MAT_FORM_FIELD, { optional: true });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly errorStateMatcher = inject(ErrorStateMatcher);
  private readonly parentForm = inject(NgForm, { optional: true });
  private readonly parentFormGroup = inject(FormGroupDirective, { optional: true });
  private readonly injector = inject(Injector);
  private readonly viewContainerRef = inject(ViewContainerRef);

  private readonly inputElement = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly list = viewChild(MaterialIconList);
  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panel');
  // Created on first open. (The overlay functions are used rather than the cdkConnectedOverlay
  // directive: they are already in the initial bundle, the directive is not.)
  private overlayRef: OverlayRef | null = null;

  readonly selected = signal<readonly string[]>([]);
  readonly query = signal('');
  readonly panelOpen = signal(false);
  readonly focused = signal(false);
  readonly errorState = signal(false);
  private readonly formDisabled = signal(false);
  readonly disabled = computed(() => this.disabledInput() || this.formDisabled());
  readonly empty = computed(() => this.selected().length === 0 && !this.query());
  readonly shouldLabelFloat = computed(() => this.focused() || !this.empty());

  private readonly iconsByName = computed(
    () => new Map(this.icons().map((icon) => [icon.name, icon])),
  );
  protected readonly selectedIcons = computed(() =>
    this.selected().map(
      (name): MaterialIcon =>
        this.iconsByName().get(name) ?? {
          name,
          displayName: name,
          category: 'Actions',
          aliases: [],
        },
    ),
  );
  /** Text in the field: the search while open; the selected icon's name in single mode. */
  protected readonly inputText = computed(() => {
    if (this.panelOpen() || this.multiple()) {
      return this.query();
    }
    return this.selectedIcons()[0]?.displayName ?? '';
  });

  protected readonly panelId = `${this.id}-panel`;
  protected readonly describedBy = signal<string | null>(null);

  private onChange: (value: MaterialIconValue) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  get value(): MaterialIconValue {
    const selected = this.selected();
    return this.multiple() ? [...selected] : (selected[0] ?? null);
  }

  ngDoCheck(): void {
    if (this.ngControl) {
      const parent = this.parentFormGroup ?? this.parentForm;
      this.errorState.set(this.errorStateMatcher.isErrorState(this.ngControl.control, parent));
    }
  }

  ngOnDestroy(): void {
    this.overlayRef?.dispose();
  }

  open(): void {
    if (this.disabled() || this.panelOpen()) {
      return;
    }
    const origin = this.origin();
    const overlayRef = (this.overlayRef ??= this.createOverlay(origin));
    // As wide as the field, at least 320px, and never wider than the screen.
    const width = origin.nativeElement.getBoundingClientRect().width;
    overlayRef.updateSize({ width: Math.min(Math.max(width, 320), window.innerWidth - 16) });
    overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));
    this.panelOpen.set(true);
  }

  close(): void {
    if (!this.panelOpen()) {
      return;
    }
    this.panelOpen.set(false);
    this.query.set('');
    this.overlayRef?.detach();
  }

  private createOverlay(origin: ElementRef<HTMLElement>): OverlayRef {
    const overlayRef = createOverlayRef(this.injector, {
      positionStrategy: createFlexibleConnectedPositionStrategy(this.injector, origin)
        .withPositions(PANEL_POSITIONS)
        .withPush(true)
        .withViewportMargin(8),
      scrollStrategy: createRepositionScrollStrategy(this.injector),
    });
    // Both streams complete when the overlay is disposed.
    overlayRef.outsidePointerEvents().subscribe((event) => this.onOutsideClick(event));
    overlayRef.detachments().subscribe(() => this.close());
    return overlayRef;
  }

  /** The element the panel attaches to: the form field's outline, or this element. */
  protected origin(): ElementRef<HTMLElement> {
    // Read on demand: the form field only knows its outline element once it has rendered.
    return this.formField?.getConnectedOverlayOrigin() ?? this.host;
  }

  focus(): void {
    this.inputElement().nativeElement.focus();
  }

  remove(name: string): void {
    if (this.disabled()) {
      return;
    }
    this.setSelected(this.selected().filter((n) => n !== name));
    this.focus();
  }

  clear(): void {
    this.setSelected([]);
    this.focus();
  }

  protected onInput(value: string): void {
    this.query.set(value);
    // Update the grid now rather than at the next render, so a key pressed right after typing
    // (such as Enter) acts on the new results.
    this.list()?.query.set(value);
    this.open();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const list = this.list();
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        if (!this.panelOpen()) {
          this.open();
          event.preventDefault();
          return;
        }
        list?.handleKeydown(event);
        return;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'Home':
      case 'End':
        // Moves in the grid once an icon is highlighted; otherwise moves the text cursor.
        if (this.panelOpen() && list && list.activeIndex() >= 0) {
          list.handleKeydown(event);
        }
        return;
      case 'Enter':
        if (this.panelOpen()) {
          list?.handleKeydown(event);
        }
        return;
      case 'Escape':
        if (this.panelOpen()) {
          event.preventDefault();
          this.close();
        }
        return;
      case 'Backspace':
        if (this.multiple() && !this.query() && this.selected().length > 0) {
          this.setSelected(this.selected().slice(0, -1));
        }
        return;
      case 'Tab':
        this.close();
        return;
    }
  }

  protected onListSelectedChange(names: readonly string[]): void {
    this.setSelected(names);
  }

  protected onIconSelect(): void {
    if (!this.multiple()) {
      this.close();
    }
  }

  private onOutsideClick(event: MouseEvent): void {
    // Clicks in the field itself keep the panel open.
    if (!this.origin().nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected onFocusIn(): void {
    this.focused.set(true);
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    const panel = this.overlayRef?.overlayElement;
    if (next && (this.host.nativeElement.contains(next) || panel?.contains(next))) {
      return;
    }
    this.focused.set(false);
    this.close();
    this.onTouched();
  }

  private setSelected(names: readonly string[]): void {
    this.selected.set(names);
    this.list()?.selected.set(names);
    this.onChange(this.value);
  }

  // MatFormFieldControl

  setDescribedByIds(ids: string[]): void {
    this.describedBy.set(ids.length ? ids.join(' ') : null);
  }

  onContainerClick(event: MouseEvent): void {
    if (this.disabled()) {
      return;
    }
    // Chip and clear buttons handle their own clicks.
    if ((event.target as Element).closest('button')) {
      return;
    }
    this.focus();
    this.open();
  }

  // ControlValueAccessor

  writeValue(value: MaterialIconValue): void {
    this.selected.set(toNames(value));
  }

  registerOnChange(fn: (value: MaterialIconValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
    if (isDisabled) {
      this.close();
    }
  }
}
