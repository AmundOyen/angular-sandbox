import {
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Directionality } from '@angular/cdk/bidi';
import { MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';

import {
  DropTarget,
  GroupFactory,
  MenuFactory,
  MoveDirection,
  NavGroup,
  NavItem,
  NavMenu,
  NavNode,
  ancestorIds,
  canDrop,
  createGroup,
  createMenu,
  editGroup,
  findNode,
  keyboardTarget,
  moveNode,
} from './nav-tree';

/** Pointer travel (px) before a mouse press turns into a drag. */
const DRAG_THRESHOLD = 5;
/** Press-and-hold time (ms) before a touch turns into a drag, so the rail still scrolls. */
const TOUCH_DRAG_DELAY = 300;
/** Hover time (ms) over a collapsed group before it springs open. */
const HOVER_EXPAND_DELAY = 500;
/** Share of a root item's height at the top/bottom that means before/after instead of combine. */
const EDGE_ZONE = 0.3;

let nextId = 0;

interface PendingDrag {
  readonly node: NavNode;
  readonly tile: HTMLElement;
  readonly pointerId: number;
  readonly isTouch: boolean;
  readonly startX: number;
  readonly startY: number;
  touchTimer?: ReturnType<typeof setTimeout>;
}

interface ActiveDrag {
  readonly node: NavNode;
  readonly pointerId: number;
  /** Pointer position relative to the tile's top-left corner. */
  readonly offsetX: number;
  readonly offsetY: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Vertical navigation rail whose items can be reordered and grouped with drag and drop.
 *
 * - Drop near the top/bottom edge of an item to place before/after it.
 * - Drop on the middle of a root item to group the two items.
 * - Hover over a collapsed group to expand it, or drop on its header to append to it.
 * - Groups left with a single item are ungrouped automatically.
 * - Drop on the middle of an item inside a group to put both items in a menu. A new menu trigger
 *   takes the item's place in the group and opens the items in a `MatMenu`.
 * - Drop on the middle of a menu trigger to append to the menu; hover to open it while dragging.
 * - Drag items within an open menu to reorder them, or out of it into the rail.
 * - Menus left with a single item are replaced by that item.
 * - While a menu is open the rail stays usable; a click outside the menu closes it.
 *
 * Everything can also be done with the keyboard, on the focused item, group or menu:
 * - Alt+ArrowUp/ArrowDown moves it past its neighbour, or out of its group or menu at either end.
 * - Alt+ArrowRight moves it into the group or menu above it, or combines it with the item above.
 * - Alt+ArrowLeft moves it out of its group or menu.
 * Focus stays on the moved node, and each move is announced to screen readers.
 *
 * Double-click a group, or press F2 on a group or menu, to edit its label and icon in a dialog.
 *
 * Bind with `[(items)]`; every change emits a new, immutable tree. The button at the top switches
 * between the compact rail and a wide drawer; bind `[(expanded)]` to control or remember that state.
 */
@Component({
  selector: 'dnd-navigator',
  imports: [MatIconButton, MatIconModule, MatMenuModule, NgTemplateOutlet],
  templateUrl: './dnd-navigator.html',
  styleUrl: './dnd-navigator.scss',
  host: {
    role: 'navigation',
    '[class.is-dragging]': 'dragging() !== null',
    '[class.drawer]': 'expanded()',
  },
})
export class DndNavigator {
  readonly items = model.required<readonly NavNode[]>();
  /** Whether the navigator is shown as a wide drawer (icon beside label) instead of a rail. */
  readonly expanded = model(false);
  /** Id of the currently selected item, if any. */
  readonly activeId = input<string | null>(null);
  /** Creates groups when two items are combined. Override to control ids and default labels. */
  readonly groupFactory = input<GroupFactory>(createGroup);
  /** Creates menus when two items in a group are combined. Override to control ids and labels. */
  readonly menuFactory = input<MenuFactory>(createMenu);

  readonly itemSelect = output<NavItem>();

  protected readonly openGroups = signal<ReadonlySet<string>>(new Set());
  protected readonly dragging = signal<ActiveDrag | null>(null);
  protected readonly dropTarget = signal<DropTarget | null>(null);
  protected readonly previewPosition = signal({ x: 0, y: 0 });

  protected readonly draggedId = computed(() => this.dragging()?.node.id ?? null);
  /** Marks this navigator's menu panels, which render in an overlay outside the host. */
  protected readonly navId = `dnd-nav-${nextId++}`;
  protected readonly menuIcon = 'apps';
  /** Id of the menu whose panel is open, if any. */
  protected readonly openMenuId = signal<string | null>(null);

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly injector = inject(Injector);
  private readonly dir = inject(Directionality, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly menuTriggers = viewChildren('menuTrigger', { read: MatMenuTrigger });
  private readonly menuTriggerElements = viewChildren('menuTrigger', { read: ElementRef });

  private pending: PendingDrag | null = null;
  /** Groups opened by hovering during the current drag; they close again unless dropped into. */
  private autoExpanded = new Set<string>();
  private hoverTimer?: ReturnType<typeof setTimeout>;
  private hoverGroupId: string | null = null;
  /** Menu opened by hovering its trigger during the current drag. */
  private autoOpenedMenu: string | null = null;
  private suppressClickUntil = 0;

  constructor() {
    // Registered for the component's lifetime: the browser decides whether a touch may scroll
    // when it starts, so a listener added once the drag begins would be too late.
    const host = this.host.nativeElement;
    host.addEventListener('touchmove', this.onTouchMove, { passive: false });
    // Swallow the click that follows a drop before it reaches handlers such as a menu trigger's or
    // the menu panel's (which closes the menu). The panel renders in an overlay outside the host.
    this.document.addEventListener('click', this.onClickCapture, true);
    this.destroyRef.onDestroy(() => {
      host.removeEventListener('touchmove', this.onTouchMove);
      this.document.removeEventListener('click', this.onClickCapture, true);
      this.endDrag();
    });
  }

  protected isGroupOpen(group: NavGroup): boolean {
    return this.openGroups().has(group.id);
  }

  /** Whether the active item is inside `menu`, so its trigger is highlighted. */
  protected containsActive(menu: NavMenu): boolean {
    const activeId = this.activeId();
    return menu.children.some((child) => child.id === activeId);
  }

  protected dropClass(id: string): string | null {
    const target = this.dropTarget();
    if (!target) {
      return null;
    }
    if (target.kind === 'into') {
      return target.groupId === id ? 'drop-into' : null;
    }
    if (target.kind === 'root-end') {
      return null;
    }
    return target.refId === id ? `drop-${target.kind}` : null;
  }

  // ---- Clicks & keyboard -------------------------------------------------

  protected onItemClick(item: NavItem): void {
    if (!this.clickSuppressed()) {
      this.itemSelect.emit(item);
    }
  }

  protected toggleGroup(group: NavGroup): void {
    if (this.clickSuppressed()) {
      return;
    }
    this.setGroupOpen(group.id, !this.isGroupOpen(group));
  }

  protected toggleExpanded(): void {
    this.expanded.update((expanded) => !expanded);
  }

  /** Icon shown for a group: its own, or a folder that opens with the group. */
  protected groupIcon(group: NavGroup): string {
    return group.icon ?? (this.isGroupOpen(group) ? 'folder_open' : 'folder');
  }

  /**
   * Opens a dialog to edit the label and icon of a group or menu. The dialog and its icon picker
   * are loaded on first use, which keeps the icon catalogue out of the initial bundle.
   */
  protected async startEdit(node: NavGroup | NavMenu, event?: Event): Promise<void> {
    event?.preventDefault();
    const [{ MatDialog }, { NavEditDialog }] = await Promise.all([
      import('@angular/material/dialog'),
      import('./nav-edit-dialog'),
    ]);
    if (this.destroyRef.destroyed) {
      return;
    }
    const ref = this.injector.get(MatDialog).open(NavEditDialog, {
      width: '420px',
      data: { kind: node.kind, label: node.label, icon: node.icon ?? null },
    });
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result && (result.label !== node.label || result.icon !== (node.icon ?? null))) {
          this.items.set(editGroup(this.items(), node.id, result));
          this.announcer.announce(`${result.label} updated`);
        }
        // The dialog can't restore focus when it was opened from a menu panel that has closed.
        afterNextRender(() => this.focusAfterEdit(node.id), { injector: this.injector });
      });
  }

  private focusAfterEdit(id: string): void {
    const active = this.document.activeElement;
    if (!active || active === this.document.body) {
      this.findTile(id)?.focus();
    }
  }

  protected toggleMenu(menuId: string): void {
    this.menuTrigger(menuId)?.toggleMenu();
  }

  protected onMenuClosed(menuId: string): void {
    if (this.openMenuId() === menuId) {
      this.openMenuId.set(null);
    }
    // Focus would otherwise be lost with the panel; the anchor that owns the menu can't take it.
    const active = this.document.activeElement;
    if (!active || active === this.document.body || active.closest('.mat-mdc-menu-panel')) {
      this.host.nativeElement
        .querySelector<HTMLElement>(`[data-drop="menu-trigger"][data-id="${menuId}"]`)
        ?.focus();
    }
  }

  // ---- Keyboard moves ----------------------------------------------------

  /** Shortcuts advertised on every movable tile (`aria-keyshortcuts`). */
  protected readonly moveShortcuts = 'Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight';

  /** Moves the focused node with Alt+arrow keys. */
  protected onMoveKeydown(event: KeyboardEvent, node: NavNode): void {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const direction = this.keyDirection(event.key);
    if (!direction || this.dragging()) {
      return;
    }
    // Keep MatMenu's own key handling (and the browser's Alt+arrow navigation) out of it.
    event.preventDefault();
    event.stopPropagation();

    const target = keyboardTarget(this.items(), node.id, direction);
    if (!target) {
      this.announcer.announce(`${node.label} can't move ${this.describeDirection(direction)}`);
      return;
    }
    if (this.applyMove(node, target)) {
      this.focusNode(node.id);
    }
  }

  private keyDirection(key: string): MoveDirection | null {
    const rtl = this.dir?.value === 'rtl';
    switch (key) {
      case 'ArrowUp':
        return 'up';
      case 'ArrowDown':
        return 'down';
      case 'ArrowRight':
        return rtl ? 'out' : 'in';
      case 'ArrowLeft':
        return rtl ? 'in' : 'out';
      default:
        return null;
    }
  }

  private describeDirection(direction: MoveDirection): string {
    return direction === 'in' ? 'further in' : direction === 'out' ? 'further out' : direction;
  }

  /**
   * Focuses the tile of `id` once the moved tree has rendered: a rail tile, or an entry in its
   * menu, which is opened first.
   */
  private focusNode(id: string): void {
    const menuId = findNode(this.items(), id)?.parentId;
    const inMenu = !!menuId && findNode(this.items(), menuId)?.node.kind === 'menu';
    afterNextRender(
      () => {
        if (inMenu) {
          // Opening the menu focuses its first entry; move focus once that has happened.
          this.menuTrigger(menuId!)?.openMenu();
          afterNextRender(() => this.findTile(id)?.focus(), { injector: this.injector });
        } else {
          this.findTile(id)?.focus();
        }
      },
      { injector: this.injector },
    );
  }

  private findTile(id: string): HTMLElement | null {
    const selector = `button[data-id="${CSS.escape(id)}"]`;
    return (
      this.host.nativeElement.querySelector<HTMLElement>(selector) ??
      this.document.querySelector<HTMLElement>(`[data-nav="${this.navId}"] ${selector}`)
    );
  }

  // ---- Drag and drop -----------------------------------------------------

  protected onPointerDown(event: PointerEvent, node: NavNode): void {
    if (event.button !== 0 || this.pending || this.dragging()) {
      return;
    }
    const tile = event.currentTarget as HTMLElement;
    const isTouch = event.pointerType === 'touch';
    this.pending = {
      node,
      tile,
      pointerId: event.pointerId,
      isTouch,
      startX: event.clientX,
      startY: event.clientY,
    };
    if (isTouch) {
      this.pending.touchTimer = setTimeout(() => {
        const pending = this.pending;
        if (pending) {
          this.startDrag(pending, pending.startX, pending.startY);
        }
      }, TOUCH_DRAG_DELAY);
    }
    this.addDocumentListeners();
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const pending = this.pending;
    if (pending && event.pointerId === pending.pointerId) {
      const distance = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
      if (distance < DRAG_THRESHOLD) {
        return;
      }
      if (pending.isTouch) {
        // Moved before the long-press fired: the user is scrolling, not dragging.
        this.endDrag();
        return;
      }
      this.startDrag(pending, event.clientX, event.clientY);
    }

    const drag = this.dragging();
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    this.previewPosition.set({ x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY });
    this.updateTarget(this.resolveTarget(drag.node, event.clientX, event.clientY));
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const drag = this.dragging();
    if (drag && event.pointerId === drag.pointerId) {
      this.drop(drag.node, this.dropTarget());
      this.suppressClickUntil = performance.now() + 100;
    }
    this.endDrag();
  };

  private readonly onPointerCancel = (): void => this.endDrag();

  private readonly onClickCapture = (event: MouseEvent): void => {
    if (this.clickSuppressed()) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    // Menus have no backdrop, so the rail stays usable (and draggable) while one is open; close
    // the open menu on a click anywhere but its panel and its own trigger, which toggles it.
    const openId = this.openMenuId();
    const target = event.target as Element | null;
    if (
      openId &&
      !target?.closest('.mat-mdc-menu-panel') &&
      target?.closest<HTMLElement>('[data-drop="menu-trigger"]')?.dataset['id'] !== openId
    ) {
      this.closeMenus();
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.dragging()) {
      event.preventDefault();
      this.endDrag();
    }
  };

  /** Stops touch scrolling while dragging. */
  private readonly onTouchMove = (event: TouchEvent): void => {
    if (this.dragging()) {
      event.preventDefault();
    }
  };

  private startDrag(pending: PendingDrag, x: number, y: number): void {
    clearTimeout(pending.touchTimer);
    this.pending = null;
    const rect = pending.tile.getBoundingClientRect();
    const drag: ActiveDrag = {
      node: pending.node,
      pointerId: pending.pointerId,
      offsetX: pending.startX - rect.left,
      offsetY: pending.startY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    this.autoExpanded = new Set();
    this.previewPosition.set({ x: x - drag.offsetX, y: y - drag.offsetY });
    this.dragging.set(drag);
    this.document.getSelection()?.removeAllRanges();
  }

  private drop(node: NavNode, target: DropTarget | null): void {
    this.applyMove(node, target);
  }

  /**
   * Moves `node` to `target` and updates which groups and menus are open: whatever now contains
   * the node stays open, and everything opened along the way closes. Announces the move and
   * returns whether the tree changed.
   */
  private applyMove(node: NavNode, target: DropTarget | null): boolean {
    const before = this.items();
    const after = target
      ? moveNode(before, node.id, target, {
          groupFactory: this.groupFactory(),
          menuFactory: this.menuFactory(),
        })
      : before;

    // Keep whatever now contains the dropped node open; close everything opened along the way.
    const containers = after !== before ? ancestorIds(after, node.id) : [];
    const keepOpen = new Set(containers);
    if (after !== before) {
      this.closeMenus(containers[0]);
    } else if (this.autoOpenedMenu) {
      this.menuTrigger(this.autoOpenedMenu)?.closeMenu();
    }
    this.autoOpenedMenu = null;

    const open = new Set(this.openGroups());
    for (const id of this.autoExpanded) {
      if (!keepOpen.has(id)) {
        open.delete(id);
      }
    }
    keepOpen.forEach((id) => open.add(id));
    // Forget groups that were dissolved by this move.
    for (const id of open) {
      if (findNode(after, id)?.node.kind !== 'group') {
        open.delete(id);
      }
    }
    this.openGroups.set(open);
    this.autoExpanded = new Set();

    if (after === before) {
      return false;
    }
    this.items.set(after);
    this.announcer.announce(this.describeDrop(node, target!, before, after));
    return true;
  }

  private endDrag(): void {
    if (this.autoOpenedMenu) {
      // Cancelled drags close a menu that sprang open.
      this.menuTrigger(this.autoOpenedMenu)?.closeMenu();
      this.autoOpenedMenu = null;
    }
    if (this.pending) {
      clearTimeout(this.pending.touchTimer);
      this.pending = null;
    }
    if (this.autoExpanded.size) {
      // Cancelled drags (Escape, pointercancel) close any sprung-open groups.
      const open = new Set(this.openGroups());
      this.autoExpanded.forEach((id) => open.delete(id));
      this.openGroups.set(open);
      this.autoExpanded = new Set();
    }
    this.clearHoverTimer();
    this.dragging.set(null);
    this.dropTarget.set(null);
    this.removeDocumentListeners();
  }

  private updateTarget(target: DropTarget | null): void {
    const current = this.dropTarget();
    if (JSON.stringify(current) !== JSON.stringify(target)) {
      this.dropTarget.set(target);
    }

    // Spring-load collapsed groups that are hovered with a droppable item.
    const groupId = target?.kind === 'into' ? target.groupId : null;
    if (groupId === this.hoverGroupId) {
      return;
    }
    this.clearHoverTimer();
    if (!groupId) {
      return;
    }
    const isMenu = findNode(this.items(), groupId)?.node.kind === 'menu';
    if (isMenu ? !this.menuTrigger(groupId)?.menuOpen : !this.openGroups().has(groupId)) {
      this.hoverGroupId = groupId;
      this.hoverTimer = setTimeout(() => {
        if (isMenu) {
          this.closeMenus();
          this.menuTrigger(groupId)?.openMenu();
          this.autoOpenedMenu = groupId;
        } else {
          this.autoExpanded.add(groupId);
          this.setGroupOpen(groupId, true);
        }
      }, HOVER_EXPAND_DELAY);
    }
  }

  private menuTrigger(menuId: string): MatMenuTrigger | undefined {
    const index = this.menuTriggerElements().findIndex(
      (element) => element.nativeElement.dataset['id'] === menuId,
    );
    return index === -1 ? undefined : this.menuTriggers()[index];
  }

  /** Closes open menus, except `keepId` when given. */
  private closeMenus(keepId?: string): void {
    this.menuTriggerElements().forEach((element, index) => {
      const trigger = this.menuTriggers()[index];
      if (trigger?.menuOpen && element.nativeElement.dataset['id'] !== keepId) {
        trigger.closeMenu();
      }
    });
  }

  private clearHoverTimer(): void {
    clearTimeout(this.hoverTimer);
    this.hoverTimer = undefined;
    this.hoverGroupId = null;
  }

  /** Maps a pointer position to a drop target, based on the element under the pointer. */
  private resolveTarget(dragged: NavNode, x: number, y: number): DropTarget | null {
    const element = this.document.elementFromPoint(x, y);
    const zone = element?.closest<HTMLElement>('[data-drop]');
    const inMenuPanel = zone?.closest<HTMLElement>('[data-nav]')?.dataset['nav'] === this.navId;
    if (!zone || !(inMenuPanel || this.host.nativeElement.contains(zone))) {
      return null;
    }
    const nodes = this.items();
    const kind = zone.dataset['drop'];
    const id = zone.dataset['id'] ?? '';
    const rect = zone.getBoundingClientRect();
    const ratio = (y - rect.top) / rect.height;

    let target: DropTarget | null;
    if (kind === 'root') {
      // Empty space in the rail: before the first node if above it, else at the end.
      const first = zone.querySelector<HTMLElement>(':scope > li');
      target =
        first && nodes.length && y < first.getBoundingClientRect().top
          ? { kind: 'before', refId: nodes[0].id }
          : { kind: 'root-end' };
    } else if (dragged.kind === 'group') {
      // Groups only move between root nodes; resolve to the root-level element.
      const rootZone = zone.closest<HTMLElement>('[data-root-id]');
      if (!rootZone) {
        return null;
      }
      const rootRect = rootZone.getBoundingClientRect();
      const refId = rootZone.dataset['rootId']!;
      target = { kind: y < rootRect.top + rootRect.height / 2 ? 'before' : 'after', refId };
    } else if (kind === 'menu') {
      // Padding around an open menu's items.
      target = { kind: 'into', groupId: id };
    } else if (dragged.kind === 'menu' || kind === 'menu-item') {
      // Menus only move between a group's children, and menu items can't combine (no nesting).
      target =
        kind === 'item' || kind === 'menu-trigger' || kind === 'menu-item'
          ? { kind: ratio < 0.5 ? 'before' : 'after', refId: id }
          : kind === 'group-header' || kind === 'group'
            ? { kind: 'into', groupId: id }
            : null;
    } else if (kind === 'menu-trigger') {
      target =
        ratio < EDGE_ZONE
          ? { kind: 'before', refId: id }
          : ratio > 1 - EDGE_ZONE
            ? { kind: 'after', refId: id }
            : { kind: 'into', groupId: id };
    } else if (kind === 'item') {
      target =
        ratio < EDGE_ZONE
          ? { kind: 'before', refId: id }
          : ratio > 1 - EDGE_ZONE
            ? { kind: 'after', refId: id }
            : { kind: 'combine', refId: id };
    } else if (kind === 'group-header') {
      const open = this.openGroups().has(id);
      target =
        ratio < EDGE_ZONE
          ? { kind: 'before', refId: id }
          : ratio > 1 - EDGE_ZONE && !open
            ? { kind: 'after', refId: id }
            : { kind: 'into', groupId: id };
    } else if (kind === 'group') {
      // Padding around an expanded group's children.
      target = { kind: 'into', groupId: id };
    } else {
      target = null;
    }

    return target && canDrop(nodes, dragged.id, target) ? target : null;
  }

  private describeDrop(
    node: NavNode,
    target: DropTarget,
    before: readonly NavNode[],
    tree: readonly NavNode[],
  ): string {
    // Look in the old tree too: the move may have dissolved the group or menu it refers to.
    const label = (id: string) => (findNode(tree, id) ?? findNode(before, id))?.node.label ?? '';
    switch (target.kind) {
      case 'root-end':
        return `${node.label} moved to the end`;
      case 'into':
        return `${node.label} added to ${label(target.groupId)}`;
      case 'combine': {
        const created = findNode(tree, node.id)?.parentId;
        const kind = created && findNode(tree, created)?.node.kind === 'menu' ? 'menu' : 'group';
        return kind === 'menu'
          ? `${node.label} put in a menu with ${label(target.refId)}`
          : `${node.label} grouped with ${label(target.refId)}`;
      }
      default:
        // Placed next to its own group or menu: it moved out of it.
        return findNode(before, node.id)?.parentId === target.refId
          ? `${node.label} moved out of ${label(target.refId)}`
          : `${node.label} moved ${target.kind} ${label(target.refId)}`;
    }
  }

  private setGroupOpen(groupId: string, open: boolean): void {
    const next = new Set(this.openGroups());
    if (open) {
      next.add(groupId);
    } else {
      next.delete(groupId);
    }
    this.openGroups.set(next);
  }

  private clickSuppressed(): boolean {
    return performance.now() < this.suppressClickUntil;
  }

  private addDocumentListeners(): void {
    this.document.addEventListener('pointermove', this.onPointerMove);
    this.document.addEventListener('pointerup', this.onPointerUp);
    this.document.addEventListener('pointercancel', this.onPointerCancel);
    this.document.addEventListener('keydown', this.onKeyDown);
  }

  private removeDocumentListeners(): void {
    this.document.removeEventListener('pointermove', this.onPointerMove);
    this.document.removeEventListener('pointerup', this.onPointerUp);
    this.document.removeEventListener('pointercancel', this.onPointerCancel);
    this.document.removeEventListener('keydown', this.onKeyDown);
  }
}
