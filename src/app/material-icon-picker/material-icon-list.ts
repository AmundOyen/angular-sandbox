import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import {
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  forwardRef,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import {
  filterIcons,
  MATERIAL_ICON_CATEGORIES,
  MaterialIcon,
  MaterialIconCategory,
} from './material-icon';
import { MATERIAL_ICONS } from './material-icons.data';

/** Height of a grid row in px. Keep in sync with `$row-height` in material-icon-list.scss. */
export const ICON_ROW_HEIGHT = 104;
/** Minimum width of a tile in px; the grid fits as many columns as it can. */
export const ICON_MIN_TILE_WIDTH = 104;
/** Columns used before the grid has been measured (and in environments without layout). */
const FALLBACK_COLUMNS = 6;

/** Value written by forms: an icon name, or a list of names when `multiple` is set. */
export type MaterialIconValue = string | readonly string[] | null;

let nextId = 0;

/**
 * A searchable grid of Material Symbols, filterable by category. Select one icon, or several
 * with `multiple`. Works with `[(selected)]` and with forms (`formControl`, `ngModel`), whose
 * value is a name or, with `multiple`, an array of names.
 *
 * Keyboard (on the search field or the grid): arrow keys move, Home/End go to the first/last
 * icon, Enter (and Space on the grid) selects.
 *
 * Styling: set the grid height with `--material-icon-list-height` (default 480px). Add the
 * `material-icon-list-compact` class to keep the category chips on one scrolling line.
 */
@Component({
  imports: [MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, ScrollingModule],
  selector: 'material-icon-list',
  styleUrl: './material-icon-list.scss',
  templateUrl: './material-icon-list.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MaterialIconList),
      multi: true,
    },
  ],
  host: {
    class: 'material-icon-list',
    '[class.material-icon-list-disabled]': 'isDisabled()',
  },
})
export class MaterialIconList implements ControlValueAccessor {
  /** Allows selecting more than one icon. */
  readonly multiple = input(false, { transform: booleanAttribute });
  /** The icons to choose from. Defaults to all Material Symbols. */
  readonly icons = input<readonly MaterialIcon[]>(MATERIAL_ICONS);
  /** Names of the selected icons; at most one unless `multiple` is set. */
  readonly selected = model<readonly string[]>([]);
  /** Search text, matched against display names and aliases. */
  readonly query = model('');
  /** Categories to show. Empty shows all. */
  readonly categories = model<readonly MaterialIconCategory[]>([]);
  /** Shows the built-in search field. Turn off when the search text comes from elsewhere. */
  readonly showSearch = input(true, { transform: booleanAttribute });
  /** Shows the category filter chips. */
  readonly showCategories = input(true, { transform: booleanAttribute });
  /**
   * Makes the grid focusable. Turn off when another element (such as an input) keeps focus and
   * forwards key presses with `handleKeydown`.
   */
  readonly focusable = input(true, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Accessible name of the grid. */
  readonly ariaLabel = input('Icons', { alias: 'aria-label' });

  /** Emitted when the user selects or deselects an icon. */
  readonly iconSelect = output<MaterialIcon>();

  readonly listboxId = `material-icon-list-${nextId++}`;
  protected readonly allCategories = MATERIAL_ICON_CATEGORIES;

  private readonly formDisabled = signal(false);
  readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  readonly filtered = computed(() =>
    filterIcons(this.icons(), { query: this.query(), categories: this.categories() }),
  );
  private readonly selectedSet = computed(() => new Set(this.selected()));

  /** Index in `filtered` of the keyboard-highlighted icon, or -1. Reset when the results change. */
  readonly activeIndex = linkedSignal({ source: this.filtered, computation: () => -1 });
  readonly activeOptionId = computed(() => {
    const icon = this.filtered()[this.activeIndex()];
    return icon ? this.optionId(icon) : null;
  });

  private readonly viewport = viewChild.required(CdkVirtualScrollViewport);
  private readonly viewportWidth = signal(0);
  protected readonly columns = computed(() => {
    const width = this.viewportWidth();
    return width > 0 ? Math.max(1, Math.floor(width / ICON_MIN_TILE_WIDTH)) : FALLBACK_COLUMNS;
  });
  protected readonly rows = computed(() => {
    const icons = this.filtered();
    const columns = this.columns();
    const rows: { index: number; icons: MaterialIcon[] }[] = [];
    for (let i = 0; i < icons.length; i += columns) {
      rows.push({ index: i, icons: icons.slice(i, i + columns) });
    }
    return rows;
  });
  protected readonly rowHeight = ICON_ROW_HEIGHT;
  /** Rows are rendered with CDK virtual scroll: only those in and near the visible area. */
  protected readonly trackRow = (_: number, row: { index: number }) => row.index;

  private onChange: (value: MaterialIconValue) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => this.measure());
      afterRenderEffect(() => observer.observe(this.viewport().elementRef.nativeElement));
      inject(DestroyRef).onDestroy(() => observer.disconnect());
    }
    // Scroll the highlighted icon into view after the grid has rendered.
    afterRenderEffect(() => {
      const index = this.activeIndex();
      if (index >= 0) {
        this.scrollToRow(Math.floor(index / this.columns()));
      }
    });
    // Back to the top when the results change.
    afterRenderEffect(() => {
      this.filtered();
      this.viewport().scrollToOffset(0);
    });
  }

  isSelected(icon: MaterialIcon): boolean {
    return this.selectedSet().has(icon.name);
  }

  optionId(icon: MaterialIcon): string {
    return `${this.listboxId}-${icon.name}`;
  }

  /** Selects or deselects an icon as if the user clicked it. */
  toggle(icon: MaterialIcon): void {
    if (this.isDisabled()) {
      return;
    }
    const selected = this.selected();
    if (this.multiple()) {
      this.selected.set(
        this.isSelected(icon)
          ? selected.filter((name) => name !== icon.name)
          : [...selected, icon.name],
      );
    } else if (!this.isSelected(icon) || selected.length > 1) {
      this.selected.set([icon.name]);
    }
    this.onChange(this.value());
    this.onTouched();
    this.iconSelect.emit(icon);
  }

  /**
   * Handles a key press for the grid; returns true (and prevents the default action) if the key
   * was used. Call it from an element that keeps focus, such as a search field.
   */
  handleKeydown(event: KeyboardEvent): boolean {
    const count = this.filtered().length;
    if (count === 0 || this.isDisabled()) {
      return false;
    }
    const current = this.activeIndex();
    const columns = this.columns();
    const move = (to: number) => this.activeIndex.set(Math.min(count - 1, Math.max(0, to)));
    switch (event.key) {
      case 'ArrowRight':
        move(current + 1);
        break;
      case 'ArrowLeft':
        move(current < 0 ? 0 : current - 1);
        break;
      case 'ArrowDown':
        move(current < 0 ? 0 : current + columns);
        break;
      case 'ArrowUp':
        move(current < 0 ? 0 : current - columns);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(count - 1);
        break;
      case 'Enter':
      case ' ': {
        const icon = this.filtered()[current];
        if (!icon) {
          return false;
        }
        this.toggle(icon);
        break;
      }
      default:
        return false;
    }
    event.preventDefault();
    return true;
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    // Space types a space here; Left/Right move the text cursor until an icon is highlighted.
    const horizontal = ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key);
    if (event.key === ' ' || (horizontal && this.activeIndex() < 0)) {
      return;
    }
    this.handleKeydown(event);
  }

  protected onClick(icon: MaterialIcon, index: number): void {
    this.activeIndex.set(index);
    this.toggle(icon);
  }

  protected onGridFocus(): void {
    if (this.activeIndex() < 0 && this.filtered().length > 0) {
      this.activeIndex.set(0);
    }
  }

  protected onCategoriesChange(value: MaterialIconCategory[] | undefined): void {
    this.categories.set(value ?? []);
  }

  private value(): MaterialIconValue {
    const selected = this.selected();
    return this.multiple() ? [...selected] : (selected[0] ?? null);
  }

  private measure(): void {
    const element = this.viewport().elementRef.nativeElement;
    // Width inside the padding, so tiles never overflow.
    const style = getComputedStyle(element);
    const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) || 0;
    this.viewportWidth.set(element.clientWidth - padding);
  }

  private scrollToRow(row: number): void {
    const viewport = this.viewport();
    const top = row * ICON_ROW_HEIGHT;
    const offset = viewport.measureScrollOffset();
    const height = viewport.getViewportSize();
    if (top < offset) {
      viewport.scrollToOffset(top);
    } else if (height > 0 && top + ICON_ROW_HEIGHT > offset + height) {
      viewport.scrollToOffset(top + ICON_ROW_HEIGHT - height);
    }
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
  }
}

/** Normalizes a form value to a list of names. */
export function toNames(value: MaterialIconValue | undefined): readonly string[] {
  if (Array.isArray(value)) {
    return value.filter((name): name is string => typeof name === 'string');
  }
  return typeof value === 'string' && value ? [value] : [];
}
