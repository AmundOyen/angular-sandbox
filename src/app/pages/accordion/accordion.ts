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

@Component({
  imports: [MatExpansionModule, MatIconModule],
  selector: 'app-accordion',
  styleUrl: './accordion.scss',
  templateUrl: './accordion.html',
})
export class Accordion {
  protected readonly panels = signal<Panel[]>([
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
  ]);
}
