import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { Component, signal } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';

interface Panel {
  id: string;
  icon: string;
  title: string;
  description: string;
  items: { label: string; value: string }[];
}

const PANELS: Panel[] = [
  {
    id: 'profile',
    icon: 'person',
    title: 'Profile',
    description: 'Personal details',
    items: [
      { label: 'Name', value: 'Kari Nordmann' },
      { label: 'Email', value: 'kari.nordmann@example.com' },
      { label: 'Location', value: 'Oslo, Norway' },
    ],
  },
  {
    id: 'orders',
    icon: 'shopping_cart',
    title: 'Recent orders',
    description: '3 orders this month',
    items: [
      { label: '#10421', value: 'Mechanical keyboard — Shipped' },
      { label: '#10398', value: 'USB-C hub — Delivered' },
      { label: '#10377', value: 'Monitor arm — Delivered' },
    ],
  },
  {
    id: 'settings',
    icon: 'settings',
    title: 'Settings',
    description: 'Preferences and notifications',
    items: [
      { label: 'Theme', value: 'Light' },
      { label: 'Language', value: 'English' },
      { label: 'Email notifications', value: 'Weekly digest' },
    ],
  },
];

@Component({
  imports: [CdkDropList, CdkDrag, CdkDragHandle, MatExpansionModule, MatIconModule],
  selector: 'app-accordion',
  styleUrl: './accordion.scss',
  templateUrl: './accordion.html',
})
export class Accordion {
  protected readonly panels = signal(restoreOrder(PANELS));

  /** Expand whichever panel is first on load; stays fixed when panels are reordered. */
  protected readonly initiallyExpandedId = this.panels()[0]?.id;

  protected drop(event: CdkDragDrop<Panel[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const panels = [...this.panels()];
    moveItemInArray(panels, event.previousIndex, event.currentIndex);
    this.panels.set(panels);
    saveOrder(panels.map((panel) => panel.id));
  }
}

export const PANEL_ORDER_STORAGE_KEY = 'angular-sandbox.accordion.panel-order';

/** Sorts panels by the stored id order. Unknown ids are ignored and new panels keep their default position at the end. */
function restoreOrder(panels: Panel[]): Panel[] {
  const order = readOrder();
  const rank = (id: string) => {
    const index = order.indexOf(id);
    return index === -1 ? order.length : index;
  };
  return [...panels].sort((a, b) => rank(a.id) - rank(b.id));
}

function readOrder(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PANEL_ORDER_STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveOrder(ids: string[]): void {
  try {
    localStorage.setItem(PANEL_ORDER_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage can be unavailable (private mode, quota); the order then lasts for this session only.
  }
}
