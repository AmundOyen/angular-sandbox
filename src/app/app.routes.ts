import { Routes } from '@angular/router';
import { Home } from './pages/home/home';

/**
 * Routes with `data.navIcon` appear in the app navigator, labelled by their `title`.
 * Add a page here and it shows up in the navigator, even for users with a saved layout.
 */
export const routes: Routes = [
  { path: '', component: Home, title: 'Home', data: { navIcon: 'home' } },
  {
    path: 'accordion',
    loadComponent: () => import('./pages/accordion/accordion').then((m) => m.Accordion),
    title: 'Accordion',
    data: { navIcon: 'view_agenda' },
  },
  {
    path: 'image-mask',
    loadComponent: () => import('./pages/image-mask/image-mask').then((m) => m.ImageMask),
    title: 'Image mask',
    data: { navIcon: 'crop' },
  },
  {
    path: 'material-icons',
    loadComponent: () =>
      import('./pages/material-icons/material-icons').then((m) => m.MaterialIcons),
    title: 'Material icons',
    data: { navIcon: 'interests' },
  },
  {
    path: 'navigator',
    loadComponent: () => import('./pages/navigator/navigator').then((m) => m.Navigator),
    title: 'Navigator',
    data: { navIcon: 'drag_indicator' },
  },
  { path: '**', redirectTo: '' },
];
